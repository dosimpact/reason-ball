# Wedding Atlas app

Next.js App Router + TypeScript + Tailwind v4 + shadcn/ui. Run all app commands with `pnpm -C app <script>` from this mini-project, or within app. This is an isolated pnpm root to avoid changing sibling projects.

Use FSD: root `app/` for Next.js routes and `src/app` for providers/styles, `src/pages` for page composition (empty root `pages/` shields it from the Pages Router), `src/widgets` for independent UI blocks, `src/features` for user actions/state, `src/entities` for vendor domain/projection, `src/shared` for primitives. Imports flow down these layers. Preserve a single level of abstraction per function.

App-local database and copied model files are read-only inputs. Do not add runtime/build/test dependencies on sibling directories. Only explicit sync:data --source-root imports outside data. build packages .next/standalone including public, static and local database; test:standalone verifies a relocated release and cleans up its owned process. Never replace missing prices or coordinates with invented values. Public-cost estimates are partial sums, not final quotations. Read docs/stock and record material changes in docs/flow. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and live browser flows are separate validation evidence.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
