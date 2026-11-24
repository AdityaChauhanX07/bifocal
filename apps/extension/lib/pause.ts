import type { CheckNotice, ExtensionMessage } from "./card";
import { pauseReason, pauseReasons } from "./risky-page.ts";
import type { PauseReason } from "./risky-page.ts";

const holdMs = 5_000;

function promptPause(reason: PauseReason, finish: (choice: "back" | "contact" | "continue") => void) {
  const shell = document.createElement("bifocal-pause");
  const root = shell.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; font: 18px/1.5 system-ui, sans-serif; color: #172b42; }
    dialog { box-sizing: border-box; width: min(36rem, 92vw); padding: clamp(1.2rem, 5vw, 2.35rem);
      border: 2px solid #d2b171; border-radius: 1rem; color: inherit; background: #fffdf6; }
    dialog::backdrop { background: #142238df; }
    h2 { margin: 0 0 .65rem; font-size: 1.7rem; line-height: 1.2; }
    p { margin: .75rem 0 1.4rem; }
    div { display: flex; flex-wrap: wrap; gap: .65rem; }
    button { min-height: 48px; font: inherit; padding: .45rem .85rem; border: 1px solid #536879;
      color: #172b42; background: white; border-radius: .46rem; cursor: pointer; }
    button:first-child { background: #12516b; color: white; border-color: #12516b; }
    button:last-child { touch-action: none; user-select: none; }
    button:focus-visible { outline: 3px solid #1883a3; outline-offset: 3px; }
    progress { width: 100%; margin-top: .85rem; }
  `;
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-labelledby", "bifocal-pause-title");
  dialog.setAttribute("aria-describedby", "bifocal-pause-reason");
  const heading = document.createElement("h2");
  heading.id = "bifocal-pause-title";
  heading.textContent = "Let’s pause for a moment";
  const explanation = document.createElement("p");
  explanation.id = "bifocal-pause-reason";
  explanation.textContent = pauseReasons[reason];
  const actions = document.createElement("div");
  const back = document.createElement("button");
  back.textContent = "Go back";
  const contact = document.createElement("button");
  contact.textContent = "Ask my trusted contact";
  const resume = document.createElement("button");
  resume.textContent = "Hold for 5 seconds to continue";
  const progress = document.createElement("progress");
  progress.max = holdMs;
  progress.value = 0;
  progress.setAttribute("aria-label", "Time held to continue");

  let animation = 0;
  let started = 0;
  let dismissing = false;

  function stop() {
    cancelAnimationFrame(animation);
    animation = 0;
    progress.value = 0;
  }

  function dismiss(choice?: "back" | "contact" | "continue") {
    if (dismissing) return;
    dismissing = true;
    stop();
    window.removeEventListener("blur", stop);
    dialog.close();
    shell.remove();
    if (choice) finish(choice);
  }

  function tick(now: number) {
    progress.value = now - started;
    if (now - started >= holdMs) dismiss("continue");
    else animation = requestAnimationFrame(tick);
  }

  function begin() {
    if (animation) return;
    started = performance.now();
    animation = requestAnimationFrame(tick);
  }

  back.onclick = (event) => { if (event.isTrusted) dismiss("back"); };
  contact.onclick = (event) => { if (event.isTrusted) dismiss("contact"); };
  resume.onpointerdown = (event) => {
    if (!event.isTrusted || event.button !== 0) return;
    resume.setPointerCapture(event.pointerId);
    begin();
  };
  resume.onpointerup = stop;
  resume.onpointercancel = stop;
  resume.onlostpointercapture = stop;
  resume.onkeydown = (event) => {
    if (!event.isTrusted || ![" ", "Enter"].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) begin();
  };
  resume.onkeyup = stop;
  resume.onblur = stop;
  window.addEventListener("blur", stop);
  dialog.oncancel = (event) => { event.preventDefault(); dismiss("back"); };

  actions.append(back, contact, resume);
  dialog.append(heading, explanation, actions, progress);
  root.append(style, dialog);
  document.body.append(shell);
  dialog.showModal();
  back.focus();
  return () => dismiss();
}

export function watchPause(
  ctx: { onInvalidated(callback: () => void): void },
  settings: () => { triggers: readonly string[]; tools: string },
) {
  let notice: CheckNotice | null = null;
  let close: (() => void) | undefined;
  // One action the person held to continue. Only the same kind of event uses it up:
  // clicking a button focuses it first, and that focusin must not spend a click's exception.
  let bypass: { target: HTMLElement; type: string } | undefined;

  function intercept(event: Event) {
    if (close || !notice || (!notice.flagged && !notice.fromFlaggedLink) || !event.isTrusted) return;
    const target = event.composedPath().find((node) => node instanceof HTMLElement);
    if (!target) return;
    if (target === bypass?.target && event.type === bypass.type) { bypass = undefined; return; }
    const { triggers, tools } = settings();
    const reason = pauseReason(target, event.type === "focusin" ? "focus" : "click", tools);
    if (!reason || !triggers.includes(reason)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === "focusin") target.blur();
    close = promptPause(reason, (choice) => {
      close = undefined;
      if (choice === "contact") {
        void chrome.runtime.sendMessage({ type: "show-card", contact: true } satisfies ExtensionMessage).catch(() => undefined);
      }
      void chrome.runtime.sendMessage({ type: "pause-choice", choice } satisfies ExtensionMessage).catch(() => undefined);
      if (choice === "back") {
        if (history.length > 1) history.back();
      } else if (choice === "continue") {
        bypass = { target, type: event.type };
        if (event.type === "focusin") target.focus();
      }
    });
  }

  document.addEventListener("click", intercept, true);
  document.addEventListener("focusin", intercept, true);
  ctx.onInvalidated(() => {
    close?.();
    document.removeEventListener("click", intercept, true);
    document.removeEventListener("focusin", intercept, true);
  });
  return (next: CheckNotice | null) => {
    if (next?.id !== notice?.id) {
      close?.();
      close = undefined;
      bypass = undefined;
    }
    notice = next;
  };
}
