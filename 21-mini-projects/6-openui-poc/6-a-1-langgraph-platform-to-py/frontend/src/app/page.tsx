/*
 * 브라우저 채팅 화면입니다. 사용자 입력을 API로 보내고 AG-UI 스트림을 OpenUI 컴포넌트로 렌더링합니다.
 */
"use client";

import { AgentInterface, agUIAdapter, fetchLLM, useSystemThemeMode } from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { useMemo } from "react";

export default function Page() {
  // OS(운영체제)의 다크모드/라이트모드 설정을 실시간으로 감지하고 구독하는 React Hook입
  const mode = useSystemThemeMode(); 

  const llm = useMemo(
    () =>
      fetchLLM({
        url: "/api/chat",
        streamAdapter: agUIAdapter(), 
      }),
    [],
  );

  return (
    <div className="app-shell">
      <AgentInterface
        llm={llm}
        componentLibrary={openuiLibrary}
        agentName="OpenUI + DeepAgents Chat"
        theme={{ mode }}
        starterVariant="short"
        starters={[
          {
            displayText: "Weather in Tokyo",
            prompt: "What's the weather like in Tokyo right now?",
          },
          { displayText: "AAPL stock price", prompt: "What's the current Apple stock price?" },
          {
            displayText: "Research a topic",
            prompt: "Give me a quick briefing on the James Webb Space Telescope.",
          },
          {
            displayText: "Compare cities",
            prompt: "Compare the weather in London and Sydney right now.",
          },
        ]}
      />
    </div>
  );
}
