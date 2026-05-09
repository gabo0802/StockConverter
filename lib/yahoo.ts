import YahooFinance from "yahoo-finance2";
import { enrichCandles, sanitizeCandles } from "@/lib/indicators";
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
    }),
    yahooFinance.chart(ticker, {
      period1: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365),
      interval: "1d",
    }),
  ]);

  const hourly = enrichCandles(normalizeQuotes(hourlyChart.quotes));
  const daily = enrichCandles(normalizeQuotes(dailyChart.quotes));

  if (hourly.length < 40 || daily.length < 100) {
    throw new Error(`Not enough market data is available for ${ticker}.`);
  }

  return buildAnalysisResponse({
    symbol: ticker,
    displayName: quote.longName ?? quote.shortName ?? ticker,
    hourly,
    daily,
  });
}
