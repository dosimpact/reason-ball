import { RunDiagnostics } from "./RunDiagnostics";
import { RuntimeControls } from "./RuntimeControls";
import { TodoList } from "./TodoList";
import { TodoStatus } from "./TodoStatus";
import { TodoTranscript } from "./TodoTranscript";
import { useTodoListMiddleware } from "./useTodoListMiddleware";
import { WritetodosToolCalls } from "./WritetodosToolCalls";

// Compose this example's independent controller and views.
export function TodoListMiddlewareExample() {
  const example = useTodoListMiddleware();
  return (
    <section className="todo-layout">
      <RuntimeControls {...example} />
      <TodoStatus {...example} />
      <TodoTranscript {...example} />
      <TodoList {...example} />
      <WritetodosToolCalls {...example} />
      <RunDiagnostics {...example} />
    </section>
  );
}
