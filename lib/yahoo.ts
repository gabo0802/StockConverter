import YahooFinance from "yahoo-finance2";
import { cleanMarketCandles, enrichCandles, sanitizeCandles } from "@/lib/indicators";
import { buildAnalysisResponse } from "@/lib/strategy-engine";
import type { AnalysisResponse } from "@/lib/types";

const yahooFinance = new YahooFinance();

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
