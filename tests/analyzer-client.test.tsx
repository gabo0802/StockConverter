// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnalyzerClient } from "@/components/analyzer-client";
import type { AnalysisResponse, WatchlistResponse } from "@/lib/types";
import { beforeEach, vi } from "vitest";

vi.mock("@/components/strategy-chart", () => ({
  StrategyChart: () => <div>chart</div>,
}));

const mockResponse: AnalysisResponse = {
  symbol: "SPY",
  asOf: "2026-05-09T16:00:00.000Z",
  matchedStrategy: {
    strategyId: "pm40_hour",
    strategyName: "PM 40 en Hora",
    matched: true,
    score: 1,
    summary: "Matched.",
    reasonsPassed: [{ label: "A", passed: true, detail: "ok" }],
    reasonsFailed: [],
    warnings: [],
    annotations: [],
  },
  summary: "PM 40 en Hora: Matched.",
  indicators: {
    latestClose: 500,
    latestVolume: 100,
    averageHourlyVolume: 90,
    ma20: 499,
    ma40: 498,
    ma100: 495,
    ma200: 490,
    dailyMa100: 495,
    dailyMa200: 490,
    dailySupport: 495,
    sessionFirstCandleLow: 497,
  },
  signals: [{ label: "A", passed: true, detail: "ok" }],
  warnings: [],
  annotations: [],
  candles: { hourly: [], daily: [] },
  strategies: [
    {
      strategyId: "pm40_hour",
      strategyName: "PM 40 en Hora",
      matched: true,
      score: 1,
      summary: "Matched.",
      reasonsPassed: [{ label: "A", passed: true, detail: "ok" }],
      reasonsFailed: [],
      warnings: [],
      annotations: [],
    },
    {
      strategyId: "bear_channel",
      strategyName: "Canal Bajista",
      matched: false,
      score: 0.5,
      summary: "The bearish channel setup is incomplete or still trading inside the channel.",
      reasonsPassed: [],
      reasonsFailed: [{ label: "Descending channel exists", passed: false, detail: "No clear descending channel was detected." }],
      warnings: [],
      annotations: [],
    },
  ],
  disclaimer: "Educational only",
};

const watchlistResponse: WatchlistResponse = {
  watchlist: ["SPY", "QQQ", "AAPL", "MSFT", "META", "AMZN", "NFLX", "TSLA", "NVDA", "GOOGL", "TNA", "BAC", "MRNA", "GLD", "SLV", "USO", "XOM", "CVX", "DIS", "PYPL", "CMG"],
  quotes: [
    {
      symbol: "SPY",
      displayName: "SPDR S&P 500 ETF Trust",
      regularMarketPrice: 500,
      regularMarketChangePercent: 1.25,
      regularMarketVolume: 1000000,
      marketState: "REGULAR",
      prefilterScore: 42,
      cacheStatus: "fresh",
      analysisStatus: "fresh",
      bestStrategyId: "pm40_hour",
      bestStrategyName: "PM 40 en Hora",
      score: 0.94,
      matched: true,
      summary: "Matched.",
      warnings: [],
    },
    {
      symbol: "QQQ",
      displayName: "Invesco QQQ Trust",
      regularMarketPrice: 450,
      regularMarketChangePercent: 0.85,
      regularMarketVolume: 900000,
      marketState: "REGULAR",
      prefilterScore: 40,
      cacheStatus: "cached",
      analysisStatus: "cached",
      bestStrategyId: "bear_channel",
      bestStrategyName: "Canal Bajista",
      score: 0.72,
      matched: false,
      summary: "The bearish channel setup is incomplete or still trading inside the channel.",
      warnings: [],
    },
  ],
  shortlisted: ["SPY", "QQQ"],
  topOpportunities: [
    {
      symbol: "SPY",
      bestStrategyId: "pm40_hour",
      bestStrategyName: "PM 40 en Hora",
      score: 0.94,
      matched: true,
      summary: "Matched.",
      warnings: [],
      asOf: "2026-05-09T16:00:00.000Z",
      analysisSource: "fresh",
    },
    {
      symbol: "QQQ",
      bestStrategyId: "bear_channel",
      bestStrategyName: "Canal Bajista",
      score: 0.72,
      matched: false,
      summary: "The bearish channel setup is incomplete or still trading inside the channel.",
      warnings: [],
      asOf: "2026-05-09T16:00:00.000Z",
      analysisSource: "cached",
    },
  ],
  generatedAt: "2026-05-09T16:00:00.000Z",
  ttlSeconds: 120,
};

function installFetchMock(options?: { analyzeOk?: boolean; analyzeError?: string }) {
  vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (url.includes("/api/watchlist")) {
      return {
        ok: true,
        json: async () => watchlistResponse,
      } as Response;
    }
    if (url.includes("/api/analyze")) {
      if (options?.analyzeOk === false) {
        return {
          ok: false,
          json: async () => ({ error: options.analyzeError ?? "Invalid ticker" }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    }
    throw new Error(`Unhandled fetch URL: ${url}`);
  });
}

describe("AnalyzerClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a search and renders the result state", async () => {
    installFetchMock();

    render(<AnalyzerClient />);

    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "SPY" } });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "PM 40 en Hora" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "MSFT" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CMG" })).toBeInTheDocument();
    expect(screen.getByText("Watchlist Screener")).toBeInTheDocument();
  });

  it("lets the user inspect a different strategy and translate the UI", async () => {
    installFetchMock();

    render(<AnalyzerClient />);
    fireEvent.submit(screen.getByRole("button", { name: "Analyze" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Canal Bajista: 50%/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Canal Bajista: 50%/ }));
    expect(screen.getByText("No clear descending channel was detected.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Translate to Spanish" }));
    expect(screen.getByText("Lista de reglas")).toBeInTheDocument();
    expect(screen.getByText("No se detectó un canal bajista claro.")).toBeInTheDocument();
    expect(screen.getByText("Monitor de Watchlist")).toBeInTheDocument();
  });

  it("toggles dark mode and updates the document theme", async () => {
    installFetchMock();

    render(<AnalyzerClient />);

    const darkModeButton = screen.getByRole("button", { name: "Dark mode" });
    fireEvent.click(darkModeButton);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    expect(window.localStorage.getItem("strategy-signal-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Light mode" }),
    ).toBeInTheDocument();
  });

  it("renders fetch errors", async () => {
    installFetchMock({ analyzeOk: false, analyzeError: "Invalid ticker" });

    render(<AnalyzerClient />);
    fireEvent.submit(screen.getByRole("button", { name: "Analyze" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("Invalid ticker")).toBeInTheDocument();
    });
  });

  it("renders watchlist leaderboard and table rows", async () => {
    installFetchMock();

    render(<AnalyzerClient />);

    await waitFor(() => {
      expect(screen.getByText("Top opportunities")).toBeInTheDocument();
    });

    expect(screen.getAllByText("SPY").length).toBeGreaterThan(0);
    expect(screen.queryByText("Quote-only this pass")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Analyze now" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Fully analyzed").length).toBeGreaterThan(0);
  });
});
