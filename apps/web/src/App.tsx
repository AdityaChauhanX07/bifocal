import { replyPresets, requestChannels, riskLabels, tacticDescriptions } from "@bifocal/core";
import type { ReplyPreset } from "@bifocal/core";
import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { sendReply, watchInbox } from "./requests";
import type { HelpRequest, Inbox, Reply } from "./requests";
import { newRequestCount, pendingPaths } from "./new-requests";
import { disablePush } from "./push";
import { PushNotifications } from "./PushNotifications";
import { InstallButton } from "./InstallButton";

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function RequestCard({ request }: { request: HelpRequest }) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function reply(choice: Reply) {
    setSending(true);
    setError("");
    try {
      await sendReply(request.ref, choice);
    } catch {
      setError("Your reply didn’t send. Keep it short, leave out links, and try again.");
    } finally {
      setSending(false);
    }
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const replyNote = note.trim();
    if (replyNote) void reply({ replyNote });
  }

  return (
    <article className="request-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="risk" data-tier={request.tier}>{riskLabels[request.tier]}</span>
        <span className="meta">{requestChannels[request.channel]}</span>
        <time className="meta" dateTime={request.createdAt.toDate().toISOString()}>
          {dateTime.format(request.createdAt.toDate())}
        </time>
      </div>
      <p className="request-summary">{request.summary}</p>
      {request.tactics.length > 0 && (
        <div className="warnings">
          <h3>Warning signs</h3>
          <ul>
            {[...new Set(request.tactics)].map((tactic) => <li key={tactic}>{tacticDescriptions[tactic]}</li>)}
          </ul>
        </div>
      )}
      {request.status === "replied" ? (
        <div className="sent" role="status">
          <h3>Reply sent</h3>
          {request.replyPreset && <p>{replyPresets[request.replyPreset]}</p>}
          {request.replyNote && <p>{request.replyNote}</p>}
        </div>
      ) : (
        <div className="reply">
          <h3>Send a reply</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(replyPresets) as ReplyPreset[]).map((preset) => (
              <button
                className={preset === "call_me" ? "primary" : "secondary"}
                type="button"
                key={preset}
                onClick={() => void reply({ replyPreset: preset })}
                disabled={sending}
              >
                {replyPresets[preset]}
              </button>
            ))}
          </div>
          <details>
            <summary>Write a note</summary>
            <form className="grid gap-3" onSubmit={submitNote}>
              <label className="sr-only" htmlFor={request.ref.path}>Reply note</label>
              <textarea
                id={request.ref.path}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={280}
                rows={3}
                disabled={sending}
                aria-describedby={request.ref.path + "/hint"}
              />
              <p className="meta" id={request.ref.path + "/hint"}>Up to 280 characters. Leave out links.</p>
              <button className="primary justify-self-start" disabled={sending || !note.trim()}>Send note</button>
            </form>
          </details>
          {sending && <p role="status" className="meta">Sending your reply…</p>}
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      )}
    </article>
  );
}

function RequestList({
  db, user, authBusy, onPushBusy,
}: { db: Firestore; user: User; authBusy: boolean; onPushBusy: (busy: boolean) => void }) {
  const [inbox, setInbox] = useState<Inbox>({ loading: true, circleCount: 0, requests: [] });
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const seenPending = useRef<Set<string> | null>(null);
  const [arrivals, setArrivals] = useState(0);

  useEffect(() => {
    let active = true;
    const stop = watchInbox(
      db, user,
      (current) => {
        if (!active) return;
        setInbox(current);
        if (current.loading) return;
        const next = pendingPaths(current);
        const count = seenPending.current ? newRequestCount(seenPending.current, next) : 0;
        seenPending.current = next;
        if (count) setArrivals((total) => total + count);
      },
      () => { if (active) setFailed(true); },
    );
    return () => {
      active = false;
      stop();
    };
  }, [db, user, attempt]);

  function reconnect() {
    seenPending.current = null;
    setArrivals(0);
    setInbox({ loading: true, circleCount: 0, requests: [] });
    setFailed(false);
    setAttempt((count) => count + 1);
  }

  return (
    <>
      {failed && (
        <div className="notice">
          <p role="alert">Bifocal couldn’t load your requests. Check your connection and try again.</p>
          <button className="secondary" onClick={reconnect}>Try again</button>
        </div>
      )}
      {!failed && inbox.loading && <p role="status">Checking for invitations and requests…</p>}
      {!failed && !inbox.loading && inbox.requests.length === 0 && (
        <section className="empty-state" role="status">
          <h2>{inbox.circleCount ? "No requests yet" : "Waiting for an invitation"}</h2>
          <p>
            {inbox.circleCount
              ? "When someone asks for your help, the request will appear here."
              : "Ask the person you support to add your Google email as their trusted contact."}
          </p>
        </section>
      )}
      {inbox.circleCount > 0 && user.emailVerified && (
        <PushNotifications db={db} user={user} disabled={authBusy} onBusyChange={onPushBusy} />
      )}
      {arrivals > 0 && (
        <div className="account notice">
          <p role="status">{arrivals === 1 ? "A new help request arrived." : `${arrivals} new help requests arrived.`}</p>
          <button className="secondary" onClick={() => setArrivals(0)}>Dismiss</button>
        </div>
      )}
      {inbox.requests.map((request) => <RequestCard key={request.ref.path} request={request} />)}
    </>
  );
}

function Dashboard({ auth, db }: { auth: Auth; db: Firestore }) {
  const [user, setUser] = useState<User | null>();
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), [auth]);

  async function changeSignIn() {
    setBusy(true);
    setError("");
    try {
      if (user) {
        await disablePush(db, user.uid);
        await signOut(auth);
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
    } catch (err) {
      if (!(err instanceof FirebaseError) || err.code !== "auth/popup-closed-by-user") {
        setError(user ? "Bifocal couldn’t sign you out. Try again." : "Google sign-in didn’t finish. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) return <p role="status">Opening your dashboard…</p>;

  return (
    <div className="grid gap-5">
      {user ? (
        <>
          <div className="account">
            <p className="meta">Signed in as <strong>{user.email}</strong></p>
            <button className="secondary" onClick={changeSignIn} disabled={busy || pushBusy}>Sign out</button>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <RequestList key={user.uid} db={db} user={user} authBusy={busy} onPushBusy={setPushBusy} />
        </>
      ) : (
        <section className="empty-state grid gap-4">
          <p>Sign in with the Google account your family or friend invited to see their requests.</p>
          <button className="primary justify-self-start" onClick={changeSignIn} disabled={busy}>
            {busy ? "Opening Google sign-in…" : "Sign in with Google"}
          </button>
          {error && <p role="alert" className="error">{error}</p>}
        </section>
      )}
    </div>
  );
}

export function App({ firebase }: { firebase: { auth: Auth; db: Firestore } | null }) {
  return (
    <>
      <header className="site-header">
        <div className="page-width wordmark">
          <span className="lenses" aria-hidden="true" />
          Bifocal
          <a href="/try" className="meta underline">Try Bifocal</a>
          <InstallButton />
        </div>
      </header>
      <main className="page-width">
        <h1>Help requests</h1>
        {firebase ? <Dashboard {...firebase} /> : (
          <p role="alert">Dashboard setup is incomplete. Add the Firebase web app settings and rebuild.</p>
        )}
      </main>
    </>
  );
}
