import { ChatProvider } from "@/features/chat/context/ChatProvider";
import { ChatPage } from "@/features/chat/ui/ChatPage";

export default function LangGraphChatRoute() {
  return (
    <ChatProvider>
      <ChatPage />
    </ChatProvider>
  );
}
