import { useCallback, useEffect, useState } from "react";
import {
  createTodo,
  deleteTodo,
  fetchTodos,
  type Todo,
  updateTodo,
} from "../apis/todos";

interface UseTodosResult {
  todos: Todo[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  addTodo: (title: string) => Promise<void>;
  toggleTodo: (todo: Todo) => Promise<void>;
  removeTodo: (id: number) => Promise<void>;
  reload: () => Promise<void>;
}

export function useTodos(): UseTodosResult {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setTodos(await fetchTodos());
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addTodo = useCallback(async (title: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const created = await createTodo(title);
      setTodos((current) => [created, ...current]);
    } catch (caught) {
      setError(toMessage(caught));
      throw caught;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const toggleTodo = useCallback(async (todo: Todo) => {
    setError(null);

    try {
      const updated = await updateTodo(todo.id, !todo.completed);
      setTodos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(toMessage(caught));
    }
  }, []);

  const removeTodo = useCallback(async (id: number) => {
    setError(null);

    try {
      await deleteTodo(id);
      setTodos((current) => current.filter((todo) => todo.id !== id));
    } catch (caught) {
      setError(toMessage(caught));
    }
  }, []);

  return { todos, loading, submitting, error, addTodo, toggleTodo, removeTodo, reload };
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

