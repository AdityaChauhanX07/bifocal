import {
  messageLimit, nextSteps, prepareCloudPreview, riskLabels, screenApprovedPreview,
  screenPrivateText, screenSample, tacticDescriptions, trySamples,
} from "@bifocal/core";
import type { CloudPreview, ScreeningResult, TrySampleId } from "@bifocal/core";
import { useState } from "react";
import {
  pastedCloudEnabled, runScreening, sampleCloudEnabled,
} from "./model";

const sourceLabels = {
  "on-device": "Checked on this device",
  cloud: "Checked with Google Gemini",
  basic: "Basic check only",
} as const;

function RiskCard({ result }: { result: ScreeningResult }) {
  const { screening, source } = result;
  return (
    <section className="request-card grid gap-3" aria-label="Screening result">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="risk" data-tier={screening.tier}>{riskLabels[screening.tier]}</span>
        <span className="meta">{sourceLabels[source]}</span>
      </div>
      {source === "basic" && (
        <p className="meta">This check looks for a few common scam patterns.</p>
      )}
      {screening.evidence_quote && <blockquote className="try-quote">{screening.evidence_quote}</blockquote>}
      {!!screening.tactics.length && (
        <ul className="list-disc pl-6">
          {[...new Set(screening.tactics)].map((tactic) => <li key={tactic}>{tacticDescriptions[tactic]}</li>)}
        </ul>
      )}
      <div>
        <h3>What to do</h3>
        <p>{nextSteps[screening.next_step]}</p>
      </div>
    </section>
  );
}

export function TryPage() {
  const [sampleId, setSampleId] = useState<TrySampleId>(trySamples[0].id);
  const [pasting, setPasting] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScreeningResult>();
  const [preview, setPreview] = useState<CloudPreview>();
  const [running, setRunning] = useState<"check" | "cloud">();
  const [error, setError] = useState("");
  const sample = trySamples.find((example) => example.id === sampleId) ?? trySamples[0];

  function clearCheck() {
    setResult(undefined);
    setPreview(undefined);
    setError("");
  }

  async function check() {
    const text = message.trim();
    if (running || (pasting && !text)) return;
    clearCheck();
    setRunning("check");
    try {
      setResult(pasting
        ? await screenPrivateText(text, runScreening)
        : await screenSample(sampleId, runScreening));
    } finally {
      setRunning(undefined);
    }
  }

  async function sendPreview() {
    if (!preview || running) return;
    setError("");
    setRunning("cloud");
    try {
      setResult(await screenApprovedPreview(preview, runScreening));
      setPreview(undefined);
    } catch {
      setError("The cloud check couldn’t finish. Your previous result is still below.");
    } finally {
      setRunning(undefined);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="page-width try-width wordmark">
          <span className="lenses" aria-hidden="true" />
          Bifocal
          <nav className="ml-auto flex flex-wrap gap-3" aria-label="Bifocal pages">
            <a className="meta underline" href="/eval">Evaluation</a>
            <a className="meta underline" href="/">Dashboard</a>
          </nav>
        </div>
      </header>
      <main className="page-width try-width">
        <h1 className="try-title">Check a message</h1>
        <p>Try a sample or paste a message to see what Bifocal flags.</p>
        <div className="try-workbench">
          <aside className="empty-state">
            <h2>Sample messages</h2>
            <div className="try-choices grid gap-1.5">
              {trySamples.map((example) => (
                <button className="try-sample" type="button" key={example.id} disabled={!!running}
                  aria-pressed={!pasting && sampleId === example.id}
                  onClick={() => {
                    setSampleId(example.id);
                    setPasting(false);
                    clearCheck();
                  }}>
                  {example.label}
                </button>
              ))}
            </div>
          </aside>
          <div className="grid gap-4">
            <section className="empty-state grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="!mb-0">{pasting ? "Your message" : sample.label}</h2>
                {!pasting && (
                  <button className="secondary" type="button" disabled={!!running} onClick={() => {
                    setPasting(true);
                    clearCheck();
                  }}>Paste a message</button>
                )}
              </div>
              {pasting ? (
                <textarea rows={5} aria-label="Your message" autoFocus placeholder="Paste an email or text message"
                  maxLength={messageLimit} value={message} disabled={!!running}
                  spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="off"
                  onChange={(event) => {
                    setMessage(event.target.value);
                    clearCheck();
                  }} />
              ) : <p className="try-message">{sample.text}</p>}
              <p className="meta">
                {pasting
                  ? pastedCloudEnabled
                    ? "Bifocal checks your message on this device. You can review and approve a redacted cloud check separately."
                    : "Bifocal checks pasted messages on this device."
                  : sampleCloudEnabled
                    ? "This fictional sample may be checked with Google Gemini if a local check is unavailable."
                    : "This is a fictional sample message."}
              </p>
              <button className="primary justify-self-start" type="button" disabled={!!running || (pasting && !message.trim())}
                onClick={() => void check()}>
                {running === "check" ? "Checking…" : pasting ? "Check privately" : "Check sample"}
              </button>
            </section>

            {pasting && pastedCloudEnabled && result?.source === "basic" && !preview && (
              <button type="button" className="secondary justify-self-start" onClick={() => {
                setPreview(prepareCloudPreview(message.trim()));
              }}>Preview a cloud check</button>
            )}
            {preview && (
              <section className="notice grid gap-3" aria-label="Cloud preview">
                <h2>Review before sending</h2>
                <p>Check the text below for private details. This is the text Bifocal will send to Google Gemini.</p>
                <p className="try-message">{preview}</p>
                <p className="meta">Under the paid Gemini service terms, Google does not use this text to improve its products and may keep it briefly to prevent abuse.</p>
                <div className="flex flex-wrap gap-2">
                  <button className="primary !mt-0" type="button" disabled={!!running}
                    onClick={() => void sendPreview()}>{running === "cloud" ? "Sending…" : "Send this text"}</button>
                  <button className="secondary !mt-0" type="button" disabled={!!running} onClick={() => {
                    setPreview(undefined);
                    setError("");
                  }}>Cancel</button>
                </div>
                {error && <p className="error" role="alert">{error}</p>}
              </section>
            )}
            <div aria-live="polite">{result && <RiskCard result={result} />}</div>
          </div>
        </div>
      </main>
    </>
  );
}
