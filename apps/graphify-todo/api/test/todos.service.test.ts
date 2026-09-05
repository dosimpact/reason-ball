import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TodosService } from "../src/todos/todos.service";

test("creates, updates, and removes a todo", () => {
  const service = new TodosService();
  const created = service.create({ title: "  Explore Graphify  " });

  assert.equal(created.title, "Explore Graphify");
  assert.equal(created.completed, false);
  assert.deepEqual(service.findAll(), [created]);

  const updated = service.update(created.id, { completed: true });
  assert.equal(updated.completed, true);

  service.remove(created.id);
  assert.deepEqual(service.findAll(), []);
});

test("rejects invalid titles", () => {
  const service = new TodosService();

  assert.throws(() => service.create({ title: "   " }), BadRequestException);
  assert.throws(() => service.create({ title: "x".repeat(121) }), BadRequestException);
});

test("reports missing todos", () => {
  const service = new TodosService();

  assert.throws(() => service.update(999, { completed: true }), NotFoundException);
  assert.throws(() => service.remove(999), NotFoundException);
});

