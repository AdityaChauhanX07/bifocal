import { useEffect, useState, useSyncExternalStore } from "react";
import { nextSteps, riskLabels, screenPrivateText, tacticDescriptions } from "@bifocal/core";
import type { ScreeningResult } from "@bifocal/core";
import { onAuthStateChanged } from "firebase/auth/web-extension";
import type { User } from "firebase/auth/web-extension";
import type { Card, ExtensionMessage } from "../../lib/card";
import { cardKey, contactKey } from "../../lib/card";
import { privateModel } from "../../lib/private-model";
import { auth, emulatorMode, signIn, signOutAccount } from "../../lib/firebase";
import { syncSettings } from "../../lib/settings";
import { CardActions } from "./CardActions";
import { Setup, type ModelAvailability } from "./Setup";

function onlineEvents(refresh: () => void) {
  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);
  return () => {
    window.removeEventListener("online", refresh);
    window.removeEventListener("offline", refresh);
  };
}

function useTabCard() {
  const [tabId, setTabId] = useState<number>();
  const [selection, setSelection] = useState<{ tabId: number; card?: Card; askContact?: boolean }>();

  useEffect(() => {
    let closed = false;
    function refreshTab() {
      void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!closed) setTabId(tab?.id);
      }).catch(() => undefined);
    }
    chrome.tabs.onActivated.addListener(refreshTab);
    refreshTab();
    return () => { closed = true; chrome.tabs.onActivated.removeListener(refreshTab); };
  }, []);

  useEffect(() => {
    if (tabId === undefined) return;
    const selected = tabId;
    const key = cardKey(tabId);
    const contact = contactKey(tabId);
    let sawCard = false;
    let sawContact = false;
    let closed = false;
    function storageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string) {
      if (area !== "session" || (!(key in changes) && !(contact in changes))) return;
      sawCard ||= key in changes;
      sawContact ||= contact in changes;
      setSelection((previous) => ({
        tabId: selected,
        card: key in changes ? changes[key].newValue as Card | undefined : previous?.tabId === selected ? previous.card : undefined,
        askContact: contact in changes ? Boolean(changes[contact].newValue) : previous?.tabId === selected && previous.askContact,
      }));
    }
    chrome.storage.onChanged.addListener(storageChanged);
    void chrome.storage.session.get([key, contact]).then((stored) => {
      if (closed) return;
      setSelection((previous) => ({
        tabId,
        card: sawCard ? previous?.card : stored[key] as Card | undefined,
        askContact: sawContact ? previous?.askContact : Boolean(stored[contact]),
      }));
    });
    return () => { closed = true; chrome.storage.onChanged.removeListener(storageChanged); };
  }, [tabId]);

  return { tabId, card: selection?.tabId === tabId ? selection?.card : undefined, askContact: selection?.tabId === tabId && !!selection?.askContact };
}

export function Panel() {
  const { tabId, card, askContact } = useTabCard();
  const [model, setModel] = useState<ModelAvailability>();
  const [user, setUser] = useState<User | null>(null);
  const [signInError, setSignInError] = useState("");
  const online = useSyncExternalStore(onlineEvents, () => navigator.onLine);

  useEffect(() => auth ? onAuthStateChanged(auth, setUser) : undefined, []);
  useEffect(() => { void syncSettings().catch(() => undefined); }, [online]);

  async function signInOwner() {
    setSignInError("");
    try {
      await signIn();
    } catch {
      setSignInError(emulatorMode ? "Couldn’t sign in. Check that the local Auth emulator is running."
        : "Couldn’t sign in with Google. Check your connection and try again.");
    }
  }

  useEffect(() => {
    if (!card || tabId === undefined || !model || card.result.source === "on-device") return;
    if (model !== "available" && card.privateCheckFinished) return;
    const controller = new AbortController();
    const check = model === "available"
      ? screenPrivateText(card.text, privateModel(controller.signal))
      : Promise.resolve(card.result);
    void check.then((result) => {
      if (controller.signal.aborted) return;
      return chrome.runtime.sendMessage({
        type: "private-result", tabId, cardId: card.id, result,
      } satisfies ExtensionMessage);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [card?.id, tabId, model]);

  return (
    <main>
      <header className="brand"><span aria-hidden="true" className="lenses" /> Bifocal</header>
      {emulatorMode && <p className="method">Local Firebase emulators</p>}
      {card && tabId !== undefined ? (
        <RiskCard key={JSON.stringify([card.id, user?.uid])} card={card} tabId={tabId} user={user} online={online}
          askContact={askContact} onSignIn={() => void signInOwner()} />
      ) : (
        <section className="card">
          <h1>Check a message</h1>
          <p>Open a message in Gmail or a conversation in Google Messages. The result appears here.</p>
        </section>
      )}
      {signInError && <p role="alert">{signInError}</p>}
      {auth && <section className="card settings" aria-label="Account">
        {user ? (
          <><p>Signed in as {user.email}</p><button type="button" onClick={() => {
            void signOutAccount().catch(() => setSignInError("Couldn’t sign out. Try again."));
          }}>Sign out</button></>
        ) : <button type="button" disabled={!online} onClick={() => void signInOwner()}>
          {emulatorMode ? "Sign in as demo owner" : "Sign in with Google"}
        </button>}
      </section>}
      <Setup tabId={tabId} model={model} online={online} onModelChange={setModel} />
    </main>
  );
}

function RiskCard({ card, tabId, user, online, askContact, onSignIn }: {
  card: Card;
  tabId: number;
  user: User | null;
  online: boolean;
  askContact: boolean;
  onSignIn: () => void;
}) {
  const [cloud, setCloud] = useState<ScreeningResult>();
  const check = cloud ?? card.result;
  const { screening } = check;
  const method = check.source === "cloud" ? "Checked in the cloud with your permission"
    : check.source === "on-device" ? "Checked privately on this computer"
    : card.privateCheckFinished ? "Basic check only" : "Basic check · Checking privately…";

  return (
    <article className="card" data-tier={screening.tier}>
      <p className="method" role="status">{method}</p>
      <h1>{riskLabels[screening.tier]}</h1>
      <p className="next-step">{nextSteps[screening.next_step]}</p>
      {screening.evidence_quote && <blockquote>{screening.evidence_quote}</blockquote>}
      {screening.tactics.length > 0 && (
        <ul>{screening.tactics.map((tactic) => <li key={tactic}>{tacticDescriptions[tactic]}</li>)}</ul>
      )}
      <CardActions card={card} tabId={tabId} check={check} user={user} online={online} openContact={askContact}
        onSignIn={onSignIn} onCloudResult={setCloud} />
    </article>
  );
}
