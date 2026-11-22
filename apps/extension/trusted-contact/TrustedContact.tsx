import { replyPresets, requestChannels, riskLabels, tacticDescriptions } from "@bifocal/core";
import type { ContactReply, ContactRequest, RequestChannel, Screening } from "@bifocal/core";
import type { AI } from "firebase/ai";
import type { Firestore } from "firebase/firestore";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { requestRef, saveInvitation, sendRequest, watchCircle, watchReply } from "./store.ts";
import type { Circle } from "./store.ts";
import { prepareRequest } from "./summary.ts";

interface Props {
  cardId: string;
  user: { uid: string; email: string | null } | null;
  db: Firestore;
  ai?: AI;
  message: string;
  screening: Screening;
  channel: RequestChannel;
  onSignIn?: () => void;
  sentRequestId?: string;
  onRequestSent?: (requestId: string) => void;
}

function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

function ContactActions({
  db, user, ai, message, screening, channel, sentRequestId, onRequestSent,
}: Omit<Props, "user"> & { user: NonNullable<Props["user"]> }) {
  const uid = user.uid;
  const headingId = useId();
  const emailId = useId();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine);
  const [circle, setCircle] = useState<Circle | null>();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [draftRef] = useState(() => requestRef(db, uid));
  const [preview, setPreview] = useState<ContactRequest>();
  const [sent, setSent] = useState(() => sentRequestId ? requestRef(db, uid, sentRequestId) : undefined);
  const [reply, setReply] = useState<ContactReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sent && online) {
      return watchCircle(db, uid, setCircle, () => setError("Couldn’t check your trusted contact."));
    }
  }, [db, uid, online, sent]);

  useEffect(() => {
    if (sent && online) {
      return watchReply(sent, setReply, () => setError("Couldn’t check for a reply."));
    }
  }, [sent, online]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const contactEmail = email.trim().toLowerCase();
    if (contactEmail === user.email?.toLowerCase()) {
      setError("Enter your trusted contact’s email address.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await saveInvitation(db, uid, contactEmail);
      setEditing(false);
    } catch {
      setError("Couldn’t save the invitation. Check the email address and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openPreview() {
    if (busy || !circle?.contactUid) return;
    setBusy(true);
    setError("");
    try {
      const draft = await prepareRequest(screening, channel, message, ai);
      setPreview(draft);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSend() {
    if (busy || !online || !preview) return;
    setBusy(true);
    setError("");
    try {
      await sendRequest(draftRef, preview);
    } catch {
      setError("Couldn’t confirm the request was sent. Check your connection and try again.");
      return;
    } finally {
      setBusy(false);
    }

    setSent(draftRef);
    setPreview(undefined);
    onRequestSent?.(draftRef.id);
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-3 border-t py-4">
      <h3 id={headingId} className="font-semibold">Ask my trusted contact</h3>
      {!online && (
        <p role="status">Connect to the internet to send a request or check for replies.</p>
      )}
      {sent ? (
        reply ? (
          <div role="status">
            <p className="font-semibold">Your trusted contact replied</p>
            {reply.replyPreset && <p>{replyPresets[reply.replyPreset]}</p>}
            {reply.replyNote && <p>{reply.replyNote}</p>}
          </div>
        ) : <p role="status">Request sent. Waiting for a reply.</p>
      ) : preview ? (
        <div className="grid gap-3">
          <p className="font-semibold">Preview for {circle?.contactEmail}</p>
          <p>{riskLabels[preview.tier]} · {requestChannels[preview.channel]}</p>
          <p>{preview.summary}</p>
          {preview.tactics.length > 2 && (
            <details>
              <summary>All warning signs</summary>
              <ul className="list-disc pl-6">
                {preview.tactics.map((tactic) => <li key={tactic}>{tacticDescriptions[tactic]}</li>)}
              </ul>
            </details>
          )}
          <p>The time is added when you send.</p>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-11 rounded-lg bg-slate-800 px-4 text-white disabled:opacity-60" type="button"
              disabled={busy || !online} onClick={() => void confirmSend()}>
              {busy ? "Sending…" : "Send request"}
            </button>
            <button className="min-h-11 px-3 underline" type="button" disabled={busy}
              onClick={() => { setPreview(undefined); setError(""); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : circle === undefined ? (
        online && !error && <p role="status">Checking your trusted contact…</p>
      ) : circle?.contactUid ? (
        <button type="button" className="min-h-11 justify-self-start rounded-lg bg-slate-800 px-4 text-white"
          disabled={busy} onClick={() => void openPreview()}>
          {busy ? "Preparing preview…" : "Preview a request"}
        </button>
      ) : editing ? (
        <form className="grid gap-2" onSubmit={invite}>
          <label htmlFor={emailId}>Trusted contact’s Google email</label>
          <input className="min-h-11 rounded-lg border px-3" id={emailId} type="email" required
            maxLength={254} value={email} disabled={busy}
            onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" className="min-h-11 justify-self-start rounded-lg bg-slate-800 px-4 text-white disabled:opacity-60"
            disabled={busy || !online}>
            {busy ? "Saving…" : "Save invitation"}
          </button>
        </form>
      ) : (
        <>
          {circle && <p>Waiting for {circle.contactEmail} to sign in to the Bifocal dashboard.</p>}
          <button type="button" className="min-h-11 justify-self-start underline"
            onClick={() => { setEmail(circle?.contactEmail ?? ""); setEditing(true); setError(""); }}>
            {circle ? "Change invited email" : "Add a trusted contact"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function TrustedContact({ user, onSignIn, ...props }: Props) {
  if (user) {
    return <ContactActions key={JSON.stringify([user.uid, props.cardId])} user={user} {...props} />;
  }
  return (
    <section className="grid gap-2 border-t py-4">
      <h3 className="font-semibold">Ask my trusted contact</h3>
      <p>Sign in to send a request to someone you trust.</p>
      {onSignIn && (
        <button className="min-h-11 justify-self-start underline" type="button" onClick={onSignIn}>Sign in</button>
      )}
    </section>
  );
}
