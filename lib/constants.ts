import type { StrategyId, TickerProfile } from "@/lib/types";

export const DISCLAIMER =
  "Educational use only. This app summarizes a rule-based interpretation of the Cardona guide and is not financial advice.";

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  pm40_hour: "PM 40 en Hora",
  bear_channel: "Canal Bajista",
  regular_or_strong_drop: "Caida Regular/Fuerte",
  strong_floor: "Piso Fuerte",
  first_gap_up: "Primer Gap al Alza",
};

export const DEFAULT_TICKER_PROFILE: TickerProfile = {
  symbol: "SPY",
  nearMaTolerancePct: 0.006,
  supportTolerancePct: 0.008,
  regularDropPoints: 2.5,
  strongDropPoints: 5.5,
  firstGapMinVolume: 20_000_000,
  elevatedVolumeMultiplier: 1.35,
  gapThresholdPct: 0.0025,
};

export const CHART_WINDOW = 90;
