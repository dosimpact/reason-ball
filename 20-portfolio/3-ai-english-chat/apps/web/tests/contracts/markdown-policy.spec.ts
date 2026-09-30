import { expect, test } from "@playwright/test";
import { safeMarkdownUrl } from "../../src/entities/chat/model/markdown-policy";

test("allows explicit web/mail links and local paths without changing input", () => {
  for (const url of ["https://example.com/a?q=b#c", "HTTP://example.com", "mailto:hello@example.com", "/history", "#note"]) {
    expect(safeMarkdownUrl(url)).toBe(url);
  }
});

test("rejects executable, ambiguous, private-file and automatic resource schemes", () => {
  for (const url of ["", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\nscript:alert(1)", "data:text/html,test", "blob:test", "file:///tmp/x", "chat-file://private", "//tracker.invalid/a", "/\\tracker.invalid", " https://example.com", "https://example.com\u0000", "relative-path"]) {
    expect(safeMarkdownUrl(url)).toBeUndefined();
  }
});
