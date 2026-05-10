export type StrategyId =
  | "pm40_hour"
  | "bear_channel"
  | "regular_or_strong_drop"
  | "strong_floor"
  | "first_gap_up";

export type CacheStatus = "fresh" | "cached" | "refreshed" | "error" | "not_analyzed";

export type AnnotationType = "horizontalLine" | "trendLine" | "marker";

export interface PriceCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EnrichedCandle extends PriceCandle {
  ma20: number | null;
  ma40: number | null;
  ma100: number | null;
  ma200: number | null;
}

export interface AnnotationPoint {
  time: string;
  value: number;
}

export interface ChartAnnotation {
  id: string;
  type: AnnotationType;
  label: string;
  color: string;
  value?: number;
  point?: AnnotationPoint;
  points?: [AnnotationPoint, AnnotationPoint];
}

export interface SignalCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface StrategyEvaluation {
  strategyId: StrategyId;
  strategyName: string;
  matched: boolean;
  score: number;
  summary: string;
  reasonsPassed: SignalCheck[];
  reasonsFailed: SignalCheck[];
  warnings: string[];
  annotations: ChartAnnotation[];
}

export interface TickerProfile {
  symbol: string;
  nearMaTolerancePct: number;
  supportTolerancePct: number;
  regularDropPoints: number;
  strongDropPoints: number;
  firstGapMinVolume: number;
  elevatedVolumeMultiplier: number;
  gapThresholdPct: number;
}

export interface IndicatorSnapshot {
  latestClose: number;
  latestVolume: number;
  averageHourlyVolume: number;
  ma20: number | null;
  ma40: number | null;
  ma100: number | null;
  ma200: number | null;
  dailyMa100: number | null;
  dailyMa200: number | null;
  dailySupport: number | null;
  sessionFirstCandleLow: number | null;
}

export interface AnalysisResponse {
  symbol: string;
  asOf: string;
  matchedStrategy: StrategyEvaluation | null;
  summary: string;
  indicators: IndicatorSnapshot;
  signals: SignalCheck[];
  warnings: string[];
  annotations: ChartAnnotation[];
  candles: {
    hourly: EnrichedCandle[];
    daily: EnrichedCandle[];
  };
  strategies: StrategyEvaluation[];
  disclaimer: string;
}

export interface WatchlistQuoteRow {
  symbol: string;
  displayName: string;
  regularMarketPrice: number | null;
  regularMarketChangePercent: number | null;
  regularMarketVolume: number | null;
  marketState: string | null;
  prefilterScore: number;
  cacheStatus: CacheStatus;
  analysisStatus: CacheStatus;
  bestStrategyId?: StrategyId;
  bestStrategyName?: string;
  score?: number;
  matched?: boolean;
  summary?: string;
  warnings?: string[];
  error?: string;
}

export interface WatchlistOpportunityRow {
  symbol: string;
  bestStrategyId: StrategyId;
  bestStrategyName: string;
  score: number;
  matched: boolean;
  summary: string;
  warnings: string[];
  asOf: string;
  analysisSource: Exclude<CacheStatus, "error" | "not_analyzed">;
}

export interface WatchlistResponse {
  watchlist: string[];
  quotes: WatchlistQuoteRow[];
  shortlisted: string[];
  topOpportunities: WatchlistOpportunityRow[];
  generatedAt: string;
  ttlSeconds: number;
}

export interface MarketContext {
  symbol: string;
  displayName: string;
  profile: TickerProfile;
  hourly: EnrichedCandle[];
  daily: EnrichedCandle[];
  averageHourlyVolume: number;
  isSpyTuned: boolean;
}
