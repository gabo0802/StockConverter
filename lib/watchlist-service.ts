import type { AnalysisResponse, CacheStatus, WatchlistOpportunityRow, WatchlistQuoteRow, WatchlistResponse } from "@/lib/types";
import { ANALYSIS_TTL_MS, WATCHLIST_QUOTE_TTL_MS, WATCHLIST_SYMBOLS, WATCHLIST_TOP_OPPORTUNITIES_LIMIT } from "@/lib/watchlist";
import { fetchQuoteSnapshots, getCachedSymbolAnalysis } from "@/lib/yahoo";

type QuoteSnapshot = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketState?: string;
  tradeable?: boolean;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
};

type QuoteCacheEntry = {
  rows: WatchlistQuoteRow[];
  fetchedAt: number;
  expiresAt: number;
};

const watchlistQuoteCache = new Map<string, QuoteCacheEntry>();
const watchlistQuoteInflight = new Map<string, Promise<{ rows: WatchlistQuoteRow[]; source: Exclude<CacheStatus, "error" | "not_analyzed"> }>>();

function buildWatchlistKey(symbols: readonly string[]) {
  return symbols.join(",");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function scoreQuotePrefilter(quote: QuoteSnapshot): number {
  const price = quote.regularMarketPrice ?? 0;
  const changePct = quote.regularMarketChangePercent ?? 0;
  const volume = quote.regularMarketVolume ?? 0;
  const priceVs50 = quote.fiftyDayAverage && quote.fiftyDayAverage > 0 ? (price - quote.fiftyDayAverage) / quote.fiftyDayAverage : 0;
  const priceVs200 =
    quote.twoHundredDayAverage && quote.twoHundredDayAverage > 0 ? (price - quote.twoHundredDayAverage) / quote.twoHundredDayAverage : 0;

  let score = 0;
  if (quote.tradeable) {
    score += 15;
  }
  if (quote.marketState === "REGULAR") {
    score += 12;
  } else if (quote.marketState === "PRE" || quote.marketState === "POST") {
    score += 6;
  }

  score += clamp(volume > 0 ? Math.log10(volume + 1) * 2.2 : 0, 0, 18);
  score += clamp(changePct, -2, 4) * 4;
  score += clamp(priceVs50 * 100, -2, 5) * 1.5;
  score += clamp(priceVs200 * 100, -2, 5) * 1.2;

  return Number(score.toFixed(2));
}

export function selectShortlistSymbols(rows: WatchlistQuoteRow[], limit = rows.length): string[] {
  return rows
    .filter((row) => !row.error)
    .sort((left, right) => {
      if (right.prefilterScore !== left.prefilterScore) {
        return right.prefilterScore - left.prefilterScore;
      }
      const leftChange = left.regularMarketChangePercent ?? Number.NEGATIVE_INFINITY;
      const rightChange = right.regularMarketChangePercent ?? Number.NEGATIVE_INFINITY;
      if (rightChange !== leftChange) {
        return rightChange - leftChange;
      }
      return left.symbol.localeCompare(right.symbol);
    })
    .slice(0, limit)
    .map((row) => row.symbol);
}

function buildQuoteRows(symbols: readonly string[], quotes: QuoteSnapshot[], cacheStatus: Exclude<CacheStatus, "error" | "not_analyzed">): WatchlistQuoteRow[] {
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol?.toUpperCase() ?? "", quote]));

  return symbols.map((symbol) => {
    const quote = bySymbol.get(symbol);
    if (!quote) {
      return {
        symbol,
        displayName: symbol,
        regularMarketPrice: null,
        regularMarketChangePercent: null,
        regularMarketVolume: null,
        marketState: null,
        prefilterScore: -1,
        cacheStatus: "error",
        analysisStatus: "error",
        error: `No quote data returned for ${symbol}.`,
      };
    }

    return {
      symbol,
      displayName: quote.longName ?? quote.shortName ?? symbol,
      regularMarketPrice: quote.regularMarketPrice ?? null,
      regularMarketChangePercent: quote.regularMarketChangePercent ?? null,
      regularMarketVolume: quote.regularMarketVolume ?? null,
      marketState: quote.marketState ?? null,
      prefilterScore: scoreQuotePrefilter(quote),
      cacheStatus,
      analysisStatus: "not_analyzed",
    };
  });
}

async function fetchFreshWatchlistQuotes(
  symbols: readonly string[],
  forceRefresh: boolean,
): Promise<{ rows: WatchlistQuoteRow[]; source: Exclude<CacheStatus, "error" | "not_analyzed"> }> {
  const quotes = await fetchQuoteSnapshots([...symbols]);
  const source: Exclude<CacheStatus, "error" | "not_analyzed"> = forceRefresh ? "refreshed" : "fresh";
  const rows = buildQuoteRows(symbols, quotes, source);
  watchlistQuoteCache.set(buildWatchlistKey(symbols), {
    rows,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + WATCHLIST_QUOTE_TTL_MS,
  });
  return { rows, source };
}

export async function getCachedWatchlistQuotes(options?: { forceRefresh?: boolean }) {
  const forceRefresh = options?.forceRefresh ?? false;
  const key = buildWatchlistKey(WATCHLIST_SYMBOLS);
  const cached = watchlistQuoteCache.get(key);
  const now = Date.now();

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return { rows: cached.rows, source: "cached" as const };
  }

  const inflight = watchlistQuoteInflight.get(key);
  if (inflight) {
    return inflight;
  }

  const promise = fetchFreshWatchlistQuotes(WATCHLIST_SYMBOLS, forceRefresh).finally(() => {
    watchlistQuoteInflight.delete(key);
  });
  watchlistQuoteInflight.set(key, promise);
  return promise;
}

function buildOpportunityRow(analysis: AnalysisResponse, source: Exclude<CacheStatus, "error" | "not_analyzed">): WatchlistOpportunityRow | null {
  const bestStrategy = [...analysis.strategies].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.matched !== right.matched) {
      return left.matched ? -1 : 1;
    }
    return left.strategyName.localeCompare(right.strategyName);
  })[0];

  if (!bestStrategy) {
    return null;
  }

  return {
    symbol: analysis.symbol,
    bestStrategyId: bestStrategy.strategyId,
    bestStrategyName: bestStrategy.strategyName,
    score: bestStrategy.score,
    matched: bestStrategy.matched,
    summary: bestStrategy.summary,
    warnings: Array.from(new Set([...analysis.warnings, ...bestStrategy.warnings])),
    asOf: analysis.asOf,
    analysisSource: source,
  };
}

export async function getWatchlistScreen(options?: { forceRefresh?: boolean }): Promise<WatchlistResponse> {
  const forceRefresh = options?.forceRefresh ?? false;
  const { rows: quoteRows } = await getCachedWatchlistQuotes({ forceRefresh });
  const shortlisted = selectShortlistSymbols(quoteRows, quoteRows.length);

  const analyses = await Promise.all(
    shortlisted.map(async (symbol) => {
      try {
        const { analysis, source } = await getCachedSymbolAnalysis(symbol, {
          forceRefresh,
          ttlMs: ANALYSIS_TTL_MS,
        });
        return { symbol, analysis, source, error: null as string | null };
      } catch (error) {
        return {
          symbol,
          analysis: null,
          source: "error" as const,
          error: error instanceof Error ? error.message : "Unknown watchlist analysis error.",
        };
      }
    }),
  );

  const opportunityMap = new Map<string, WatchlistOpportunityRow>();
  const analysisMeta = new Map<string, { status: CacheStatus; error?: string }>();

  for (const item of analyses) {
    if (item.analysis) {
      const opportunity = buildOpportunityRow(item.analysis, item.source);
      if (opportunity) {
        opportunityMap.set(item.symbol, opportunity);
      }
      analysisMeta.set(item.symbol, { status: item.source });
    } else {
      analysisMeta.set(item.symbol, { status: "error", error: item.error ?? "Unknown watchlist analysis error." });
    }
  }

  const quotes = quoteRows.map((row) => {
    const opportunity = opportunityMap.get(row.symbol);
    const meta = analysisMeta.get(row.symbol);

    if (!meta) {
      return row;
    }

    if (!opportunity) {
      return {
        ...row,
        analysisStatus: meta.status,
        error: meta.error ?? row.error,
      };
    }

    return {
      ...row,
      analysisStatus: meta.status,
      bestStrategyId: opportunity.bestStrategyId,
      bestStrategyName: opportunity.bestStrategyName,
      score: opportunity.score,
      matched: opportunity.matched,
      summary: opportunity.summary,
      warnings: opportunity.warnings,
    };
  });

  const topOpportunities = Array.from(opportunityMap.values())
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.matched !== right.matched) {
        return left.matched ? -1 : 1;
      }
      return left.symbol.localeCompare(right.symbol);
    })
    .slice(0, WATCHLIST_TOP_OPPORTUNITIES_LIMIT);

  return {
    watchlist: [...WATCHLIST_SYMBOLS],
    quotes,
    shortlisted,
    topOpportunities,
    generatedAt: new Date().toISOString(),
    ttlSeconds: WATCHLIST_QUOTE_TTL_MS / 1000,
  };
}
