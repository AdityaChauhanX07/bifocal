import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JSDOM } from "jsdom";
import jsdomUtils from "jsdom/lib/jsdom/living/generated/utils.js";

// Mirrors apps/web/public/demo/checkout.html.
const checkout = `
  <main>
    <h1>Gift card checkout</h1>
    <p>Buy a gift card now and send me the code. Don't tell anyone.</p>
    <button id="buy">Buy gift card</button>
    <p id="status"></p>
  </main>`;

const flagged = { id: "card-1", flagged: true, fromFlaggedLink: false };
const settings = { triggers: ["card", "gift-card", "download"], tools: "" };

let dom: JSDOM;
let frames: FrameRequestCallback[];
let shadows: ShadowRoot[];
let invalidated: (() => void)[];
const globals = ["window", "document", "history", "HTMLElement", "chrome", "requestAnimationFrame", "cancelAnimationFrame"];

// dispatchEvent() always marks events untrusted, and Pause ignores those.
// jsdom fires its own trusted events through the internal _dispatch.
function dispatchTrusted(target: EventTarget, event: Event) {
  const impl = jsdomUtils.implForWrapper(event);
  impl.isTrusted = true;
  jsdomUtils.implForWrapper(target)._dispatch(impl);
}

function pauseOpen() {
  return dom.window.document.querySelector("bifocal-pause") !== null;
}

// A real mouse click on a button in Chrome focuses it on mousedown, then fires click.
function mouseClick(target: HTMLElement) {
  target.focus();
  dispatchTrusted(target, new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
}

function holdToContinue() {
  const resume = shadows.at(-1)!.querySelectorAll("button")[2];
  dispatchTrusted(resume, new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  const started = performance.now();
  frames.shift()!(started + 5_000);
}

beforeEach(() => {
  dom = new JSDOM(checkout, { url: "https://bifocal.test/demo/checkout.html" });
  frames = [];
  shadows = [];
  invalidated = [];
  const { window } = dom;
  const attach = window.Element.prototype.attachShadow;
  window.Element.prototype.attachShadow = function (init) {
    const root = attach.call(this, init);
    shadows.push(root);
    return root;
  };
  // jsdom has no <dialog> modal support.
  Object.assign(window.HTMLElement.prototype, { showModal() {}, close() {} });
  Object.assign(globalThis, {
    window, document: window.document, history: window.history, HTMLElement: window.HTMLElement,
    chrome: { runtime: { sendMessage: () => Promise.resolve() } },
    requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
    cancelAnimationFrame: () => undefined,
  });
  const buy = window.document.getElementById("buy")!;
  buy.addEventListener("click", () => { window.document.getElementById("status")!.textContent = "Test checkout reached."; });
});

afterEach(() => {
  for (const stop of invalidated) stop();
  dom.window.close();
  for (const name of globals) delete (globalThis as Record<string, unknown>)[name];
});

async function startWatching() {
  const { watchPause } = await import("./pause.ts");
  return watchPause({ onInvalidated: (stop) => invalidated.push(stop) }, () => settings);
}

test("a completed hold lets the next real mouse click on the same button through", async () => {
  const update = await startWatching();
  update(flagged);
  const { document } = dom.window;
  const buy = document.getElementById("buy")!;
  const status = document.getElementById("status")!;

  mouseClick(buy);
  assert.ok(pauseOpen(), "the first click pauses");
  assert.equal(status.textContent, "");

  holdToContinue();
  assert.ok(!pauseOpen(), "a full hold closes Pause");

  buy.blur();
  mouseClick(buy);
  assert.ok(!pauseOpen(), "the click after a full hold is not paused again");
  assert.equal(status.textContent, "Test checkout reached.");
});

test("the exception is used once, so a later click pauses again", async () => {
  const update = await startWatching();
  update(flagged);
  const buy = dom.window.document.getElementById("buy")!;

  mouseClick(buy);
  holdToContinue();
  buy.blur();
  mouseClick(buy);
  assert.ok(!pauseOpen());

  buy.blur();
  mouseClick(buy);
  assert.ok(pauseOpen(), "a second purchase attempt pauses again");
});

test("a re-delivered warning with the same id keeps the exception; a new warning clears it", async () => {
  const update = await startWatching();
  update(flagged);
  const buy = dom.window.document.getElementById("buy")!;

  mouseClick(buy);
  holdToContinue();
  update({ ...flagged });
  buy.blur();
  mouseClick(buy);
  assert.ok(!pauseOpen(), "same warning id: the exception survives");

  buy.blur();
  mouseClick(buy);
  holdToContinue();
  update({ ...flagged, id: "card-2" });
  buy.blur();
  mouseClick(buy);
  assert.ok(pauseOpen(), "a different warning id clears the exception by design");
});

test("a completed hold on a card-number field refocuses it without pausing again", async () => {
  const update = await startWatching();
  update(flagged);
  const { document } = dom.window;
  const card = document.createElement("input");
  card.setAttribute("autocomplete", "cc-number");
  document.querySelector("main")!.append(card);

  card.focus();
  assert.ok(pauseOpen(), "focusing a card field pauses");
  assert.notEqual(document.activeElement, card);

  holdToContinue();
  assert.ok(!pauseOpen());
  assert.equal(document.activeElement, card, "Bifocal returns focus to the field");

  card.blur();
  card.focus();
  assert.ok(pauseOpen(), "the exception was used by the refocus, so a later focus pauses again");
});
