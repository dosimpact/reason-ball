import { developmentChatRuntime, fastApiChatRuntime } from "../model/runtime";
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

const inlineRuntime = { ...developmentChatRuntime, label: "기술적 분석 · 인라인" };
const canvasRuntime = { ...developmentChatRuntime, label: "기술적 분석 · Canvas" };

export function TechnicalAnalysisChatRoute() {
  return <ChatProvider key="technical-inline" runtime={inlineRuntime} fixedGraphId="technical_analysis_agent"><ChatPage /></ChatProvider>;
}

export function TechnicalAnalysisCanvasChatRoute() {
  return <ChatProvider key="technical-canvas" runtime={canvasRuntime} fixedGraphId="technical_analysis_canvas_agent"><ChatPage /></ChatProvider>;
}
