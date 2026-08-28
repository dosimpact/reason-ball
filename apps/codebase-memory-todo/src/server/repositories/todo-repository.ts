import type { Todo } from "../domain/todo.js";

export interface TodoRepository {
  findAll(): Todo[];
  findById(id: number): Todo | undefined;
  save(todo: Todo): Todo;
  deleteById(id: number): boolean;
  nextIdentity(): number;
}

export class InMemoryTodoRepository implements TodoRepository {
  private readonly todos = new Map<number, Todo>();
  private nextId = 1;

  findAll(): Todo[] {
    return Array.from(this.todos.values()).sort((left, right) => right.id - left.id);
  }

  findById(id: number): Todo | undefined {
    return this.todos.get(id);
  }

  save(todo: Todo): Todo {
    this.todos.set(todo.id, todo);
    return todo;
  }

  deleteById(id: number): boolean {
    return this.todos.delete(id);
  }

  nextIdentity(): number {
    return this.nextId++;
  }
}
