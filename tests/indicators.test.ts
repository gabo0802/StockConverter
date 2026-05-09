import { averageVolume, classifyDrop, cleanMarketCandles, isNearLevel, isRegularMarketHour, simpleMovingAverage } from "@/lib/indicators";

describe("indicator helpers", () => {
  it("calculates simple moving averages", () => {
    expect(simpleMovingAverage([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("computes average volume from the trailing window", () => {
    expect(
      averageVolume([
        { time: "t1", open: 1, high: 1, low: 1, close: 1, volume: 10 },
        { time: "t2", open: 1, high: 1, low: 1, close: 1, volume: 30 },
      ]),
    ).toBe(20);
  });

  it("classifies regular and strong drops", () => {
    expect(classifyDrop(495, 500, 2.5, 5.5).kind).toBe("regular");
    expect(classifyDrop(493.5, 500, 2.5, 5.5).kind).toBe("strong");
    expect(classifyDrop(499, 500, 2.5, 5.5).kind).toBe("none");
  });

  it("checks support proximity with percentage tolerance", () => {
    expect(isNearLevel(100.4, 100, 0.005)).toBe(true);
    expect(isNearLevel(101, 100, 0.005)).toBe(false);
  });

  it("identifies regular market hourly timestamps", () => {
    expect(isRegularMarketHour("2026-05-09T13:30:00.000Z")).toBe(true);
    expect(isRegularMarketHour("2026-05-09T22:00:00.000Z")).toBe(false);
  });

  it("removes extended-hours and suspicious candles", () => {
    const result = cleanMarketCandles(
      [
        { time: "2026-05-09T13:30:00.000Z", open: 100, high: 101, low: 99.8, close: 100.5, volume: 10 },
        { time: "2026-05-09T22:00:00.000Z", open: 100.5, high: 101, low: 100.2, close: 100.7, volume: 10 },
        { time: "2026-05-09T14:30:00.000Z", open: 100.7, high: 160, low: 70, close: 101, volume: 10 },
      ],
      { regularHoursOnly: true, rangeThresholdPct: 0.18 },
    );

    expect(result.candles).toHaveLength(1);
    expect(result.removedExtendedHours).toBe(1);
    expect(result.removedSuspicious).toBe(1);
  });
});
