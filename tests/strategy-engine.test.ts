import { buildAnalysisResponse, buildMarketContext, evaluateStrategies } from "@/lib/strategy-engine";
import { makeContextData, makeSequence } from "@/tests/fixtures";

describe("strategy engine", () => {
  it("matches PM40 hour when hourly structure is bullish and near PM40", () => {
    const { hourly, daily } = makeContextData({ hourly: makeSequence(500, 240, "up") });
    const recentDescendingHighs = [541.5, 540.8, 540.1, 539.2, 538.8, 538.1, 537.7, 537.2, 536.8, 536.4, 536.1, 535.8, 535.4];

    recentDescendingHighs.forEach((high, index) => {
      const candleIndex = hourly.length - 14 + index;
      hourly[candleIndex] = {
        ...hourly[candleIndex],
        open: high - 1.8,
        high,
        low: high - 3.2,
        close: high - 1.2,
        volume: 12_000_000 + index * 100_000,
      };
    });

    hourly[hourly.length - 1] = {
      ...hourly[hourly.length - 1],
      time: new Date(Date.UTC(2026, 4, 9, 16, 0, 0)).toISOString(),
      open: 533.4,
      low: 532.1,
      high: 537.3,
      close: 536.6,
      volume: 18_000_000,
      ma20: 536.9,
      ma40: 532.5,
      ma100: 526.4,
      ma200: 518.2,
    };

    const context = buildMarketContext({
      symbol: "SPY",
      displayName: "SPDR S&P 500 ETF Trust",
      hourly,
      daily,
    });

    const pm40 = evaluateStrategies(context).find((strategy) => strategy.strategyId === "pm40_hour");
    expect(pm40?.matched).toBe(true);
  });

  it("returns no full match when all setups are incomplete", () => {
    const response = buildAnalysisResponse({
      symbol: "SPY",
      displayName: "SPY",
      ...makeContextData({
        hourly: makeSequence(500, 90, "flat"),
        daily: makeSequence(500, 220, "flat"),
      }),
    });

    expect(response.matchedStrategy).toBeNull();
    expect(response.strategies).toHaveLength(5);
  });

  it("adds SPY-tuned warning for non-SPY symbols", () => {
    const response = buildAnalysisResponse({
      symbol: "QQQ",
      displayName: "Invesco QQQ Trust",
      ...makeContextData(),
    });

    expect(response.warnings[0]).toContain("SPY-tuned");
  });
});
