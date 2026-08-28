# Codebase Memory Todo Lab

A deliberately small full-stack Todo application for evaluating
`codebase-memory-mcp` with a single `package.json`.

## Relationship path

```text
TodoPage
  -> useTodoWorkflow
  -> createTodo / fetchTodos / toggleTodo / deleteTodo
  -> HTTP /api/todos
  -> TodoController
  -> TodoService
  -> TodoRepository
  -> InMemoryTodoRepository
```

The explicit layers make it possible to evaluate symbol search, call tracing,
HTTP route linking, data flow, and change-impact analysis. The API uses memory
storage, so restarting it resets the list.

## Run

From the repository root:

```bash
pnpm --filter @reason-ball/codebase-memory-todo dev
```

Open <http://localhost:5174>. Vite proxies `/api` to the Express API at
<http://localhost:4200>.

## Verify

```bash
pnpm --filter @reason-ball/codebase-memory-todo typecheck
pnpm --filter @reason-ball/codebase-memory-todo test
pnpm --filter @reason-ball/codebase-memory-todo build
```

## Suggested codebase-memory-mcp experiments

For a reproducible installation, indexing, query, and scoring walkthrough, see
[`docs/codebase-memory-mcp-guide.md`](docs/codebase-memory-mcp-guide.md).

After installing and registering the MCP server in your agent environment,
index this directory as its own project. Then compare graph answers with the
source code for these questions:

1. Trace creation from `TodoForm.submitTodo` to
   `InMemoryTodoRepository.save`.
2. Find the HTTP relationship between `createTodo` in the browser and
   `TodoController.createTodo` on the server.
3. Show every caller and data-flow edge involved in toggling completion.
4. Calculate the impact of changing `Todo.title` to a structured value object.
5. Identify which React component renders errors produced by `TodoService`.

Record missing and incorrect edges rather than treating graph output as proof.
