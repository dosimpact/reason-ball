export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/todos${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const details = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(details ?? `요청에 실패했습니다. (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const todoApi = {
  list: () => request<Todo[]>(""),
  create: (title: string) =>
    request<Todo>("", { method: "POST", body: JSON.stringify({ title }) }),
  update: (id: number, input: UpdateTodoInput) =>
    request<Todo>(`/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  remove: (id: number) => request<void>(`/${id}`, { method: "DELETE" }),
};
