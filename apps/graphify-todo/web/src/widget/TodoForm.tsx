import { useState, type FormEvent } from "react";
import { Button } from "../elements/Button";
import { TextInput } from "../elements/TextInput";

interface TodoFormProps {
  submitting: boolean;
  onSubmit: (title: string) => Promise<void>;
}

export function TodoForm({ submitting, onSubmit }: TodoFormProps) {
  const [title, setTitle] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalized = title.trim();

    if (!normalized) {
      return;
    }

    try {
      await onSubmit(normalized);
      setTitle("");
    } catch {
      // The owning hook exposes the error for TodoApp to render.
    }
  }

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <TextInput
        aria-label="New todo title"
        autoComplete="off"
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What should happen next?"
        value={title}
      />
      <Button disabled={submitting || !title.trim()} type="submit">
        {submitting ? "Adding…" : "Add todo"}
      </Button>
    </form>
  );
}

