import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryTodoRepository } from "../src/server/repositories/todo-repository.js";
import { InvalidTodoError, TodoNotFoundError, TodoService } from "../src/server/services/todo-service.js";

describe("TodoService", () => {
  it("creates, completes, and deletes a todo through the repository", () => {
    const service = new TodoService(new InMemoryTodoRepository());
    const created = service.createTodo({ title: " Trace the BFF flow " });

    assert.equal(created.title, "Trace the BFF flow");
    assert.equal(service.updateTodo(created.id, { completed: true }).completed, true);
    assert.equal(service.listTodos().length, 1);

    service.deleteTodo(created.id);
    assert.deepEqual(service.listTodos(), []);
  });

  it("rejects empty titles", () => {
    const service = new TodoService(new InMemoryTodoRepository());
    assert.throws(() => service.createTodo({ title: "  " }), InvalidTodoError);
  });

  it("reports missing todos", () => {
    const service = new TodoService(new InMemoryTodoRepository());
    assert.throws(() => service.updateTodo(404, { completed: true }), TodoNotFoundError);
  });
});
