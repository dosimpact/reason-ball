import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateTodoDto, Todo, UpdateTodoDto } from "./todo.model";

@Injectable()
export class TodosService {
  private readonly todos: Todo[] = [];
  private nextId = 1;

  findAll(): Todo[] {
    return this.todos.map((todo) => ({ ...todo }));
  }

  findOne(id: number): Todo {
    const todo = this.todos.find((candidate) => candidate.id === id);

    if (!todo) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    return { ...todo };
  }

  create(input: CreateTodoDto): Todo {
    const title = this.normalizeTitle(input.title);
    const todo: Todo = {
      id: this.nextId++,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.todos.push(todo);
    return { ...todo };
  }

  update(id: number, input: UpdateTodoDto): Todo {
    const index = this.todos.findIndex((todo) => todo.id === id);

    if (index === -1) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    const current = this.todos[index];
    const updated: Todo = {
      ...current,
      ...(input.title === undefined ? {} : { title: this.normalizeTitle(input.title) }),
      ...(input.completed === undefined ? {} : { completed: input.completed }),
    };

    this.todos[index] = updated;
    return { ...updated };
  }

  remove(id: number): void {
    const index = this.todos.findIndex((todo) => todo.id === id);

    if (index === -1) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    this.todos.splice(index, 1);
  }

  private normalizeTitle(title: string): string {
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new BadRequestException("Todo title must not be empty");
    }

    return title.trim();
  }
}
