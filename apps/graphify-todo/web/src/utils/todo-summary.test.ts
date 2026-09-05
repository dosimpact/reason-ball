import { describe, expect, it } from "vitest";
import type { Todo } from "../apis/todos";
import { getTodoSummary } from "./todo-summary";

describe("getTodoSummary", () => {
  it("counts completed and remaining todos", () => {
    const todos: Todo[] = [
      { id: 1, title: "Map API", completed: true, createdAt: "2026-08-27T00:00:00.000Z" },
      { id: 2, title: "Trace hook", completed: false, createdAt: "2026-08-27T00:00:01.000Z" },
    ];

    expect(getTodoSummary(todos)).toEqual({ total: 2, completed: 1, remaining: 1 });
  });
});

