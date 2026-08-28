export const TODO_API_PATH = "/api/todos";

export interface TodoDto {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface ApiErrorBody {
  message?: string;
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
    throw new Error(body.message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchTodos(): Promise<TodoDto[]> {
  return request<TodoDto[]>(TODO_API_PATH);
}

export function createTodo(title: string): Promise<TodoDto> {
  return request<TodoDto>(TODO_API_PATH, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function toggleTodo(id: number, completed: boolean): Promise<TodoDto> {
  return request<TodoDto>(`${TODO_API_PATH}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`${TODO_API_PATH}/${id}`, { method: "DELETE" });
}
