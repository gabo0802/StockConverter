import type { ChartAnnotation, EnrichedCandle, PriceCandle } from "@/lib/types";

export function sanitizeCandles(candles: Array<Partial<PriceCandle> & { time: string }>): PriceCandle[] {
  return candles
    .filter((candle) =>
      [candle.open, candle.high, candle.low, candle.close, candle.volume].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      ),
    )
    .map((candle) => ({
      time: candle.time,
      open: candle.open as number,
      high: candle.high as number,
      low: candle.low as number,
      close: candle.close as number,
      volume: candle.volume as number,
    }));
}

function getNewYorkParts(dateString: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(dateString));
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
  return { hour, minute, minutesOfDay: hour * 60 + minute };
}

export function isRegularMarketHour(dateString: string): boolean {
  const { minutesOfDay } = getNewYorkParts(dateString);
  return minutesOfDay >= 570 && minutesOfDay <= 960;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function cleanMarketCandles(
  candles: PriceCandle[],
  options?: { regularHoursOnly?: boolean; rangeThresholdPct?: number },
): { candles: PriceCandle[]; removedExtendedHours: number; removedSuspicious: number } {
  const regularHoursOnly = options?.regularHoursOnly ?? false;
  const rangeThresholdPct = options?.rangeThresholdPct ?? 0.18;
  const afterHoursFiltered = regularHoursOnly ? candles.filter((candle) => isRegularMarketHour(candle.time)) : candles;
  const removedExtendedHours = candles.length - afterHoursFiltered.length;

  const rangePcts = afterHoursFiltered
    .map((candle) => (candle.close > 0 ? (candle.high - candle.low) / candle.close : 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const medianRangePct = median(rangePcts);
  const dynamicThreshold = Math.min(Math.max(rangeThresholdPct, medianRangePct * 6), 0.35);

  const filtered = afterHoursFiltered.filter((candle, index) => {
    const structurallyValid =
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close) &&
      candle.low > 0 &&
      candle.high >= candle.low;
    if (!structurallyValid) {
      return false;
    }

    const rangePct = candle.close > 0 ? (candle.high - candle.low) / candle.close : Number.POSITIVE_INFINITY;
    if (rangePct > dynamicThreshold) {
      return false;
    }

    if (index === 0) {
      return true;
    }

    const previousClose = afterHoursFiltered[index - 1].close;
    const jumpPct = previousClose > 0 ? Math.abs(candle.open - previousClose) / previousClose : 0;
    return jumpPct <= Math.max(0.15, medianRangePct * 10);
  });

  return {
    candles: filtered,
    removedExtendedHours,
    removedSuspicious: afterHoursFiltered.length - filtered.length,
  };
}

export function simpleMovingAverage(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  let running = 0;

  for (let index = 0; index < values.length; index += 1) {
    running += values[index];

    if (index >= period) {
      running -= values[index - period];
    }

    if (index >= period - 1) {
      result[index] = running / period;
    }
  }

  return result;
}

export function enrichCandles(candles: PriceCandle[]): EnrichedCandle[] {
  const closes = candles.map((candle) => candle.close);
  const ma20 = simpleMovingAverage(closes, 20);
  const ma40 = simpleMovingAverage(closes, 40);
  const ma100 = simpleMovingAverage(closes, 100);
  const ma200 = simpleMovingAverage(closes, 200);

  return candles.map((candle, index) => ({
    ...candle,
    ma20: ma20[index],
    ma40: ma40[index],
    ma100: ma100[index],
    ma200: ma200[index],
  }));
}

export function averageVolume(candles: PriceCandle[], length = 20): number {
  const slice = candles.slice(-length);
  if (slice.length === 0) {
    return 0;
  }

  return slice.reduce((sum, candle) => sum + candle.volume, 0) / slice.length;
}

export function pctDistance(price: number, anchor: number): number {
  return Math.abs(price - anchor) / anchor;
}

export function isNearLevel(price: number, anchor: number, tolerancePct: number): boolean {
  return pctDistance(price, anchor) <= tolerancePct;
}

export function classifyDrop(currentClose: number, referenceClose: number, regularDrop: number, strongDrop: number) {
  const dropPoints = referenceClose - currentClose;

  if (dropPoints >= strongDrop) {
    return { dropPoints, kind: "strong" as const };
  }

  if (dropPoints >= regularDrop) {
    return { dropPoints, kind: "regular" as const };
  }

  return { dropPoints, kind: "none" as const };
}

export function isBullishCandle(candle: PriceCandle): boolean {
  return candle.close > candle.open && candle.close >= candle.low + (candle.high - candle.low) * 0.55;
}

export function isHammerCandle(candle: PriceCandle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  return lowerWick > body * 1.8 && upperWick <= Math.max(body, 0.15);
}

export function getNewYorkHour(dateString: string): number {
  return getNewYorkParts(dateString).hour;
}

export function getNewYorkDateKey(dateString: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(dateString));
}

export function projectTrendLine(fromIndex: number, fromValue: number, toIndex: number, toValue: number, targetIndex: number) {
  if (toIndex === fromIndex) {
    return toValue;
  }

  const slope = (toValue - fromValue) / (toIndex - fromIndex);
  return fromValue + slope * (targetIndex - fromIndex);
}

export function findDescendingResistance(candles: PriceCandle[]) {
  if (candles.length < 8) {
    return null;
  }

  const startIndex = Math.max(0, candles.length - 16);
  const window = candles.slice(startIndex);
  const latestIndex = candles.length - 1;
  const pivotIndexes: number[] = [];

  for (let index = 1; index < window.length - 1; index += 1) {
    const previous = window[index - 1];
    const current = window[index];
    const next = window[index + 1];

    if (current.high >= previous.high && current.high >= next.high) {
      pivotIndexes.push(index);
    }
  }

  if (pivotIndexes.length < 2) {
    const midpoint = Math.floor(window.length / 2);
    const firstHalf = window.slice(0, midpoint);
    const secondHalf = window.slice(midpoint, window.length - 1);

    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return null;
    }

    let peakA = 0;
    let peakB = 0;

    firstHalf.forEach((candle, index) => {
      if (candle.high >= firstHalf[peakA].high) {
        peakA = index;
      }
    });

    secondHalf.forEach((candle, index) => {
      if (candle.high >= secondHalf[peakB].high) {
        peakB = index;
      }
    });

    const absoluteA = startIndex + peakA;
    const absoluteB = startIndex + midpoint + peakB;

    if (candles[absoluteB].high >= candles[absoluteA].high) {
      return null;
    }

    const projected = projectTrendLine(
      absoluteA,
      candles[absoluteA].high,
      absoluteB,
      candles[absoluteB].high,
      latestIndex,
    );

    return {
      from: { time: candles[absoluteA].time, value: candles[absoluteA].high },
      to: { time: candles[latestIndex].time, value: projected },
      resistanceAtLatest: projected,
    };
  }

  let bestMatch:
    | {
        absoluteA: number;
        absoluteB: number;
        projected: number;
        penetrationCount: number;
      }
    | null = null;

  for (let right = pivotIndexes.length - 1; right >= 1; right -= 1) {
    for (let left = right - 1; left >= 0; left -= 1) {
      const absoluteA = startIndex + pivotIndexes[left];
      const absoluteB = startIndex + pivotIndexes[right];
      const highA = candles[absoluteA].high;
      const highB = candles[absoluteB].high;

      if (highB >= highA) {
        continue;
      }

      const projected = projectTrendLine(
        absoluteA,
        highA,
        absoluteB,
        highB,
        latestIndex,
      );
      const tolerance = projected * 0.0035;
      let penetrationCount = 0;

      for (let index = absoluteA + 1; index < latestIndex; index += 1) {
        const projectedAtIndex = projectTrendLine(
          absoluteA,
          highA,
          absoluteB,
          highB,
          index,
        );

        if (candles[index].high > projectedAtIndex + tolerance) {
          penetrationCount += 1;
        }
      }

      if (penetrationCount > 1) {
        continue;
      }

      bestMatch = {
        absoluteA,
        absoluteB,
        projected,
        penetrationCount,
      };
      break;
    }

    if (bestMatch) {
      break;
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    from: {
      time: candles[bestMatch.absoluteA].time,
      value: candles[bestMatch.absoluteA].high,
    },
    to: { time: candles[latestIndex].time, value: bestMatch.projected },
    resistanceAtLatest: bestMatch.projected,
  };
}

export function findRecentSwingLow(candles: PriceCandle[], length = 24): { time: string; value: number } | null {
  const slice = candles.slice(-length);
  if (slice.length === 0) {
    return null;
  }

  let chosen = slice[0];
  for (const candle of slice) {
    if (candle.low <= chosen.low) {
      chosen = candle;
    }
  }

  return { time: chosen.time, value: chosen.low };
}

export function countSupportTouches(candles: EnrichedCandle[], support: number, tolerancePct: number): number {
  return candles.filter((candle) => isNearLevel(candle.low, support, tolerancePct)).length;
}

export function createHorizontalLine(id: string, label: string, value: number, color: string): ChartAnnotation {
  return {
    id,
    type: "horizontalLine",
    label,
    color,
    value,
  };
}

export function createTrendLine(
  id: string,
  label: string,
  points: [{ time: string; value: number }, { time: string; value: number }],
  color: string,
): ChartAnnotation {
  return {
    id,
    type: "trendLine",
    label,
    color,
    points,
  };
}

export function createMarker(id: string, label: string, point: { time: string; value: number }, color: string): ChartAnnotation {
  return {
    id,
    type: "marker",
    label,
    color,
    point,
  };
}
