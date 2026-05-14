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

  it("matches bearish channel when the latest candle breaks a recent descending ceiling", () => {
    const { hourly, daily } = makeContextData({ hourly: makeSequence(700, 120, "up") });
    const recentHighs = [
      719.8, 718.1, 716.5, 715.9, 714.7, 713.9, 712.8, 711.6, 710.5, 709.7,
      708.8, 707.9, 706.8, 705.9, 705.1,
    ];

    recentHighs.forEach((high, index) => {
      const candleIndex = hourly.length - 16 + index;
      hourly[candleIndex] = {
        ...hourly[candleIndex],
        open: high - 3.2,
        high,
        low: high - 5.4,
        close: high - 2.2,
        volume: 9_000_000 + index * 120_000,
      };
    });

    hourly[hourly.length - 1] = {
      ...hourly[hourly.length - 1],
      time: new Date(Date.UTC(2026, 4, 12, 16, 0, 0)).toISOString(),
      open: 703.3,
      low: 702.4,
      high: 708.2,
      close: 707.4,
      volume: 12_500_000,
    };

    const context = buildMarketContext({
      symbol: "AMZN",
      displayName: "Amazon.com, Inc.",
      hourly,
      daily,
    });

    const bearChannel = evaluateStrategies(context).find(
      (strategy) => strategy.strategyId === "bear_channel",
    );

    expect(bearChannel?.matched).toBe(true);
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
