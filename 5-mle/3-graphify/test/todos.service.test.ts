import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TodosService } from "../src/server/todos/todos.service";

test("TodosService creates, lists, updates, and removes todos", () => {
  const service = new TodosService();
  const created = service.create({ title: "  Learn Graphify  " });

  assert.equal(created.id, 1);
  assert.equal(created.title, "Learn Graphify");
  assert.equal(created.completed, false);
  assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(service.findAll(), [created]);

  const updated = service.update(created.id, { completed: true, title: "Map the todo app" });
  assert.equal(updated.title, "Map the todo app");
  assert.equal(updated.completed, true);
  assert.deepEqual(service.findOne(created.id), updated);

  service.remove(created.id);
  assert.deepEqual(service.findAll(), []);
});

test("TodosService rejects empty titles", () => {
  const service = new TodosService();

  assert.throws(() => service.create({ title: "   " }), BadRequestException);
});

test("TodosService reports missing todos", () => {
  const service = new TodosService();

  assert.throws(() => service.findOne(99), NotFoundException);
  assert.throws(() => service.update(99, { completed: true }), NotFoundException);
  assert.throws(() => service.remove(99), NotFoundException);
});
