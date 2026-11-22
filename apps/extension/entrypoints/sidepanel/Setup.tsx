import { useEffect, useState } from "react";
import { pageCheckScript, pageOrigins, registerPageChecks } from "../../lib/page-checks";

type PromptApi = {
  availability(): Promise<string>;
  create(options: { monitor(monitor: EventTarget): void }): Promise<{ destroy(): void }>;
};

const promptApi = (globalThis as typeof globalThis & { LanguageModel?: PromptApi }).LanguageModel;

export function Setup({ onModelReady }: { onModelReady: () => void }) {
  const [model, setModel] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const [pageChecks, setPageChecks] = useState(false);
  const [pagesBusy, setPagesBusy] = useState(false);
  const [pageStatus, setPageStatus] = useState("");

  useEffect(() => {
    void promptApi?.availability().then(setModel, () => setModel("unavailable"));
    void chrome.scripting.getRegisteredContentScripts({ ids: [pageCheckScript] })
      .then((scripts) => setPageChecks(scripts.length > 0));
  }, []);

  async function download() {
    if (!promptApi) return;
    setProgress(0);
    try {
      const session = await promptApi.create({
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            setProgress(Math.round((event as ProgressEvent).loaded * 100));
          });
        },
      });
      session.destroy();
      setModel("available");
      onModelReady();
    } catch {
      setModel("failed");
    } finally {
      setProgress(undefined);
    }
  }

  async function togglePages() {
    setPagesBusy(true);
    setPageStatus("");
    try {
      if (pageChecks) {
        await chrome.permissions.remove({ origins: pageOrigins });
        setPageChecks(false);
      } else if (await chrome.permissions.request({ origins: pageOrigins })) {
        try {
          await registerPageChecks();
        } catch (error) {
          await chrome.permissions.remove({ origins: pageOrigins });
          throw error;
        }
        setPageChecks(true);
        setPageStatus("Reload your current page to start using Pause there.");
      }
    } catch {
      setPageStatus("Couldn’t change page checks. Try again.");
    } finally {
      setPagesBusy(false);
    }
  }

  return (
    <details className="card settings">
      <summary>Settings</summary>
      <h2>Private checks</h2>
      {model === "available" ? <p>This computer is ready for private AI checks.</p> : (
        promptApi && model !== "unavailable" ? (
          <>
            <p>Chrome can download a model for private checks, including when you’re offline.</p>
            <button type="button" disabled={progress !== undefined} onClick={() => void download()}>Get Bifocal ready</button>
            {progress !== undefined && <progress aria-label="Model download" value={progress} max="100" />}
            {model === "failed" && <p role="status">Chrome couldn’t finish setup. You can try again when you’re connected.</p>}
          </>
        ) : <p>This Chrome profile uses the basic check.</p>
      )}
      <h2>Pause on websites</h2>
      <p>Allow site access to check pages with payment, sign-in, or download signals and pause at risky actions.</p>
      <button type="button" disabled={pagesBusy} onClick={() => void togglePages()}>
        {pageChecks ? "Turn off website checks" : "Enable website checks"}
      </button>
      {pageStatus && <p role="status">{pageStatus}</p>}
    </details>
  );
}
