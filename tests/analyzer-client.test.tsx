// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnalyzerClient } from "@/components/analyzer-client";
import type { AnalysisResponse } from "@/lib/types";
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

describe("AnalyzerClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a search and renders the result state", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    render(<AnalyzerClient />);

    fireEvent.change(screen.getByLabelText("Ticker"), { target: { value: "SPY" } });
    fireEvent.submit(screen.getByRole("button", { name: "Analyze" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("PM 40 en Hora")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "MSFT" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CMG" })).toBeInTheDocument();
  });

  it("lets the user inspect a different strategy and translate the UI", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

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
  });

  it("renders fetch errors", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid ticker" }),
    } as Response);

    render(<AnalyzerClient />);
    fireEvent.submit(screen.getByRole("button", { name: "Analyze" }).closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText("Invalid ticker")).toBeInTheDocument();
    });
  });
});
