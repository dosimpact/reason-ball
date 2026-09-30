import { SharedChatPage } from "@/features/chat-share";

export default async function Page(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  return <SharedChatPage token={token} />;
}
