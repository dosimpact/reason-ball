import { fastApiChatRuntime } from "../model/runtime";
import { ChatProvider } from "@/_pages/chat/model/context/ChatProvider";
import { ChatPage } from "@/_pages/chat/ui/ChatPage";

export default function LangGraphChatRoute() {
  return (
    <ChatProvider key="development">
      <ChatPage />
    </ChatProvider>
  );
}

export function FastApiChatRoute() {
  return <ChatProvider key="fastapi" runtime={fastApiChatRuntime}><ChatPage /></ChatProvider>;
}
