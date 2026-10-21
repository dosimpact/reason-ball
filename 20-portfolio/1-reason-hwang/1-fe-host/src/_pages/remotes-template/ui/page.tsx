import { RemoteAppShell } from "@/widgets/remote-app";

export default function TemplateAppPage() {
  return (
    <RemoteAppShell
      description="Template remote loaded through the BFF remote entry."
      name="template"
      title="Template"
    />
  );
}
