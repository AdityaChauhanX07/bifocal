import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { pauseReason, readRiskyPage } from "../lib/risky-page.ts";

test("screening includes page context and excludes typed values and URL parameters", () => {
  const { document } = new JSDOM(`
    <title>Checkout</title><main>
      <p>Buy a gift card right now.</p>
      <input autocomplete="cc-number" value="private-value">
      <button>Buy gift card</button>
    </main>`, { url: "https://store.example/gift-cards?session=private-token" }).window;

  const snapshot = readRiskyPage(document);
  assert.match(snapshot?.text ?? "", /Site: https:\/\/store.example/);
  assert.doesNotMatch(snapshot?.text ?? "", /private-value|private-token/);
  assert.equal(pauseReason(document.querySelector("input")!, "focus"), "card");
  assert.equal(pauseReason(document.querySelector("button")!, "click"), "gift-card");
});

test("ignores ordinary downloads and pages without a sensitive action", () => {
  const { document } = new JSDOM('<main><a href="/budget.xlsx">Download budget</a></main>', {
    url: "https://store.example/",
  }).window;
  assert.equal(readRiskyPage(document), null);
  assert.equal(pauseReason(document.querySelector("a")!, "click"), undefined);
});
