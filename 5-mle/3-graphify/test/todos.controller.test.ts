import assert from "node:assert/strict";
import test from "node:test";
import { TodosController } from "../src/server/todos/todos.controller";
import { TodosService } from "../src/server/todos/todos.service";

test("TodosController delegates the CRUD flow to TodosService", () => {
  const service = new TodosService();
  const controller = new TodosController(service);

  const created = controller.create({ title: "Inspect the graph" });
  assert.deepEqual(controller.findAll(), [created]);
  assert.deepEqual(controller.findOne(created.id), created);

  const updated = controller.update(created.id, { completed: true });
  assert.equal(updated.completed, true);

  assert.equal(controller.remove(created.id), undefined);
  assert.deepEqual(controller.findAll(), []);
});
