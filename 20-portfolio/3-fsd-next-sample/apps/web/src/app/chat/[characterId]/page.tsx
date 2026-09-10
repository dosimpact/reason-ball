import { ChatWorkspace } from "@/widgets/chat-workspace";

export default async function Page(props: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await props.params;
  return <ChatWorkspace characterId={characterId} />;
}
