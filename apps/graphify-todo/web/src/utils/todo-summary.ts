import type { Todo } from "../apis/todos";

export interface TodoSummary {
  total: number;
  completed: number;
  remaining: number;
}

export function getTodoSummary(todos: Todo[]): TodoSummary {
  const completed = todos.filter((todo) => todo.completed).length;

  return {
    total: todos.length,
    completed,
    remaining: todos.length - completed,
  };
}

