"use client";
import { beginNewCanvas } from "@/features/manage-canvas";
import "../../../shared/lib/devtools";
import {SplitWorkspace} from "./split-workspace";
import { CanvasPanel } from "./panel";
import { workspaceFetch } from "@/features/manage-canvas";
import "@openuidev/react-ui/styles/index.css";

import {
  AgentInterface,
  fetchLLM,
  agUIAdapter,
  useThemeModePreference,
} from "@openuidev/react-ui";
import type { ActionEvent } from "@openuidev/react-lang";
import { useEffect } from "react";
import { Brain, Calculator, Compass, Drum, Gamepad2, MapPinned, TentTree, UtensilsCrossed, StickyNote, ClipboardList, Table2, PanelsTopLeft, MessageSquarePlus } from "lucide-react";
import { runLibraryAction } from "@/shared/ui/openui";
import { withBase } from "../../../shared/config";
import { localChatStorage, SaveMessages, ThreadCanvasBridge } from "@/features/manage-canvas";
import { webUrl } from "@/shared/ui/openui";
import { chatLibrary as library } from "@/entities/analysis";
import { AnalysisHost } from "./analysis-host";

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
  { displayText: "매출과 광고비 Canvas", prompt: "매출과 광고비 차트를 canvas에 각각 만들어줘", icon: <Calculator size={16} /> },
  { displayText: "Canvas 주간 메모", prompt: "Canvas에 일반 콘텐츠 메모 카드 하나를 직접 만들어줘. 제목은 이번 주 계획, Markdown으로 목표·할 일·회고 제목과 예시 내용을 넣어줘. 차트나 SQL은 필요 없어.", icon: <StickyNote size={16} /> },
  { displayText: "Canvas 입력 폼", prompt: "Canvas에 일반 콘텐츠 입력 폼 하나를 직접 만들어줘. 제목은 작업 메모. 이름, 오늘의 목표, 메모 입력란과 입력 내용을 바로 보여주는 미리보기를 넣어줘. 입력은 화면 안에서 유지하고 외부 전송은 필요 없어. 차트나 SQL은 필요 없어.", icon: <ClipboardList size={16} /> },
  { displayText: "Canvas 비교표", prompt: "Canvas에 일반 콘텐츠 비교표 하나를 직접 만들어줘. 제목은 요금제 비교. 예시 데이터로 Basic은 월 10달러·1명, Team은 월 30달러·5명, Pro는 월 60달러·10명으로 하고 요금제·월 요금·사용 인원 3개 열로 보여줘. 실제 상품 정보가 아닌 예시이며 차트나 SQL은 필요 없어.", icon: <Table2 size={16} /> },
  { displayText: "Chat에서 Canvas로 추가", prompt: "채팅에 Canvas에 추가할 수 있는 메모와 입력 폼을 각각 만들어줘. 메모 제목은 회의 메모, 내용은 안건과 결정 사항 예시로 해줘. 폼 제목은 참석자 메모, 이름과 메모를 입력할 수 있게 해줘. 둘 다 Add to Canvas로 추가할 수 있게 만들고 아직 Canvas에는 추가하지 마. 차트나 SQL은 필요 없어.", icon: <MessageSquarePlus size={16} /> },
  { displayText: "차트와 메모 함께 만들기", prompt: "Canvas에 매출 차트와 일반 콘텐츠 메모 카드를 각각 직접 만들어줘. 매출은 사용 가능한 합성 데이터를 사용하고, 메모 제목은 분석 체크, 내용은 매출 변화 확인하기·광고비와 비교하기·다음 액션 메모하기로 해줘. 메모에는 SQL을 사용하지 마.", icon: <PanelsTopLeft size={16} /> },
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
  fetch: workspaceFetch,
});

// Threads and messages persist in localStorage (created once, on the client).
const storage = typeof window === "undefined" ? undefined : localChatStorage();

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
    <SplitWorkspace chat={<div className="chat-shell" onClickCapture={e=>{if((e.target as Element).closest('button[aria-label="New chat"]'))beginNewCanvas();}}>
      <AnalysisHost><AgentInterface
        llm={llm}
        storage={storage}
        componentLibrary={library}
        onAction={onAction}
        agentName="Canvas UX · Python"
        logoUrl={withBase("/shiro-face.svg")}
        theme={{ mode }}
        starters={starters}
        starterVariant="card"
      >
        <AgentInterface.SidebarFooter>
          <AgentInterface.ThemeModeToggle mode={mode} onModeChange={setPreference} />
        </AgentInterface.SidebarFooter>
        <AgentInterface.ThreadHeader showChatTitle={false} />
        <AgentInterface.Welcome
          image={<img src={withBase("/shiro-woodworker.svg")} alt="" className="welcome-mascot" />}
          title="무엇을 만들어볼까요?"
          starterVariant="card"
          glowAnimation
        />
        <ThreadCanvasBridge /><SaveMessages />
      </AgentInterface></AnalysisHost>
    </div>} canvas={<CanvasPanel />}/>
  );
}
