"use client";

import { BehindTheScenes } from "@openuidev/react-ui";
import type { ChatToolActivity } from "../model/toolActivity";

const labels = { running: "실행 중", complete: "완료", error: "오류", interrupted: "중단됨" };
export function ChatActivity({ activities, streaming = false }: { activities?: ChatToolActivity[]; streaming?: boolean }) {
  if (!activities?.length) return null;
  return <div data-testid="chat-tool-activity">
    <BehindTheScenes isStreaming={streaming} toolCallsComplete={activities.every(activity => activity.status !== "running")}>
      <ul aria-label="도구 실행 현황" aria-live="polite" style={{ margin: 0, paddingLeft: 20 }}>
        {activities.map(activity => <li key={activity.id}><span>{activity.name}</span> · <span>{labels[activity.status]}</span></li>)}
      </ul>
    </BehindTheScenes>
  </div>;
}
