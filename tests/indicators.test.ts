import { averageVolume, classifyDrop, isNearLevel, simpleMovingAverage } from "@/lib/indicators";

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
});
