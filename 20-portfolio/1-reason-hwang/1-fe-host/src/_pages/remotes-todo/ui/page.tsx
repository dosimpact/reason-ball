import { RemoteAppShell } from "@/widgets/remote-app";

export default function TodoAppPage() {
  return (
    <RemoteAppShell
      description="Todo remote loaded through the BFF remote entry."
      name="todo"
      title="Todo"
    />
  );
}
