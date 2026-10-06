import { statusIcon } from "./presentation";

import type { useTodoListMiddleware } from "./useTodoListMiddleware";

type Props = Pick<
  ReturnType<typeof useTodoListMiddleware>,
  | "transcript"
>;

export function TodoTranscript({
  transcript,
}: Props) {
  return (
    <div className="todo-chat-panel" role="region" aria-label="Todo Transcript">
      <div className="panel-title">Todo Transcript</div>
      <div className="message-list todo-message-list">
        {transcript.length === 0 ? (
          <p className="muted">Run the graph to see middleware messages.</p>
        ) : (
          transcript.map((message) => (
            message.role === "todo" ? (
              <article key={message.id} className="message-bubble ai todo-inline-message">
                <span>todo</span>
                <ul className="todo-inline-list" aria-label="Inline todo list">
                  {(message.todos ?? []).map((todo) => (
                    <li key={todo.id} className={`todo-inline-item ${todo.status}`}>
                      {statusIcon(todo.status)}
                      <span>{todo.content}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : (
              <article
                key={message.id}
                className={`message-bubble ${message.role === "human" ? "human" : "ai"} todo-message-${message.role}`}
              >
                <span>{message.role}</span>
                <p>{message.content}</p>
              </article>
            )
          ))
        )}
      </div>
    </div>
  );
}
