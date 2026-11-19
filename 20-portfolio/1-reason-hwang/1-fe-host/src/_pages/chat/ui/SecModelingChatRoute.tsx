import { ChatProvider } from "../model/context/ChatProvider";
import { fastApiChatRuntime } from "../model/runtime";
import { ChatPage } from "./ChatPage";

const runtime = { ...fastApiChatRuntime, label: "SEC Modeling Chat" };

export function SecModelingChatRoute() {
  return <ChatProvider key="sec-modeling-agent" runtime={runtime} fixedGraphId="sec_modeling_agent"><ChatPage /></ChatProvider>;
}
