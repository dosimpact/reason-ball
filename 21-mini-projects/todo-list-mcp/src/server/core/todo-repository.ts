import type { TodoStore } from "../../shared/todo";
export interface TodoRepository {
  read(): Promise<TodoStore>;
  mutate(
    transform: (store: TodoStore) => TodoStore,
    committed: (store: TodoStore) => void,
  ): Promise<TodoStore>;
}
