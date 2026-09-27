import { z } from "zod";

export const candleSchema = z.strictObject({
  time: z.number().int().nonnegative(),
  open: z.number().finite().positive(),
  high: z.number().finite().positive(),
  low: z.number().finite().positive(),
  close: z.number().finite().positive(),
  volume: z.number().finite().nonnegative().optional(),
});

export type Candle = z.infer<typeof candleSchema>;

export function isValidCandle(candle: Candle): boolean {
  return candle.low <= Math.min(candle.open, candle.close)
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= candle.high;
}
