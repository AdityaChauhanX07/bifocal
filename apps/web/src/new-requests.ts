import type { Inbox } from "./requests";

export function pendingPaths(inbox: Inbox) {
  return new Set(inbox.requests.filter((request) => request.status === "pending").map((request) => request.ref.path));
}

export function newRequestCount(previous: ReadonlySet<string>, next: ReadonlySet<string>) {
  let count = 0;
  for (const path of next) {
    if (!previous.has(path)) count++;
  }
  return count;
}
