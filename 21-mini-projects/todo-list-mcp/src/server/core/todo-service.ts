import { randomUUID } from "node:crypto";
import {
  createSchema,
  patchSchema,
  type Change,
  type TodoStore,
} from "../../shared/todo";
import type { TodoRepository } from "./todo-repository";
import { TodoEvents } from "../events/todo-events";
import { addTodo, deleteTodo, findTodo, updateTodo } from "./transitions";
export class TodoService {
  constructor(
    private repository: TodoRepository,
    private events: TodoEvents,
    private now = () => new Date().toISOString(),
    private id = randomUUID,
  ) {}
  list() {
    return this.repository.read();
  }
  async get(id: string) {
    const store = await this.list();
    return { todo: findTodo(store, id), revision: store.revision };
  }
  private commit(
    type: Change["type"],
    id: string,
    transform: (s: TodoStore) => TodoStore,
  ) {
    return this.repository.mutate(transform, (s) =>
      this.events.publish({ type, todoId: id, revision: s.revision }),
    );
  }
  async create(input: unknown) {
    const { title } = createSchema.parse(input);
    const id = this.id();
    const store = await this.commit("created", id, (s) => {
      const time = this.now();
      return addTodo(s, {
        id,
        title,
        completed: false,
        createdAt: time,
        updatedAt: time,
      });
    });
    return { todo: findTodo(store, id), revision: store.revision };
  }
  async update(id: string, input: unknown) {
    const patch = patchSchema.parse(input);
    const store = await this.commit("updated", id, (s) =>
      updateTodo(s, id, patch, this.now()),
    );
    return { todo: findTodo(store, id), revision: store.revision };
  }
  async delete(id: string) {
    const store = await this.commit("deleted", id, (s) => deleteTodo(s, id));
    return { id, revision: store.revision };
  }
}
