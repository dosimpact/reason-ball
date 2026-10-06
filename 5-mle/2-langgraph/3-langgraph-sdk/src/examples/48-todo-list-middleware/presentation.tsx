import { CheckCircle2, Circle, Clock3 } from "lucide-react";

import { type TodoStatus } from "./model";

export function statusIcon(status: TodoStatus) {
  if (status === "completed") return <CheckCircle2 aria-hidden="true" size={16} />;
  if (status === "in_progress") return <Clock3 aria-hidden="true" size={16} />;
  return <Circle aria-hidden="true" size={16} />;
}
