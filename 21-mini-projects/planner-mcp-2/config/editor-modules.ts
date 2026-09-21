import { createRequire } from "node:module";

// ProseMirror uses class identity; both UI bundlers must load one copy.
const require = createRequire(import.meta.url);
const fromTiptap = createRequire(require.resolve("@tiptap/pm/model"));
export const editorModuleAliases = Object.fromEntries(
  ["prosemirror-model", "prosemirror-view"].map((name) => [
    name,
    fromTiptap.resolve(name).replace(/index\.cjs$/, "index.js"),
  ]),
);
