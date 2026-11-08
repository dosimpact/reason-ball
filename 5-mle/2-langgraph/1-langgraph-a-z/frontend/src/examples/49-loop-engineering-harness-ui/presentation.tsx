import { GitBranch, Sparkles, Webhook, Wrench } from "lucide-react";

export const loopCards = [
  {
    id: "event-driven",
    title: "Event-driven loop",
    detail: "Normalizes manual, webhook, or cron triggers before work begins.",
    icon: Webhook,
  },
  {
    id: "agent",
    title: "Agent loop",
    detail: "Uses local tool context and prior feedback to produce each attempt.",
    icon: Wrench,
  },
  {
    id: "verification",
    title: "Verification loop",
    detail: "Scores attempts against a threshold and routes retries.",
    icon: GitBranch,
  },
  {
    id: "hill-climbing",
    title: "Hill-climbing loop",
    detail: "Turns traces and eval results into improvement suggestions.",
    icon: Sparkles,
  },
];
