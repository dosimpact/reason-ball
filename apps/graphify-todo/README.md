# Graphify Todo Lab

A deliberately small full-stack application for exploring how Graphify maps a
NestJS + React codebase.

## Architecture

```text
web/TodoApp -> web/useTodos -> web/todos API client
                                     |
                                     v HTTP /api/todos
api/TodosController -> api/TodosService -> api/Todo model
```

The API stores todos in memory, so restarting it resets the list.

## Run the application

From the repository root, start each process in a separate terminal:

```bash
pnpm --filter @reason-ball/graphify-todo-api dev
pnpm --filter @reason-ball/graphify-todo-web dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to the NestJS API at
<http://localhost:4100>.

## Verify the lab

```bash
pnpm --filter './apps/graphify-todo/**' lint
pnpm --filter './apps/graphify-todo/**' typecheck
pnpm --filter './apps/graphify-todo/**' test
pnpm --filter './apps/graphify-todo/**' build
```

## Explore with Graphify

This directory has a project-scoped Codex integration. Start a new Codex
session in this directory and run:

```text
$graphify .
```

To reproduce the setup on another machine (`graphifyy` has two trailing
`y` characters):

```bash
uv tool install graphifyy
graphify codex install --project
```

For direct CLI use:

```bash
graphify extract . --code-only
graphify cluster-only . --no-label
graphify query "How does creating a todo flow through this application?"
graphify explain "TodosService"
```

Generated artifacts live in `graphify-out/`:

- `graph.html`: interactive visualization
- `graph.json`: machine-readable graph
- `GRAPH_REPORT.md`: architecture and community report

The checked-in code-only graph currently contains **74 nodes, 143 edges, and
13 communities**. `.graphifyignore` omits package and TypeScript configuration
JSON so Todo code remains more prominent than build metadata.

Useful experiments:

1. Inspect paths that Graphify can prove directly from the AST:

   ```bash
   graphify path "TodoApp" "useTodos"
   graphify path "useTodos" "createTodo"
   graphify path "TodosController" "TodosService"
   ```

2. Run `graphify path "TodoForm" "TodosService"`. The code-only graph reports
   no path because the browser-to-server handoff is an HTTP boundary rather
   than a TypeScript import or call edge. If you have an LLM backend configured,
   compare it with a semantic `$graphify .` extraction.
3. Add a persistence repository between `TodosService` and the model, then run
   `graphify update .` and compare the graph.
4. Rename `TodosService.create` and inspect the affected callers before editing.
