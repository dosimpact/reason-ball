import type { CreateTodoInput, Todo, UpdateTodoInput } from "../domain/todo.js";
import type { TodoRepository } from "../repositories/todo-repository.js";

export class TodoNotFoundError extends Error {}
export class InvalidTodoError extends Error {}

export class TodoService {
  constructor(private readonly repository: TodoRepository) {}

  listTodos(): Todo[] {
    return this.repository.findAll();
  }

  createTodo(input: CreateTodoInput): Todo {
    const todo: Todo = {
      id: this.repository.nextIdentity(),
      title: this.normalizeTitle(input.title),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    return this.repository.save(todo);
  }

  updateTodo(id: number, input: UpdateTodoInput): Todo {
    const current = this.requireTodo(id);
    const updated: Todo = {
      ...current,
      ...(input.title === undefined ? {} : { title: this.normalizeTitle(input.title) }),
      ...(input.completed === undefined ? {} : { completed: input.completed }),
    };

    return this.repository.save(updated);
  }

  deleteTodo(id: number): void {
    this.requireTodo(id);
    this.repository.deleteById(id);
  }

  private requireTodo(id: number): Todo {
    const todo = this.repository.findById(id);
    if (!todo) {
      throw new TodoNotFoundError(`Todo ${id} was not found`);
    }
    return todo;
  }

  private normalizeTitle(title: unknown): string {
    if (typeof title !== "string") {
      throw new InvalidTodoError("Title must be a string");
    }

    const normalized = title.trim();
    if (!normalized) {
      throw new InvalidTodoError("Title is required");
    }
    if (normalized.length > 120) {
      throw new InvalidTodoError("Title must be 120 characters or fewer");
    }
    return normalized;
  }
}
