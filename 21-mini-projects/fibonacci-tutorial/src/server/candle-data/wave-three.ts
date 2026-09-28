import "server-only";
import type { Candle } from "@/entities/candle";

const start = 1_700_000_000;

export const waveThreeCandles: readonly Candle[] = [
  [102, 105, 100, 103],
  [103, 110, 102, 109],
  [109, 117, 108, 116],
  [116, 120, 115, 118],
  [118, 119, 114, 115],
  [115, 116, 111, 112],
  [112, 114, 110, 111],
  [111, 113, 110, 112],
  [112, 115, 111, 114],
  [114, 126, 113, 124],
  [124, 137, 123, 135],
  [135, 145, 134, 143],
].map(([open, high, low, close], index) => ({
  time: start + index * 3600,
  open,
  high,
  low,
  close,
}));

export const initialCursor = 7;
