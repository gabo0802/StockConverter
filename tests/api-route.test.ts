import { GET } from "@/app/api/analyze/route";
import { resetSecurityStateForTests } from "@/lib/security";
import { getCachedSymbolAnalysis } from "@/lib/yahoo";
import type { AnalysisResponse } from "@/lib/types";
import { beforeEach, vi } from "vitest";

vi.mock("@/lib/yahoo", () => ({
  getCachedSymbolAnalysis: vi.fn(),
}));

const mockResponse: AnalysisResponse = {
  symbol: "SPY",
  asOf: "2026-05-09T16:00:00.000Z",
  matchedStrategy: null,
  summary: "No strategy matched.",
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
  signals: [],
  warnings: [],
  annotations: [],
  candles: { hourly: [], daily: [] },
  strategies: [],
  disclaimer: "Educational only",
};

describe("GET /api/analyze", () => {
  beforeEach(() => {
    vi.mocked(getCachedSymbolAnalysis).mockReset();
    resetSecurityStateForTests();
  });

  it("returns a 400 when no ticker is provided", async () => {
    const response = await GET(new Request("http://localhost/api/analyze"));
    expect(response.status).toBe(400);
  });

  it("returns analysis data for a valid ticker", async () => {
    vi.mocked(getCachedSymbolAnalysis).mockResolvedValue({ analysis: mockResponse, source: "cached" });
    const response = await GET(new Request("http://localhost/api/analyze?ticker=SPY"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ symbol: "SPY" });
  });

  it("returns a 400 for invalid ticker input", async () => {
    const response = await GET(new Request("http://localhost/api/analyze?ticker=SPY<script>"));
    expect(response.status).toBe(400);
  });

  it("returns a 502 when upstream analysis fails", async () => {
    vi.mocked(getCachedSymbolAnalysis).mockRejectedValue(new Error("Yahoo upstream unavailable"));
    const response = await GET(new Request("http://localhost/api/analyze?ticker=SPY"));
    expect(response.status).toBe(502);
  });
});
