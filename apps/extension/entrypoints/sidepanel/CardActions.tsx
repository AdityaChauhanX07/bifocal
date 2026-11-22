import { useEffect, useRef, useState } from "react";
import { prepareCloudPreview } from "@bifocal/core";
import type { CloudPreview, ScreeningResult } from "@bifocal/core";
import type { User } from "firebase/auth/web-extension";
import { TrustedContact } from "../../trusted-contact/TrustedContact";
import { watchCircle } from "../../trusted-contact/store";
import { approvedCloudEnabled, db } from "../../lib/firebase";
import { privateAI } from "../../lib/private-model";
import { checkApproved, explainWarning, searchApproved } from "../../lib/cloud-model";
import type { Card, ExtensionMessage } from "../../lib/card";
import { GroundedResult } from "./GroundedResult";

interface Props {
  card: Card;
  tabId: number;
  check: ScreeningResult;
  user: User | null;
  online: boolean;
  openContact: boolean;
  onSignIn: () => void;
  onCloudResult: (result: ScreeningResult) => void;
}

export function CardActions({ card, tabId, check, user, online, openContact, onSignIn, onCloudResult }: Props) {
  const [preview, setPreview] = useState<CloudPreview>();
  const [contactEmail, setContactEmail] = useState<string>();
  const [grounded, setGrounded] = useState<Awaited<ReturnType<typeof searchApproved>>>();
  const [explanation, setExplanation] = useState<Awaited<ReturnType<typeof explainWarning>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const contact = useRef<HTMLDetailsElement>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!openContact || !contact.current) return;
    contact.current.open = true;
    contact.current.scrollIntoView({ block: "nearest" });
    contact.current.querySelector("summary")?.focus();
  }, [openContact]);
  useEffect(() => {
    if (!db || !user || !online || !approvedCloudEnabled) return;
    return watchCircle(db, user.uid, (circle) => setContactEmail(circle?.contactEmail), () => undefined);
  }, [user, online]);

  function openPreview() {
    setError("");
    setPreview(prepareCloudPreview(card.text, {
      senderEmail: card.senderEmail,
      profile: { name: user?.displayName ?? undefined, email: user?.email ?? undefined, phone: user?.phoneNumber ?? undefined },
      trustedContact: { email: contactEmail },
    }));
  }

  async function run(operation: (signal: AbortSignal) => Promise<void>, message: string) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      await operation(controller.signal);
    } catch {
      if (!controller.signal.aborted) setError(message);
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function send(search: boolean) {
    if (!preview || !online || !user) return;
    await run(async (signal) => {
      if (search) {
        const result = await searchApproved(preview, signal);
        if (!signal.aborted) setGrounded(result);
      } else {
        const result = await checkApproved(preview, signal);
        if (!signal.aborted) {
          setGrounded(undefined);
          setExplanation(undefined);
          onCloudResult(result);
        }
      }
      if (!signal.aborted) setPreview(undefined);
    }, search ? "Couldn’t get a search result with sources. Your earlier check is still here." : "Couldn’t complete the cloud check. Your earlier check is still here.");
  }

  return (
    <div className="card-actions">
      {check.screening.tactics.length > 0 && (
        <button type="button" disabled={busy} onClick={() => void run(async (signal) => {
          const reply = await explainWarning(check.screening, signal);
          if (!signal.aborted) setExplanation(reply);
        }, "Couldn’t explain this warning. Try again.")}>
          Why is this risky?
        </button>
      )}
      {explanation && (
        <section aria-label="Explanation">
          <p className="method">{explanation.source}</p>
          <p className="model-text">{explanation.text}</p>
        </section>
      )}
      {approvedCloudEnabled && (preview === undefined ? (
        <button type="button" disabled={busy || !online} onClick={user ? openPreview : onSignIn}>
          {user ? "Check deeper" : "Sign in for a cloud check"}
        </button>
      ) : (
        <section aria-label="Review what will be sent">
          <h2>Review before sending</h2>
          <p>This goes to Google’s Gemini service. Check that the copy below leaves out anything you want to keep private.</p>
          <pre>{preview}</pre>
          <div className="buttons">
            <button type="button" className="primary" disabled={busy || !online} onClick={() => void send(false)}>Send this text</button>
            <button type="button" disabled={busy || !online} onClick={() => void send(true)}>Send and search</button>
            <button type="button" disabled={busy} onClick={() => { setPreview(undefined); setError(""); }}>Cancel</button>
          </div>
        </section>
      ))}
      {busy && <p role="status">Working…</p>}
      {error && <p role="alert">{error}</p>}
      {grounded && <GroundedResult {...grounded} />}
      <details ref={contact} className="contact">
        <summary>Ask my trusted contact</summary>
        {db ? (
          <TrustedContact db={db} user={user} onSignIn={onSignIn} ai={privateAI} cardId={card.id}
            screening={check.screening} message={card.text} channel={card.channel}
            sentRequestId={card.request?.uid === user?.uid ? card.request?.id : undefined}
            onRequestSent={(requestId) => {
              if (!user) return;
              void chrome.runtime.sendMessage({ type: "request-sent", tabId, cardId: card.id, requestId, uid: user.uid } satisfies ExtensionMessage)
                .catch(() => undefined);
            }} />
        ) : <p>Trusted contacts are unavailable in this build.</p>}
      </details>
    </div>
  );
}
