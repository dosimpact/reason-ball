import { RemoteAppShell } from "@/components/remote-app-shell";

export default function TemplateAppPage() {
  return (
    <RemoteAppShell
      description="Template remote loaded through the BFF remote entry."
      name="template"
      title="Template"
    />
  );
}
