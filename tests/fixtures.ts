import { enrichCandles } from "@/lib/indicators";
import type { EnrichedCandle, PriceCandle } from "@/lib/types";

function toIso(day: number, hour: number) {
  return new Date(Date.UTC(2026, 4, day, hour, 0, 0)).toISOString();
}

export function makeSequence(base: number, length: number, mode: "up" | "down" | "flat" = "flat"): PriceCandle[] {
  return Array.from({ length }, (_, index) => {
    const drift = mode === "up" ? index * 0.45 : mode === "down" ? -index * 0.35 : 0;
    const center = base + drift;

    return {
      time: toIso(1 + Math.floor(index / 7), 14 + (index % 7)),
      open: center - 0.3,
      high: center + 0.8,
      low: center - 0.8,
      close: center + 0.2,
      volume: 10_000_000 + index * 125_000,
    };
  });
}

export function makeContextData({
  hourly,
  daily,
}: {
  hourly?: PriceCandle[];
  daily?: PriceCandle[];
} = {}): { hourly: EnrichedCandle[]; daily: EnrichedCandle[] } {
  return {
    hourly: enrichCandles(hourly ?? makeSequence(500, 90, "up")),
    daily: enrichCandles(daily ?? makeSequence(470, 220, "up")),
  };
}
