import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTodo,
  deleteTodo,
  fetchTodos,
  type TodoDto,
  toggleTodo,
} from "../api/todos-api";

export interface TodoSummary {
  total: number;
  completed: number;
  remaining: number;
}

export function useTodoWorkflow() {
  const [todos, setTodos] = useState<TodoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTodos(await fetchTodos());
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadTodos();
  }, [reloadTodos]);

  const addTodo = useCallback(async (title: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTodo(title);
      setTodos((current) => [created, ...current]);
    } catch (caught) {
      setError(toErrorMessage(caught));
      throw caught;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const changeCompletion = useCallback(async (todo: TodoDto) => {
    setError(null);
    try {
      const updated = await toggleTodo(todo.id, !todo.completed);
      setTodos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }, []);

  const removeTodo = useCallback(async (id: number) => {
    setError(null);
    try {
      await deleteTodo(id);
      setTodos((current) => current.filter((todo) => todo.id !== id));
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  }, []);

  const summary = useMemo<TodoSummary>(() => {
    const completed = todos.filter((todo) => todo.completed).length;
    return { total: todos.length, completed, remaining: todos.length - completed };
  }, [todos]);

  return {
    todos,
    summary,
    loading,
    submitting,
    error,
    reloadTodos,
    addTodo,
    changeCompletion,
    removeTodo,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}
