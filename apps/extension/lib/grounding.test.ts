import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { prepareGrounding } from "./grounding.ts";

const { document } = new JSDOM().window;
const guide = { web: { uri: "https://consumer.ftc.gov/articles/avoiding-and-reporting-gift-card-scams", title: "Gift card scams" } };
const suggestions = '<style>a { color: inherit; }</style><a target="_blank" href="https://www.google.com/search?q=gift+card+scams">Gift card scams</a>';

test("keeps a usable source when the response has no claim-to-source mappings", () => {
  const result = prepareGrounding({ groundingChunks: [guide, guide] }, document);
  assert.deepEqual(result, {
    claims: [], otherSources: [{ href: guide.web.uri, label: guide.web.title }], suggestions: null,
  });
  assert.equal(prepareGrounding({ groundingChunks: [{ web: { uri: "http://example.test/" } }] }, document), null);
});

test("keeps indexed citations and restores other sources when a support is incomplete", () => {
  const second = { web: { uri: "https://www.fbi.gov/how-we-can-help-you/scams-and-safety", title: "Scam guidance" } };
  const unsupported = { web: { uri: "http://example.test/", title: "Invalid" } };
  const segment = { text: "A source supports this.", startIndex: 0, endIndex: 23, partIndex: 0 };
  const result = prepareGrounding({
    groundingChunks: [unsupported, guide, guide, second],
    groundingSupports: [{ segment, groundingChunkIndices: [1, 2, 0, 99] }, { segment }],
  }, document);
  assert.deepEqual(result?.claims, [{ text: segment.text, links: [{ href: guide.web.uri, label: guide.web.title }] }]);
  assert.deepEqual(result?.otherSources, [{ href: second.web.uri, label: second.web.title }]);
});

test("preserves the supplied widget inside a restricted frame and rejects unexpected destinations", () => {
  const result = prepareGrounding({ groundingChunks: [guide], searchEntryPoint: { renderedContent: suggestions } }, document);
  assert.ok(result?.suggestions?.endsWith(suggestions));
  assert.match(result.suggestions, /Content-Security-Policy/);
  for (const renderedContent of [suggestions + "<script></script>", suggestions.replace("/search?", "/url?"),
    suggestions.replace("www.google.com", "search.example.test")]) {
    assert.equal(prepareGrounding({ groundingChunks: [guide], searchEntryPoint: { renderedContent } }, document), null);
  }
});
