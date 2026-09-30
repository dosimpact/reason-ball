// Server-only entry point: never re-export through the browser-facing index.
export { prepareChatGeneration, finishChatGeneration, type ChatGeneration } from "./api/server-generation";
