import assert from "node:assert/strict";
import test from "node:test";
import { newRequestCount, pendingPaths } from "../src/new-requests.ts";

function request(path, status = "pending") {
  return { ref: { path }, status };
}

test("only counts pending requests added since the last snapshot", () => {
  const old = "circles/owner/requests/old";
  const fresh = "circles/owner/requests/new";
  const replied = "circles/owner/requests/answered";
  const previous = pendingPaths({ requests: [request(old)] });
  const next = pendingPaths({ requests: [request(old), request(fresh), request(replied, "replied")] });

  assert.equal(newRequestCount(previous, next), 1);
  assert.equal(newRequestCount(next, next), 0);
  assert.equal(newRequestCount(next, pendingPaths({ requests: [request(old, "replied"), request(fresh)] })), 0);
});
