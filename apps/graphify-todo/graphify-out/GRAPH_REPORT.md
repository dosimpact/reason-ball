# Graph Report - graphify-todo  (2026-08-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 74 nodes · 143 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a64d8140`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10

## God Nodes (most connected - your core abstractions)
1. `TodosService` - 12 edges
2. `Todo` - 10 edges
3. `TodosController` - 8 edges
4. `useTodos()` - 8 edges
5. `Todo` - 7 edges
6. `CreateTodoDto` - 5 edges
7. `UpdateTodoDto` - 5 edges
8. `request()` - 5 edges
9. `createTodo()` - 4 edges
10. `deleteTodo()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `UseTodosResult` --references--> `Todo`  [EXTRACTED]
  web/src/hooks/useTodos.ts → web/src/apis/todos.ts
- `TodoListProps` --references--> `Todo`  [EXTRACTED]
  web/src/widget/TodoList.tsx → web/src/apis/todos.ts
- `TodoApp()` --calls--> `useTodos()`  [EXTRACTED]
  web/src/widget/TodoApp.tsx → web/src/hooks/useTodos.ts
- `useTodos()` --calls--> `createTodo()`  [EXTRACTED]
  web/src/hooks/useTodos.ts → web/src/apis/todos.ts
- `useTodos()` --calls--> `deleteTodo()`  [EXTRACTED]
  web/src/hooks/useTodos.ts → web/src/apis/todos.ts

## Import Cycles
- None detected.

## Communities (13 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.38
Nodes (9): ApiErrorBody, createTodo(), deleteTodo(), fetchTodos(), request(), updateTodo(), TODO_API_PATH, toMessage() (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.25
Nodes (6): TodosController, Controller, Delete, HttpCode, Param, Patch

### Community 3 - "Community 3"
Cohesion: 0.39
Nodes (4): root, getTodoSummary(), TodoSummary, TodoApp()

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (4): AppModule, Module, TodosModule, Module

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (3): TextInput(), TodoForm(), TodoFormProps

### Community 7 - "Community 7"
Cohesion: 0.50
Nodes (4): Todo, UseTodosResult, TodoList(), TodoListProps

### Community 9 - "Community 9"
Cohesion: 0.50
Nodes (3): Button(), ButtonProps, ButtonVariant

## Knowledge Gaps
- **6 isolated node(s):** `ApiErrorBody`, `TodoSummary`, `TodoFormProps`, `ButtonProps`, `ButtonVariant` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TodosController` connect `Community 1` to `Community 8`, `Community 10`, `Community 5`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `TodosService` connect `Community 2` to `Community 8`, `Community 1`, `Community 5`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `Todo` connect `Community 8` to `Community 1`, `Community 10`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `ApiErrorBody`, `TodoSummary`, `TodoFormProps` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._