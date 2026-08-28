# codebase-memory-mcp Evaluation Guide

This guide evaluates whether `codebase-memory-mcp` can recover a known
full-stack business path from a small TypeScript repository. It treats graph
output as evidence to verify, not as proof.

## 1. Fixture architecture

The expected creation path is:

```text
TodoForm.submitTodo
  -> TodoForm.onAdd
  -> useTodoWorkflow.addTodo
  -> client createTodo
  -> POST /api/todos
  -> TodoController.createTodo
  -> TodoService.createTodo
  -> InMemoryTodoRepository.nextIdentity
  -> InMemoryTodoRepository.save
  -> TodoDto returned to the React state
  -> TodoList renders the title
```

This path intentionally contains three relationship types:

- direct TypeScript calls;
- an HTTP boundary with matching `/api/todos` routes;
- React callback, state, and render relationships that require interpretation.

## 2. Verify the fixture first

From the repository root:

```bash
pnpm --filter @reason-ball/codebase-memory-todo typecheck
pnpm --filter @reason-ball/codebase-memory-todo test
pnpm --filter @reason-ball/codebase-memory-todo build
```

Run the application:

```bash
pnpm --filter @reason-ball/codebase-memory-todo dev
```

Open <http://localhost:5174>, create a todo, complete it, and delete it. Do not
evaluate the graph until this behavior works without the graph tool.

## 3. Install with an explicit trust decision

`codebase-memory-mcp` reads repository files and can write agent configuration,
skills, hooks, and instructions. Review its source, security policy, release
checksums, and installer before allowing those changes.

Official project:

- <https://github.com/DeusData/codebase-memory-mcp>
- <https://github.com/DeusData/codebase-memory-mcp/security>

A cautious macOS workflow downloads the installer before running it:

```bash
curl -fsSLo /tmp/codebase-memory-install.sh \
  https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh
less /tmp/codebase-memory-install.sh
bash /tmp/codebase-memory-install.sh
```

Use the official release archive and `checksums.txt` instead when organizational
policy requires artifact verification. Restart the coding agent after install.

Confirm that the binary is available:

```bash
codebase-memory-mcp --help
codebase-memory-mcp config list
```

## 4. Index only this fixture

Run from any directory, using the absolute fixture path:

```bash
codebase-memory-mcp cli --progress index_repository \
  --repo-path /Users/dosimpact/workspace/focus/reason-ball/apps/codebase-memory-todo
codebase-memory-mcp cli list_projects
```

Use the project name returned by `list_projects` in subsequent commands. The
examples below assume it is `codebase-memory-todo`.

The local `.gitignore` excludes `.codebase-memory/` so generated graph artifacts
are not committed accidentally.

## 5. Baseline CLI queries

Find important symbols:

```bash
codebase-memory-mcp cli search_graph \
  --project codebase-memory-todo \
  --name-pattern '.*Todo.*' \
  --label Function
```

Trace the service call path in both directions:

```bash
codebase-memory-mcp cli trace_path \
  --project codebase-memory-todo \
  --function-name createTodo \
  --direction both
```

Inspect a small graph sample:

```bash
codebase-memory-mcp cli query_graph \
  --project codebase-memory-todo \
  --query 'MATCH (a)-[r]->(b) RETURN a.name, type(r), b.name LIMIT 30'
```

CLI schemas can change between releases. Use the installed version's help when
an option differs:

```bash
codebase-memory-mcp cli index_repository --help
codebase-memory-mcp cli trace_path --help
```

## 6. Agent evaluation prompts

Start the coding agent in this directory after confirming that its MCP list
contains `codebase-memory-mcp`.

### Creation flow

```text
Index this project if needed. Trace todo creation from TodoForm.submitTodo to
InMemoryTodoRepository.save and back to the component that renders the created
title. Return an ordered table with file, symbol, edge type, evidence, and
confidence. Separate direct CALLS edges, the HTTP boundary, callback/props
relationships, and inferred React render relationships. Do not edit files.
```

### Toggle flow

```text
Trace a checkbox change from TodoList through the browser API, Express route,
TodoService, and TodoRepository, then back into React state. Identify every
unresolved or inferred edge. Verify each cited file against the source.
```

### Change impact

```text
Without editing code, analyze the impact of replacing Todo.title: string with
a TodoTitle value object. Include server domain, repository, service, HTTP DTO,
browser DTO, form, list, and tests. Distinguish graph evidence from inference.
```

## 7. Establish a no-graph baseline

Run the same prompts in a fresh session without MCP graph tools. Record:

- tool-call count;
- elapsed time;
- input/output tokens when visible;
- files opened;
- correct expected edges;
- false edges;
- missed edges.

If `rg` is installed, verify key symbols and route literals with:

```bash
rg -n 'createTodo|/api/todos|TodoController|InMemoryTodoRepository' \
  apps/codebase-memory-todo
```

If `rg` is unavailable, use the slower fallback:

```bash
grep -RInE 'createTodo|/api/todos|TodoController|InMemoryTodoRepository' \
  apps/codebase-memory-todo/src apps/codebase-memory-todo/tests
```

## 8. Score the result

Use the creation flow above as the ground truth.

| Metric | Calculation | Target |
|---|---|---:|
| Symbol recall | expected symbols found / expected symbols | >= 90% |
| Edge precision | correct reported edges / all reported edges | >= 85% |
| HTTP boundary | client and server route correctly joined | pass |
| React honesty | inferred callback/render edges labeled as inferred | pass |
| Source evidence | reported steps with file and symbol evidence | 100% |
| Token improvement | graph tokens / baseline tokens | lower is better |

Reject the tool for this workflow if it repeatedly invents cross-boundary edges,
hides uncertainty, or costs more exploration than the no-graph baseline.

## 9. Known limitations to test

- Both client and server define `createTodo`; name-only queries may be ambiguous.
- Express route registration is separated from the controller method.
- `TodoForm.onAdd` is a React callback prop, not a direct lexical call to the
  hook implementation.
- The HTTP request uses Vite proxying in development.
- React state updates and re-rendering are runtime framework behavior.
- An in-memory interface and implementation can produce duplicate-looking
  repository symbols.

These cases are intentional. A useful analysis should expose ambiguity rather
than turn every relationship into a high-confidence direct call.

## 10. Cleanup

List indexed projects before removing generated data. Follow the installed
version's CLI help rather than deleting broad cache directories manually.

To remove the tool itself, the official command is:

```bash
codebase-memory-mcp uninstall
```

Review its confirmation output because existing graph indexes may also be
offered for deletion.
