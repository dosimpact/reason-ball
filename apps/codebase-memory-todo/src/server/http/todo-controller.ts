import type { NextFunction, Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type { CreateTodoInput, UpdateTodoInput } from "../domain/todo.js";
import {
  InvalidTodoError,
  TodoNotFoundError,
  type TodoService,
} from "../services/todo-service.js";

export const TODO_API_ROUTE = "/api/todos";

export class TodoController {
  readonly router: Router = createRouter();

  constructor(private readonly todoService: TodoService) {
    this.router.get("/", this.listTodos);
    this.router.post("/", this.createTodo);
    this.router.patch("/:id", this.updateTodo);
    this.router.delete("/:id", this.deleteTodo);
  }

  private readonly listTodos = (_request: Request, response: Response): void => {
    response.json(this.todoService.listTodos());
  };

  private readonly createTodo = (request: Request, response: Response): void => {
    const input = request.body as CreateTodoInput;
    response.status(201).json(this.todoService.createTodo(input));
  };

  private readonly updateTodo = (request: Request, response: Response): void => {
    const input = request.body as UpdateTodoInput;
    response.json(this.todoService.updateTodo(parseTodoId(request.params.id), input));
  };

  private readonly deleteTodo = (request: Request, response: Response): void => {
    this.todoService.deleteTodo(parseTodoId(request.params.id));
    response.status(204).end();
  };
}

export function asyncErrorBoundary(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const status = error instanceof TodoNotFoundError ? 404 : 400;
  const message = error instanceof Error ? error.message : "Unexpected request failure";
  response.status(status).json({ message });
}

function parseTodoId(rawId: string | string[] | undefined): number {
  if (Array.isArray(rawId)) {
    throw new InvalidTodoError("Todo id must contain a single value");
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    throw new InvalidTodoError("Todo id must be a positive integer");
  }
  return id;
}
