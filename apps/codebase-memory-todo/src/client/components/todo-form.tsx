import { useState, type FormEvent } from "react";

interface TodoFormProps {
  submitting: boolean;
  onAdd: (title: string) => Promise<void>;
}

export function TodoForm({ submitting, onAdd }: TodoFormProps) {
  const [title, setTitle] = useState("");

  async function submitTodo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalized = title.trim();
    if (!normalized) return;

    try {
      await onAdd(normalized);
      setTitle("");
    } catch {
      // TodoPage renders the error exposed by useTodoWorkflow.
    }
  }

  return (
    <form className="todo-form" onSubmit={submitTodo}>
      <input
        aria-label="New todo title"
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Trace the next business flow…"
        value={title}
      />
      <button disabled={submitting || !title.trim()} type="submit">
        {submitting ? "Adding…" : "Add todo"}
      </button>
    </form>
  );
}
