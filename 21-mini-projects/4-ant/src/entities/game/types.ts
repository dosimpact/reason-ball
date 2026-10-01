export type Difficulty = "easy" | "normal" | "hard";
export type ColorId =
  | "coral"
  | "gold"
  | "mint"
  | "blue"
  | "violet"
  | "cream"
  | "ink"
  | "white"
  | "peach"
  | "brown";
export type PixelStatus = "present" | "reserved" | "carried" | "deposited";
export interface Pixel {
  id: number;
  x: number;
  y: number;
  color: ColorId;
  status: PixelStatus;
}
export interface Box {
  id: number;
  color: ColorId;
  count: number;
  collected: number;
  pending: number;
}
export interface Ant {
  id: number;
  pixelId: number;
  slotIndex: number;
  phase: "outbound" | "return";
  elapsedMs: number;
  durationMs: number;
  route: { x: number; y: number }[];
}
export interface GameState {
  level: number;
  difficulty: Difficulty;
  width: number;
  height: number;
  motif: string;
  pixels: Pixel[];
  ants: Ant[];
  slots: (Box | null)[];
  queues: Box[][];
  status: "playing" | "won" | "lost";
  elapsedMs: number;
  timeLimitMs: number;
  collected: number;
  total: number;
  nextAntId: number;
  solution: number[];
  lossReason: "time" | "blocked" | null;
}
