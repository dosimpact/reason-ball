const storageKey = "langgraph-sdk-example-06-pending-thread";

export function readPendingThread(): string {
  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

export function writePendingThread(threadId: string) {
  try {
    window.localStorage.setItem(storageKey, threadId);
  } catch {
    // localStorage is unavailable in some embedded browsers.
  }
}

export function clearPendingThread() {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // localStorage is unavailable in some embedded browsers.
  }
}
