import YahooFinance from "yahoo-finance2";
import { cleanMarketCandles, enrichCandles, sanitizeCandles } from "@/lib/indicators";
import { buildAnalysisResponse } from "@/lib/strategy-engine";
import type { AnalysisResponse, CacheStatus } from "@/lib/types";
import { ANALYSIS_TTL_MS } from "@/lib/watchlist";

const yahooFinance = new YahooFinance();
type CachedAnalysisEntry = {
  analysis: AnalysisResponse;
  expiresAt: number;
};

const analysisCache = new Map<string, CachedAnalysisEntry>();
const analysisInflight = new Map<string, Promise<{ analysis: AnalysisResponse; source: Exclude<CacheStatus, "error" | "not_analyzed"> }>>();

function normalizeQuotes(
  quotes: Array<{
    date: Date;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
  }>,
) {
  return sanitizeCandles(
    quotes.map((quote) => ({
      time: quote.date.toISOString(),
      open: quote.open ?? undefined,
      high: quote.high ?? undefined,
      low: quote.low ?? undefined,
      close: quote.close ?? undefined,
      volume: quote.volume ?? undefined,
    })),
  );
}

export async function fetchQuoteSnapshots(symbols: string[]) {
  const quotes = await yahooFinance.quote(
    symbols.map((symbol) => symbol.trim().toUpperCase()),
    { return: "array" },
  );
  return quotes.map((quote) => ({
    symbol: "symbol" in quote ? quote.symbol : undefined,
    shortName: "shortName" in quote ? quote.shortName : undefined,
    longName: "longName" in quote ? quote.longName : undefined,
    regularMarketPrice: "regularMarketPrice" in quote ? quote.regularMarketPrice : undefined,
    regularMarketChangePercent: "regularMarketChangePercent" in quote ? quote.regularMarketChangePercent : undefined,
    regularMarketVolume: "regularMarketVolume" in quote ? quote.regularMarketVolume : undefined,
    marketState: "marketState" in quote ? quote.marketState : undefined,
    tradeable: "tradeable" in quote ? quote.tradeable : undefined,
    fiftyDayAverage: "fiftyDayAverage" in quote ? quote.fiftyDayAverage : undefined,
    twoHundredDayAverage: "twoHundredDayAverage" in quote ? quote.twoHundredDayAverage : undefined,
  }));
}

export async function fetchSymbolAnalysis(rawTicker: string): Promise<AnalysisResponse> {
  const ticker = rawTicker.trim().toUpperCase();

  if (!ticker) {
    throw new Error("Ticker is required.");
  }

  const [quote, hourlyChart, dailyChart] = await Promise.all([
    yahooFinance.quote(ticker),
    yahooFinance.chart(ticker, {
      period1: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
      interval: "1h",
      includePrePost: false,
    }),
    yahooFinance.chart(ticker, {
      period1: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365),
      interval: "1d",
    }),
  ]);

  const rawHourly = normalizeQuotes(hourlyChart.quotes);
  const rawDaily = normalizeQuotes(dailyChart.quotes);
  const cleanedHourly = cleanMarketCandles(rawHourly, { regularHoursOnly: true, rangeThresholdPct: 0.18 });
  const cleanedDaily = cleanMarketCandles(rawDaily, { regularHoursOnly: false, rangeThresholdPct: 0.22 });
  const hourly = enrichCandles(cleanedHourly.candles);
  const daily = enrichCandles(cleanedDaily.candles);

  if (hourly.length < 40 || daily.length < 100) {
    throw new Error(`Not enough market data is available for ${ticker}.`);
  }

  const response = buildAnalysisResponse({
    symbol: ticker,
    displayName: quote.longName ?? quote.shortName ?? ticker,
    hourly,
    daily,
  });

  const warnings = [...response.warnings];
  if (cleanedHourly.removedExtendedHours > 0) {
    warnings.push(`Removed ${cleanedHourly.removedExtendedHours} extended-hours candles from intraday data.`);
  }
  if (cleanedHourly.removedSuspicious > 0 || cleanedDaily.removedSuspicious > 0) {
    warnings.push(
      `Removed ${cleanedHourly.removedSuspicious + cleanedDaily.removedSuspicious} suspicious candles that looked inconsistent with regular price action.`,
    );
  }

  return {
    ...response,
    warnings,
  };
}

export async function getCachedSymbolAnalysis(
  rawTicker: string,
  options?: { forceRefresh?: boolean; ttlMs?: number },
): Promise<{ analysis: AnalysisResponse; source: Exclude<CacheStatus, "error" | "not_analyzed"> }> {
  const ticker = rawTicker.trim().toUpperCase();
  const ttlMs = options?.ttlMs ?? ANALYSIS_TTL_MS;
  const forceRefresh = options?.forceRefresh ?? false;
  const cached = analysisCache.get(ticker);
  const now = Date.now();

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return { analysis: cached.analysis, source: "cached" };
  }

  const inflight = analysisInflight.get(ticker);
  if (inflight) {
    return inflight;
  }

  const promise = fetchSymbolAnalysis(ticker)
    .then((analysis) => {
      analysisCache.set(ticker, {
        analysis,
        expiresAt: Date.now() + ttlMs,
      });
      return {
        analysis,
        source: forceRefresh ? ("refreshed" as const) : ("fresh" as const),
      };
    })
    .finally(() => {
      analysisInflight.delete(ticker);
    });

  analysisInflight.set(ticker, promise);
  return promise;
}
