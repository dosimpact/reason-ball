import cors from "cors";
import express, { type Express } from "express";
import { asyncErrorBoundary, TODO_API_ROUTE, TodoController } from "./http/todo-controller.js";
import { InMemoryTodoRepository } from "./repositories/todo-repository.js";
import { TodoService } from "./services/todo-service.js";

export function createApp(): Express {
  const repository = new InMemoryTodoRepository();
  const service = new TodoService(repository);
  const controller = new TodoController(service);
  const app = express();

  app.use(cors({ origin: "http://localhost:5174" }));
  app.use(express.json());
  app.use(TODO_API_ROUTE, controller.router);
  app.use(asyncErrorBoundary);

  return app;
}
