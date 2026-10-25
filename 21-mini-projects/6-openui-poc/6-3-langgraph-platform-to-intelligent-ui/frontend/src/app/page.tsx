"use client";
import "@/lib/devtools";
import "@openuidev/react-ui/styles/index.css";

import {
  AgentInterface,
  fetchLLM,
  agUIAdapter,
  useThemeModePreference,
} from "@openuidev/react-ui";
import type { ActionEvent } from "@openuidev/react-lang";
import { useEffect } from "react";
import { Brain, Calculator, Compass, Drum, Gamepad2, MapPinned, TentTree, UtensilsCrossed } from "lucide-react";
import { runLibraryAction } from "@/lib/actions";
import { withBase } from "@/lib/base-path";
import { SaveMessages } from "@/lib/chat-storage";
import { reportChatStorage } from "@/reporting/report-chat-storage";
import { ReportPrintLayout } from "@/reporting/report-print-layout";
import { webUrl } from "@/lib/components/style";
import { library } from "@/lib/library";
import { ReportDocumentInput, ReportUserMessage } from "@/reporting/report-document-input";
import { ChatSession } from "@/components/chat-session";

// The chat opens @OpenUrl with a plain window.open of whatever URL the model wrote, and on
// openui.com this page shares its origin with the rest of the site. So only http(s) URLs open,
// in a new tab without an opener; a javascript: or data: URL does nothing.
if (typeof window !== "undefined") {
  const open = window.open.bind(window);
  window.open = (url?: string | URL) => {
    const safe = webUrl(String(url ?? ""));
    return safe ? open(safe, "_blank", "noopener,noreferrer") : null;
  };
}

const starters = [
  { displayText: "Plan a day out", prompt: "I'm in San Francisco for a day, plan a sightseeing route for me", icon: <MapPinned size={16} /> },
  { displayText: "Explore a city", prompt: "Plan a relaxed afternoon exploring Lisbon, with three stops and a map", icon: <Compass size={16} /> },
  { displayText: "Find weekend ideas", prompt: "Help me find a weekend getaway from San Francisco. Compare three destinations", icon: <TentTree size={16} /> },
  { displayText: "Plan a meal", prompt: "Help me plan a simple vegetarian dinner for six people", icon: <UtensilsCrossed size={16} /> },
  { displayText: "Build a calculator", prompt: "Build me a working calculator app with a display and keypad", icon: <Calculator size={16} /> },
  { displayText: "Play on a Game Boy", prompt: "Make a playable Game Boy-style handheld game with a screen, D-pad and A/B buttons", icon: <Gamepad2 size={16} /> },
  { displayText: "Jam on a drum pad", prompt: "Make a drum pad I can play, with a few pads and a beat counter", icon: <Drum size={16} /> },
  { displayText: "Take a trivia quiz", prompt: "Quiz me with five fun trivia questions and keep score", icon: <Brain size={16} /> },
];

const llm = fetchLLM({
  url: withBase("/api/chat"),
  streamAdapter: agUIAdapter(),
});

// Threads and messages persist in localStorage (created once, on the client).
const storage = typeof window === "undefined" ? undefined : reportChatStorage();

// The chat sends @ToAssistant and opens @OpenUrl itself; every other action,
// such as the library's @CopyToClipboard, reaches onAction.
function onAction(event: ActionEvent) {
  void runLibraryAction(event);
}

export default function Home() {
  // Follows the system theme until the footer toggle is first used, then
  // remembers the choice.
  const { setPreference, mode } = useThemeModePreference();

  // Mirror the resolved mode onto <html>, so the components' dark tokens also
  // apply while the theme follows the system.
  useEffect(() => {
    document.documentElement.setAttribute("data-openui-theme", mode);
  }, [mode]);

  return (
    <div className="chat-shell">
      <AgentInterface
        llm={llm}
        storage={storage}
        componentLibrary={library}
        onAction={onAction}
        agentName="Intelligent UI · Python"
        logoUrl={withBase("/shiro-face.svg")}
        theme={{ mode }}
        starters={starters}
        components={{ UserMessage: ReportUserMessage }}
      >
        {/* 사이드바 하단 영역에 테마 전환 버튼을 배치합니다. */}
        <AgentInterface.SidebarFooter>
          {/* 현재 테마를 표시하고, 변경한 테마 설정을 저장합니다. */}
          <AgentInterface.ThemeModeToggle mode={mode} onModeChange={setPreference} />
        </AgentInterface.SidebarFooter>
        {/* 대화 헤더의 제목을 숨기고 끝 영역에 문서 업로드·보고서 생성 버튼을 표시합니다. */}
        <AgentInterface.ThreadHeader showChatTitle={false} end={<ReportDocumentInput />} />
        {/* 모바일 헤더에도 같은 문서 업로드·보고서 생성 버튼을 제공합니다. */}
        <AgentInterface.MobileHeader actions={<ReportDocumentInput />} />
        {/* 새 대화의 환영 화면: 마스코트·안내 문구·카드형 시작 질문과 배경 빛 효과를 표시합니다. */}
        <AgentInterface.Welcome
          image={<img src={withBase("/shiro-woodworker.svg")} alt="" className="welcome-mascot" />}
          title="What can I help with?"
          starterVariant="card"
          glowAnimation
        />
        {/* 생성이 끝난 대화 메시지와 폼 상태 변경을 localStorage에 저장합니다. 화면은 표시하지 않습니다. */}
        <SaveMessages />
        {/* 선택한 대화 ID를 저장하고 새로고침 후 마지막으로 열었던 대화를 복원합니다. */}
        <ChatSession />
        {/* 인쇄 시 근거 표 셀에 열 제목을 붙이고 차트 SVG의 viewBox를 보정하며, 인쇄 후 viewBox를 복원합니다. */}
        <ReportPrintLayout />
      </AgentInterface>
    </div>
  );
}
