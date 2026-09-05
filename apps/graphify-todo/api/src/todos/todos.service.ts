import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateTodoDto, Todo, UpdateTodoDto } from "./todo.model";

@Injectable()
export class TodosService {
  private readonly todos = new Map<number, Todo>();
  private nextId = 1;

  findAll(): Todo[] {
    return Array.from(this.todos.values()).sort((left, right) => right.id - left.id);
  }

  create(input: CreateTodoDto): Todo {
    const todo: Todo = {
      id: this.nextId++,
      title: this.normalizeTitle(input.title),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.todos.set(todo.id, todo);
    return todo;
  }

  update(id: number, input: UpdateTodoDto): Todo {
    const current = this.getById(id);
    const updated: Todo = {
      ...current,
      ...(input.title === undefined ? {} : { title: this.normalizeTitle(input.title) }),
      ...(input.completed === undefined ? {} : { completed: input.completed }),
    };

    this.todos.set(id, updated);
    return updated;
  }

  remove(id: number): void {
    this.getById(id);
    this.todos.delete(id);
  }

  private getById(id: number): Todo {
    const todo = this.todos.get(id);

    if (!todo) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    return todo;
  }

  private normalizeTitle(title: unknown): string {
    if (typeof title !== "string") {
      throw new BadRequestException("Title must be a string");
    }

    const normalized = title.trim();
    if (!normalized) {
      throw new BadRequestException("Title is required");
    }
    if (normalized.length > 120) {
      throw new BadRequestException("Title must be 120 characters or fewer");
    }

    return normalized;
  }
}

