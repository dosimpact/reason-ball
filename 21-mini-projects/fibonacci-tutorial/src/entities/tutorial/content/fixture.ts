import "server-only";
import type { Candle } from "@/entities/candle/@x";

const impulseRows = [
  [105, 108, 100, 107], [107, 114, 106, 113], [113, 120, 112, 118],
  [118, 119, 113, 114], [114, 116, 110, 112], [112, 127, 111, 125],
  [125, 140, 124, 138], [138, 139, 131, 133], [133, 135, 125, 128],
  [128, 142, 127, 140], [140, 150, 139, 148], [148, 149, 142, 144],
];
const tradeRows = [
  [102, 105, 100, 103], [103, 110, 102, 109], [109, 117, 108, 116],
  [116, 120, 115, 118], [118, 119, 114, 115], [115, 116, 111, 112],
  [112, 114, 110, 111], [111, 113, 110, 112], [112, 115, 111, 114],
  [114, 126, 113, 124], [124, 137, 123, 135], [135, 145, 134, 143],
];
function candles(rows: number[][], offset: number): Candle[] {
  return rows.map(([open, high, low, close], index) => ({ time: 1_700_000_000 + offset + index * 3600, open, high, low, close }));
}
export function impulseCandles(offset = 0): Candle[] { return candles(impulseRows, offset); }
export function tradeCandles(offset = 0): Candle[] { return candles(tradeRows, offset); }
