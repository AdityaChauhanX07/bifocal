import { useEffect, useState } from "react";
import { checkWebsiteTab, pageCheckScript, pageOrigins, registerPageChecks } from "../../lib/page-checks";

export type ModelAvailability = "unavailable" | "downloadable" | "downloading" | "available";

type PromptApi = {
  availability(): Promise<ModelAvailability>;
  create(options: { monitor(monitor: EventTarget): void }): Promise<{ destroy(): void }>;
};

const promptApi = (globalThis as typeof globalThis & { LanguageModel?: PromptApi }).LanguageModel;

const pageMessages = {
  ready: "Website checks are active on this tab.",
  "choose-tab": "Open the website you want to check in a Chrome tab, then choose Check this tab.",
  "access-needed": "Chrome hasn’t granted access to this tab. Open a regular website or check Bifocal’s site access in Chrome’s Extensions menu.",
  unavailable: "Bifocal couldn’t start the check. Refresh the website tab and try again.",
};

export function Setup({ tabId, model, online, onModelChange }: {
  tabId?: number;
  model?: ModelAvailability;
  online: boolean;
  onModelChange: (availability: ModelAvailability) => void;
}) {
  const [progress, setProgress] = useState<number | null>();
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [pageChecks, setPageChecks] = useState(false);
  const [pagesBusy, setPagesBusy] = useState(false);
  const [pageStatus, setPageStatus] = useState<{ tabId?: number; text: string }>();
  const downloading = progress !== undefined;
  const canSetUp = model === "downloadable" || model === "downloading";

  useEffect(() => {
    let closed = false;
    const report = (availability: ModelAvailability) => {
      if (!closed) onModelChange(availability);
    };
    if (promptApi) void promptApi.availability().then(report, () => report("unavailable"));
    else report("unavailable");
    return () => { closed = true; };
  }, [onModelChange]);

  useEffect(() => {
    void chrome.scripting.getRegisteredContentScripts({ ids: [pageCheckScript] })
      .then((scripts) => setPageChecks(scripts.length > 0));
  }, []);

  useEffect(() => {
    function clearOnNavigation(id: number, change: chrome.tabs.OnUpdatedInfo) {
      if (id === tabId && change.status === "loading") setPageStatus(undefined);
    }
    chrome.tabs.onUpdated.addListener(clearOnNavigation);
    return () => chrome.tabs.onUpdated.removeListener(clearOnNavigation);
  }, [tabId]);

  async function download() {
    if (!promptApi || !online || downloading) return;
    setProgress(null);
    setDownloadFailed(false);
    try {
      const session = await promptApi.create({
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            setProgress(Math.round((event as ProgressEvent).loaded * 100));
          });
        },
      });
      session.destroy();
      onModelChange("available");
    } catch {
      setDownloadFailed(true);
    } finally {
      setProgress(undefined);
    }
  }

  async function togglePages() {
    setPagesBusy(true);
    setPageStatus(undefined);
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
        setPageStatus({ tabId, text: pageMessages[await checkWebsiteTab(tabId)] });
      }
    } catch {
      setPageStatus({ tabId, text: "Couldn’t change page checks. Try again." });
    } finally {
      setPagesBusy(false);
    }
  }

  async function checkTab() {
    setPagesBusy(true);
    try {
      setPageStatus({ tabId, text: pageMessages[await checkWebsiteTab(tabId)] });
    } catch {
      setPageStatus({ tabId, text: pageMessages.unavailable });
    } finally {
      setPagesBusy(false);
    }
  }

  return <>
    {canSetUp && (
      <section className="card settings" aria-labelledby="private-setup">
        <h2 id="private-setup">Set up private AI checks</h2>
        <p>After a one-time Chrome download, Bifocal can use AI to check messages even when you’re offline.</p>
        {!online && <p role="status">Connect to the internet to download. The basic check still works offline.</p>}
        {downloading ? (
          <progress aria-label="Chrome model download" value={progress ?? undefined} max="100" />
        ) : (
          <button className="primary" type="button" disabled={!online} onClick={() => void download()}>
            {downloadFailed ? "Try download again" : "Get Bifocal ready"}
          </button>
        )}
        {downloadFailed && online && <p role="status">Chrome couldn’t finish the download. You can try again.</p>}
      </section>
    )}
    <details className="card settings">
      <summary>Settings</summary>
      {model === "available" && <p>This computer is ready for private AI checks.</p>}
      {model === "unavailable" && <p>This Chrome profile uses the basic check.</p>}
      <h2>Pause on websites</h2>
      <p>Allow site access to check pages with payment, sign-in, or download signals and pause at risky actions.</p>
      <div className="buttons">
        {pageChecks && <button type="button" disabled={pagesBusy} onClick={() => void checkTab()}>Check this tab</button>}
        <button type="button" disabled={pagesBusy} onClick={() => void togglePages()}>
          {pageChecks ? "Turn off website checks" : "Enable website checks"}
        </button>
      </div>
      {pageStatus && pageStatus.tabId === tabId && <p role="status">{pageStatus.text}</p>}
    </details>
  </>;
}
