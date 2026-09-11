import type { MissionDifficulty } from "@/shared/api/learning/contracts";

export function readMissionDifficulty(value: string): MissionDifficulty {
  if (value === "pre-A1" || value === "A1") return "입문";
  if (value === "A2") return "초급";
  return "중급";
}

export function writeMissionDifficulty(value: MissionDifficulty) {
  if (value === "입문") return "A1";
  if (value === "초급") return "A2";
  return "B1";
}
