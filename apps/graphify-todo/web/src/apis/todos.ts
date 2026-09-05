import { TODO_API_PATH } from "../constants/api";

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface ApiErrorBody {
  message?: string | string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchTodos(): Promise<Todo[]> {
  return request<Todo[]>(TODO_API_PATH);
}

export function createTodo(title: string): Promise<Todo> {
  return request<Todo>(TODO_API_PATH, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function updateTodo(id: number, completed: boolean): Promise<Todo> {
  return request<Todo>(`${TODO_API_PATH}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`${TODO_API_PATH}/${id}`, { method: "DELETE" });
}

