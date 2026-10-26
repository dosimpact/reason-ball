"use client";
import {
  useToolActivities,
  type AssistantMessage,
  type Message,
} from "@openuidev/react-headless";
import { toolStatus } from "../model/tool-status";

export function ToolActivities({
  message,
  messages,
  running,
}: {
  message: AssistantMessage;
  messages: Message[];
  running: boolean;
}) {
  const activities = useToolActivities(message, messages);
  if (!activities.length) return null;
  const lastUser = messages.findLastIndex((item) => item.role === "user");
  const current = running && messages.indexOf(message) > lastUser;
  return (
    <section className="tool-activities" aria-label="분석 작업 내역">
      <ul>
        {activities.map((activity) => {
          const item = toolStatus(activity, current);
          return (
            <li key={activity.id} data-failed={item.failed}>
              <span>
                {item.label}
                {item.scope && <small>{item.scope}</small>}
              </span>
              <span
                className="tool-status"
                role={current ? "status" : undefined}
              >
                {item.status}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
