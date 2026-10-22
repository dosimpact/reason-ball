import { ChatProvider } from "@/_pages/chat/model/context/ChatProvider";
import { ChatPage } from "@/_pages/chat/ui/ChatPage";

export default function LangGraphChatRoute() {
  return (
    <ChatProvider>
      <ChatPage />
    </ChatProvider>
  );
}
