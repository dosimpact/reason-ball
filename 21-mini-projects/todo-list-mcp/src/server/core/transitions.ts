import {
  TodoError,
  type Todo,
  type TodoStore,
  type TodoPatch,
} from "../../shared/todo";
export const emptyStore = (): TodoStore => ({
  version: 1,
  revision: 0,
  todos: [],
});
export function findTodo(store: TodoStore, id: string): Todo {
  const todo = store.todos.find((t) => t.id === id);
  if (!todo) throw new TodoError("Todo not found", 404);
  return todo;
}
export function addTodo(store: TodoStore, todo: Todo): TodoStore {
  return {
    ...store,
    revision: store.revision + 1,
    todos: [todo, ...store.todos],
  };
}
export function updateTodo(
  store: TodoStore,
  id: string,
  patch: TodoPatch,
  time: string,
): TodoStore {
  findTodo(store, id);
  return {
    ...store,
    revision: store.revision + 1,
    todos: store.todos.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: time } : t,
    ),
  };
}
export function deleteTodo(store: TodoStore, id: string): TodoStore {
  findTodo(store, id);
  return {
    ...store,
    revision: store.revision + 1,
    todos: store.todos.filter((t) => t.id !== id),
  };
}
