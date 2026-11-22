import { deviceModelReady, riskLabels, tacticDescriptions } from "@bifocal/core";
import { useEffect, useRef, useState } from "react";
import { cloudScreeningEnabled, prepareCloudScreening, runModel } from "../screening-model";
import { heldOut } from "./dataset";
import { evalPaths, paceCloudRequests, runEvaluation, summarize, toCsv } from "./runner";
import type { EvalPath, EvalRow } from "./runner";

function formatRate(count: number, total: number) {
  return total ? `${Math.round(count / total * 100)}% (${count}/${total})` : "—";
}

function Results({ rows }: { rows: EvalRow[] }) {
  const paths = evalPaths.map(({ id, label }) => {
    const attempted = rows.filter((row) => row.path === id);
    return { id, label, attempted: attempted.length, ...summarize(attempted) };
  });
  return (
    <section className="request-card grid gap-3" aria-labelledby="eval-results">
      <h2 id="eval-results">Results</h2>
      <p className="meta">Accuracy and latency use valid results only. Check the coverage before comparing paths.</p>
      <div className="eval-table-wrap" tabIndex={0} role="region" aria-label="Results table">
        <table className="eval-table">
          <thead>
            <tr>
              <th scope="col">Path</th>
              <th scope="col">Valid rows</th>
              <th scope="col">Scam catch</th>
              <th scope="col">False high risk</th>
              <th scope="col">Look-alike alarms</th>
              <th scope="col">Tier agreement</th>
              <th scope="col">Valid JSON</th>
              <th scope="col">Median latency</th>
            </tr>
          </thead>
          <tbody>
            {paths.map((path) => (
              <tr key={path.id}>
                <th scope="row">{path.label}</th>
                <td>{path.valid}/{heldOut.length}</td>
                <td>{formatRate(path.caught, path.scams)}</td>
                <td>{formatRate(path.falseHigh, path.legitimate)}</td>
                <td>{path.lookalikes ? `${path.alarms.length}/${path.lookalikes}` : "—"}</td>
                <td>{formatRate(path.tierAgreement, path.valid)}</td>
                <td>{formatRate(path.valid, path.returned)}</td>
                <td>{path.medianLatency === null ? "—" : `${Math.round(path.medianLatency)} ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paths.some((path) => path.attempted > path.valid) && (
        <p className="meta">{rows.filter((row) => row.status !== "valid").length} rows had errors or invalid results. The CSV includes their statuses.</p>
      )}
      {paths.map((path) => !!path.alarms.length && (
        <details key={path.id}>
          <summary>{path.label} · {path.alarms.length} look-alike alarms</summary>
          <ul className="grid gap-3 pl-4">
            {path.alarms.map(({ row, screening }) => (
              <li key={row.id}>
                <strong>{row.id} · {riskLabels[screening.tier]}</strong>
                <p className="meta">{row.text}</p>
                <p>{screening.tactics.map((tactic) => tacticDescriptions[tactic]).join(" ")}</p>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}

export function EvalPage() {
  const [selected, setSelected] = useState<EvalPath[]>(["on-device"]);
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [active, setActive] = useState<EvalPath>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const [paceCloud] = useState(() => paceCloudRequests());

  useEffect(() => () => controller.current?.abort(), []);

  function exportRows() {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bifocal-held-out-results.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function remaining(path: EvalPath) {
    const completed = new Set(rows.filter((row) => row.path === path).map((entry) => entry.row.id));
    return heldOut.filter((row) => !completed.has(row.id));
  }

  async function start() {
    if (controller.current) return;
    const paths = evalPaths.filter(({ id }) => selected.includes(id) && remaining(id).length);
    if (!paths.length) return;

    const task = new AbortController();
    controller.current = task;
    setError("");
    setMessage("");
    try {
      for (const { id } of paths) {
        const signal = task.signal;
        signal.throwIfAborted();
        setActive(id);
        if (id === "on-device") {
          if (!await deviceModelReady()) {
            setError("Gemini Nano isn’t ready in this browser. Open the page in Chrome with the model installed.");
            continue;
          }
        } else {
          if (!cloudScreeningEnabled || !navigator.onLine) {
            setError("Cloud evaluation needs an internet connection and the Firebase web setup.");
            continue;
          }
          try {
            await prepareCloudScreening();
          } catch {
            setError("Couldn’t sign in for cloud evaluation. Check Firebase’s anonymous sign-in setup.");
            break;
          }
        }

        await runEvaluation(id, remaining(id), runModel, {
          signal,
          beforeRow: id === "on-device" ? undefined : paceCloud,
          onRow: (row) => setRows((current) => [...current, row]),
        });
        setMessage("Selected checks finished.");
      }
    } catch {
      if (task.signal.aborted) setMessage("Run stopped. Completed rows are available to export or resume.");
      else setError("Couldn’t finish the evaluation. Completed rows are available to export.");
    } finally {
      controller.current = null;
      setActive(undefined);
    }
  }

  const activePath = evalPaths.find(({ id }) => id === active);
  return (
    <>
      <header className="site-header">
        <div className="page-width eval-width wordmark">
          <span className="lenses" aria-hidden="true" />
          Bifocal
          <a className="meta ml-auto underline" href="/try">Try Bifocal</a>
        </div>
      </header>
      <main className="page-width eval-width">
        <h1 className="try-title">Held-out evaluation</h1>
        <p>{heldOut.length} fictional messages across email, text, and web pages.</p>
        <div className="eval-grid">
          <section className="empty-state grid gap-4">
            <fieldset className="grid gap-2" disabled={!!active}>
              <legend className="font-semibold mb-2">Choose inference paths</legend>
              {evalPaths.map(({ id, label, detail }) => (
                <label className="eval-option" key={id}>
                  <input type="checkbox" checked={selected.includes(id)}
                    disabled={id !== "on-device" && !cloudScreeningEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelected((current) => checked ? [...current, id] : current.filter((path) => path !== id));
                    }} />
                  <span>
                    <strong>{label}</strong>
                    <span className="meta block">{detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="meta">
              {cloudScreeningEnabled
                ? "Each cloud path can make 65 Gemini requests. The page spaces them out to respect the rate limit."
                : "Cloud paths are available with Firebase anonymous sign-in and App Check configured."}
            </p>
            <div className="flex flex-wrap gap-2">
              {active ? (
                <button className="secondary" type="button" onClick={() => controller.current?.abort()}>Stop run</button>
              ) : (
                <button className="primary" type="button" onClick={() => void start()}
                  disabled={!selected.some((path) => remaining(path).length)}>Run selected paths</button>
              )}
              <button className="secondary" type="button" disabled={!rows.length} onClick={exportRows}>Download CSV</button>
              {!!rows.length && !active && (
                <button className="secondary" type="button" onClick={() => {
                  setRows([]);
                  setMessage("");
                  setError("");
                }}>Clear results</button>
              )}
            </div>
            {activePath ? (
              <p role="status" className="meta">{activePath.label} · {rows.filter(({ path }) => path === active).length}/{heldOut.length} checked</p>
            ) : message && <p role="status" className="meta">{message}</p>}
            {error && <p className="error" role="alert">{error}</p>}
          </section>
          <Results rows={rows} />
        </div>
      </main>
    </>
  );
}
