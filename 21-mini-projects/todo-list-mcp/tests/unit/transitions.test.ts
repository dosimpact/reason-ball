import { expect, test } from "vitest";
import {
  addTodo,
  deleteTodo,
  emptyStore,
  updateTodo,
} from "../../src/server/core/transitions";
import { createSchema, patchSchema } from "../../src/shared/todo";
const todo = {
  id: "c6ffd746-25f9-4eb9-9c87-ff85a0df3296",
  title: "Milk",
  completed: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
test("normalize input and reject invalid boundaries", () => {
  expect(createSchema.parse({ title: " Milk " }).title).toBe("Milk");
  for (const title of [" ", "a".repeat(201)])
    expect(() => createSchema.parse({ title })).toThrow();
  expect(() => patchSchema.parse({})).toThrow();
  expect(() => patchSchema.parse({ completed: "yes" })).toThrow();
});
test("transitions are deterministic and preserve original state", () => {
  const original = addTodo(emptyStore(), todo);
  const frozen = Object.freeze({
    ...original,
    todos: Object.freeze([Object.freeze(todo)]),
  });
  const updated = updateTodo(
    frozen as unknown as typeof original,
    todo.id,
    { completed: true },
    "2026-02-01T00:00:00.000Z",
  );
  expect(updated.todos[0].completed).toBe(true);
  expect(original.todos[0]).toEqual(todo);
  expect(updated.revision).toBe(2);
  expect(deleteTodo(updated, todo.id).todos).toEqual([]);
  expect(() => updateTodo(original, "missing", {}, "")).toThrow("not found");
  expect(() => deleteTodo(original, "missing")).toThrow("not found");
});
