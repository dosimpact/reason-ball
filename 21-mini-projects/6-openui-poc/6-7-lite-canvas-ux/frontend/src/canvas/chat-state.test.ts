import { describe, expect, it } from "vitest";
import { reduceChat } from "./state";

describe("general UI chat stream", () => {
  it("resets a repair in place and preserves format after completion", () => {
    const start = { channel: "chat", type: "TEXT_MESSAGE_START", messageId: "ui", format: "openui" as const };
    let messages = reduceChat([], start);
    messages = reduceChat(messages, { channel: "chat", type: "TEXT_MESSAGE_CONTENT", messageId: "ui", delta: "bad" });
    messages = reduceChat(messages, start);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("");
    messages = reduceChat(messages, { channel: "chat", type: "TEXT_MESSAGE_CONTENT", messageId: "ui", delta: "root = Col([])" });
    messages = reduceChat(messages, { channel: "chat", type: "TEXT_MESSAGE_END", messageId: "ui" });
    expect(messages[0]).toMatchObject({ format: "openui", status: "ready", content: "root = Col([])" });
  });
  it("replaces a failed program with a readable error", () => {
    const messages = reduceChat([], { channel: "chat", type: "TEXT_MESSAGE_START", messageId: "ui", format: "openui" });
    expect(reduceChat(messages, { channel: "chat", type: "UI_ERROR", messageId: "ui", message: "Try again" })[0]).toMatchObject({ status: "error", content: "Try again" });
  });
});
