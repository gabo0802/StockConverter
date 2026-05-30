import { CHART_WINDOW, DEFAULT_TICKER_PROFILE, DISCLAIMER, STRATEGY_LABELS } from "@/lib/constants";
import {
  averageVolume,
  classifyDrop,
  countSupportTouches,
  createHorizontalLine,
  createMarker,
  createTrendLine,
  findDescendingResistance,
  findRecentSwingLow,
  getNewYorkDateKey,
  getNewYorkHour,
  isBullishCandle,
  isHammerCandle,
  isBearishCandle,
  isBearishEngulfing,
  findAscendingSupport,
  isNearLevel,
  projectTrendLine,
} from "@/lib/indicators";
import type {
  AnalysisResponse,
  EnrichedCandle,
  IndicatorSnapshot,
  MarketContext,
  SignalCheck,
  StrategyEvaluation,
  StrategyId,
  TickerProfile,
} from "@/lib/types";

function latest<T>(values: T[]): T {
  return values[values.length - 1];
}

function nonNullLast(...values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) {
      return values[index];
    }
  }
  return null;
}

function buildSignal(label: string, passed: boolean, detail: string): SignalCheck {
  return { label, passed, detail };
}

function buildProfile(symbol: string): TickerProfile {
  return {
    ...DEFAULT_TICKER_PROFILE,
    symbol,
  };
}

function buildWarning(symbol: string): string[] {
  return symbol === "SPY" ? [] : [`${symbol} is analyzed with SPY-tuned thresholds. Interpret matches cautiously.`];
}

function evaluatePm40Hour(context: MarketContext): StrategyEvaluation {
  const lastCandle = latest(context.hourly);
  const ordered =
    lastCandle.ma20 !== null &&
    lastCandle.ma40 !== null &&
    lastCandle.ma100 !== null &&
    lastCandle.ma200 !== null &&
    lastCandle.ma20 > lastCandle.ma40 &&
    lastCandle.ma40 > lastCandle.ma100 &&
    lastCandle.ma100 > lastCandle.ma200;
  const nearMa40 =
    lastCandle.ma40 !== null &&
    (isNearLevel(lastCandle.close, lastCandle.ma40, context.profile.nearMaTolerancePct) ||
      isNearLevel(lastCandle.low, lastCandle.ma40, context.profile.nearMaTolerancePct));
  const line = findDescendingResistance(context.hourly.slice(-14));
  const breakout = Boolean(line) && isBullishCandle(lastCandle) && lastCandle.close > (line?.resistanceAtLatest ?? Number.MAX_SAFE_INTEGER);
  const after11 = getNewYorkHour(lastCandle.time) >= 11;

  const reasons = [
    buildSignal("Bullish MA stack", ordered, ordered ? "20 > 40 > 100 > 200 on the latest hourly candle." : "Hourly moving averages are not in the required bullish order."),
    buildSignal("Near PM40", nearMa40, nearMa40 ? "Price is still in the guide's cheap zone near the 40-hour average." : "Price is too far from the 40-hour average."),
    buildSignal("Breakout candle", breakout, breakout ? "A green candle broke the local descending line." : "No confirmed bullish break of the local descending line."),
    buildSignal("After 11 AM", after11, after11 ? "The latest execution candle is after 11:00 AM New York time." : "The latest candle is before the guide's preferred execution time."),
  ];

  return {
    strategyId: "pm40_hour",
    strategyName: STRATEGY_LABELS.pm40_hour,
    matched: reasons.every((reason) => reason.passed),
    score: reasons.filter((reason) => reason.passed).length / reasons.length,
    summary: reasons.every((reason) => reason.passed)
      ? "Hourly structure is bullish, price is near PM40, and the latest candle confirms a post-11 AM breakout."
      : "The PM40 setup is incomplete because one or more structural conditions are missing.",
    reasonsPassed: reasons.filter((reason) => reason.passed),
    reasonsFailed: reasons.filter((reason) => !reason.passed),
    warnings: buildWarning(context.symbol),
    annotations: [
      ...(lastCandle.ma40 ? [createHorizontalLine("pm40", "PM40 zone", lastCandle.ma40, "#22c55e")] : []),
      ...(line ? [createTrendLine("pm40-break", "Break line", [line.from, line.to], "#f97316")] : []),
      createMarker("pm40-latest", "Latest candle", { time: lastCandle.time, value: lastCandle.close }, "#eab308"),
    ],
  };
}

function evaluateBearChannel(context: MarketContext): StrategyEvaluation {
  const line = findDescendingResistance(context.hourly);
  const lastCandle = latest(context.hourly);
  const beforeLatest = context.hourly.slice(-6, -1);
  const breakout = Boolean(line) && isBullishCandle(lastCandle) && lastCandle.close > (line?.resistanceAtLatest ?? Number.MAX_SAFE_INTEGER);
  const insideChannel = Boolean(line) && beforeLatest.some((candle, index) => {
    const absoluteIndex = context.hourly.length - 6 + index;
    const projected = projectTrendLine(
      context.hourly.findIndex((candidate) => candidate.time === line?.from.time),
      line?.from.value ?? 0,
      context.hourly.length - 1,
      line?.to.value ?? 0,
      absoluteIndex,
    );
    return candle.close >= projected;
  });
  const after11 = getNewYorkHour(lastCandle.time) >= 11;

  const reasons = [
    buildSignal("Descending channel exists", Boolean(line), line ? "Recent hourly highs form a downward ceiling." : "No clear descending channel was detected."),
    buildSignal("Stayed below ceiling before breakout", !insideChannel, insideChannel ? "Price was already trading into the ceiling before the breakout candle." : "Recent candles respected the channel ceiling before the breakout."),
    buildSignal("Green breakout candle", breakout, breakout ? "The latest candle closes above the channel ceiling." : "The latest candle has not confirmed a bullish break above the channel."),
    buildSignal("After 11 AM", after11, after11 ? "Breakout timing is after 11:00 AM New York time." : "The latest candle is earlier than the preferred execution window."),
  ];

  return {
    strategyId: "bear_channel",
    strategyName: STRATEGY_LABELS.bear_channel,
    matched: reasons.every((reason) => reason.passed),
    score: reasons.filter((reason) => reason.passed).length / reasons.length,
    summary: reasons.every((reason) => reason.passed)
      ? "A descending hourly channel resolved with a post-11 AM green breakout."
      : "The bearish channel setup is incomplete or still trading inside the channel.",
    reasonsPassed: reasons.filter((reason) => reason.passed),
    reasonsFailed: reasons.filter((reason) => !reason.passed),
    warnings: buildWarning(context.symbol),
    annotations: [
      ...(line ? [createTrendLine("channel", "Channel ceiling", [line.from, line.to], "#38bdf8")] : []),
      createMarker("channel-latest", "Breakout check", { time: lastCandle.time, value: lastCandle.close }, "#eab308"),
    ],
  };
}

function evaluateRegularOrStrongDrop(context: MarketContext): StrategyEvaluation {
  const lookback = context.hourly.slice(-8);
  const reference = lookback[0];
  const lastCandle = latest(lookback);
  const drop = classifyDrop(lastCandle.close, reference.close, context.profile.regularDropPoints, context.profile.strongDropPoints);
  const resistance = findDescendingResistance(lookback);
  const breakout = Boolean(resistance) && isBullishCandle(lastCandle) && lastCandle.close > (resistance?.resistanceAtLatest ?? Number.MAX_SAFE_INTEGER);
  const hammerSeen = lookback.slice(0, -1).some((candle) => isHammerCandle(candle));
  const after11 = getNewYorkHour(lastCandle.time) >= 11;
  const strongRule = drop.kind !== "strong" || hammerSeen;

  const reasons = [
    buildSignal("Drop size qualifies", drop.kind !== "none", drop.kind === "none" ? `Recent decline is only ${drop.dropPoints.toFixed(2)} points.` : `${drop.kind === "strong" ? "Strong" : "Regular"} decline detected at ${drop.dropPoints.toFixed(2)} points.`),
    buildSignal("Breakout candle", breakout, breakout ? "The recovery candle breaks the short-term descending line." : "No recovery breakout is visible on the latest candle."),
    buildSignal("Hammer confirmation for strong drops", strongRule, strongRule ? "Strong-drop hammer confirmation rule is satisfied." : "A strong drop was detected, but no hammer candle appeared before the breakout."),
    buildSignal("After 11 AM", after11, after11 ? "Execution timing is after 11:00 AM New York time." : "The candidate candle is earlier than the guide's preferred execution window."),
  ];

  return {
    strategyId: "regular_or_strong_drop",
    strategyName: STRATEGY_LABELS.regular_or_strong_drop,
    matched: reasons.every((reason) => reason.passed),
    score: reasons.filter((reason) => reason.passed).length / reasons.length,
    summary: reasons.every((reason) => reason.passed)
      ? `A ${drop.kind} pullback recovered with the required breakout candle.`
      : "The drop-and-reversal setup lacks enough downside magnitude or a confirmed breakout sequence.",
    reasonsPassed: reasons.filter((reason) => reason.passed),
    reasonsFailed: reasons.filter((reason) => !reason.passed),
    warnings: buildWarning(context.symbol),
    annotations: [
      ...(resistance ? [createTrendLine("drop-break", "Recovery line", [resistance.from, resistance.to], "#fb7185")] : []),
      createMarker("drop-reference", "Drop start", { time: reference.time, value: reference.close }, "#64748b"),
      createMarker("drop-latest", "Latest candle", { time: lastCandle.time, value: lastCandle.close }, "#eab308"),
    ],
  };
}

function evaluateStrongFloor(context: MarketContext): StrategyEvaluation {
  const lastDaily = latest(context.daily);
  const lastHourly = latest(context.hourly);
  const dailySupport = nonNullLast(lastDaily.ma100, lastDaily.ma200);
  const supportTouches = dailySupport === null ? 0 : countSupportTouches(context.daily.slice(-126), dailySupport, context.profile.supportTolerancePct);
  const nearSupport = dailySupport !== null && isNearLevel(lastDaily.close, dailySupport, context.profile.supportTolerancePct);
  const resistance = findDescendingResistance(context.hourly.slice(-16));
  const breakout = Boolean(resistance) && isBullishCandle(lastHourly) && lastHourly.close > (resistance?.resistanceAtLatest ?? Number.MAX_SAFE_INTEGER);
  const volumeConfirmed = lastHourly.volume >= context.averageHourlyVolume * context.profile.elevatedVolumeMultiplier;
  const after11 = getNewYorkHour(lastHourly.time) >= 11;

  const reasons = [
    buildSignal("Daily strong floor present", dailySupport !== null && supportTouches >= 2, dailySupport !== null && supportTouches >= 2 ? `Daily support near ${dailySupport.toFixed(2)} has at least ${supportTouches} touches.` : "The daily chart does not show enough touches near MA100/MA200 to count as a strong floor."),
    buildSignal("Price is near strong floor", nearSupport, nearSupport ? "Daily closing price is still near the identified support floor." : "Price is not close enough to the support floor."),
    buildSignal("Hourly breakout with green candle", breakout, breakout ? "Hourly price broke the local downtrend." : "No hourly break of the local downtrend is visible."),
    buildSignal("Volume expansion", volumeConfirmed, volumeConfirmed ? "Latest hourly volume is above the elevated threshold." : "Breakout volume is not strong enough."),
    buildSignal("After 11 AM", after11, after11 ? "Execution timing is after 11:00 AM New York time." : "The latest candle is earlier than the preferred execution window."),
  ];

  return {
    strategyId: "strong_floor",
    strategyName: STRATEGY_LABELS.strong_floor,
    matched: reasons.every((reason) => reason.passed),
    score: reasons.filter((reason) => reason.passed).length / reasons.length,
    summary: reasons.every((reason) => reason.passed)
      ? "Daily support and hourly breakout align for the strong-floor setup."
      : "The strong-floor setup is missing support confirmation, breakout confirmation, or the required volume expansion.",
    reasonsPassed: reasons.filter((reason) => reason.passed),
    reasonsFailed: reasons.filter((reason) => !reason.passed),
    warnings: buildWarning(context.symbol),
    annotations: [
      ...(dailySupport ? [createHorizontalLine("strong-floor", "Daily support", dailySupport, "#22c55e")] : []),
      ...(resistance ? [createTrendLine("strong-floor-break", "Hourly break line", [resistance.from, resistance.to], "#f97316")] : []),
      createMarker("strong-floor-latest", "Latest candle", { time: lastHourly.time, value: lastHourly.close }, "#eab308"),
    ],
  };
}

function evaluateFirstGapUp(context: MarketContext): StrategyEvaluation {
  const grouped = new Map<string, EnrichedCandle[]>();
  for (const candle of context.hourly) {
    const key = getNewYorkDateKey(candle.time);
    grouped.set(key, [...(grouped.get(key) ?? []), candle]);
  }

  const sessionKey = Array.from(grouped.keys()).at(-1);
  const sessionCandles = sessionKey ? grouped.get(sessionKey) ?? [] : [];
  const firstCandle = sessionCandles[0];
  const lastCandle = latest(context.hourly);
  const prevDaily = context.daily.slice(-8, -1);
  const currentDaily = latest(context.daily);
  const support = nonNullLast(currentDaily.ma100, currentDaily.ma200);
  const priorDowntrend = prevDaily.length >= 5 && prevDaily[0].close > currentDaily.close;
  const nearSupport = support !== null && isNearLevel(currentDaily.close, support, context.profile.supportTolerancePct);
  const previousSession = Array.from(grouped.values()).at(-2);
  const previousClose = previousSession?.[previousSession.length - 1]?.close ?? context.daily.at(-2)?.close ?? 0;
  const gapUp = Boolean(firstCandle) && firstCandle.open > previousClose * (1 + context.profile.gapThresholdPct);
  const greenOpen = Boolean(firstCandle) && isBullishCandle(firstCandle);
  const elevatedVolume =
    Boolean(firstCandle) &&
    firstCandle.volume >= Math.max(context.profile.firstGapMinVolume, context.averageHourlyVolume * context.profile.elevatedVolumeMultiplier);
  const floorHeld = Boolean(firstCandle) && sessionCandles.every((candle) => candle.low >= firstCandle.low);
  const after11 = getNewYorkHour(lastCandle.time) >= 11;

  const reasons = [
    buildSignal("Prior daily decline", priorDowntrend, priorDowntrend ? "Daily context shows a meaningful preceding decline." : "Daily context does not show a strong enough prior decline."),
    buildSignal("Near daily strong floor", nearSupport, nearSupport ? "Price is sitting near the daily support floor." : "Price is not close enough to the daily strong floor."),
    buildSignal("First hourly candle is green", greenOpen, greenOpen ? "The opening hourly candle is bullish." : "The opening hourly candle is not green."),
    buildSignal("Visible gap up", gapUp, gapUp ? "The session opened above the prior close with a measurable gap." : "No measurable bullish gap is present at the session open."),
    buildSignal("Volume spike", elevatedVolume, elevatedVolume ? "Opening volume clears the strategy's elevated threshold." : "Opening volume is below the strategy threshold."),
    buildSignal("Gap floor held", floorHeld, floorHeld ? "The first-hour low has held through the session." : "The first-hour low has been broken, invalidating the gap setup."),
    buildSignal("Latest market context is after 11 AM", after11, after11 ? "The current session has advanced past the post-11 AM decision window." : "The current session is still too early for the final decision framing."),
  ];

  return {
    strategyId: "first_gap_up",
    strategyName: STRATEGY_LABELS.first_gap_up,
    matched: reasons.every((reason) => reason.passed),
    score: reasons.filter((reason) => reason.passed).length / reasons.length,
    summary: reasons.every((reason) => reason.passed)
      ? "The latest session opened with a validated green gap from strong daily support."
      : "The first-gap setup is incomplete because the context, gap, or floor-hold conditions are not all aligned.",
    reasonsPassed: reasons.filter((reason) => reason.passed),
    reasonsFailed: reasons.filter((reason) => !reason.passed),
    warnings: buildWarning(context.symbol),
    annotations: [
      ...(support ? [createHorizontalLine("gap-support", "Daily floor", support, "#22c55e")] : []),
      ...(firstCandle ? [createHorizontalLine("gap-floor", "First candle low", firstCandle.low, "#a855f7")] : []),
      ...(firstCandle ? [createMarker("gap-open", "Gap open", { time: firstCandle.time, value: firstCandle.open }, "#e11d48")] : []),
    ],
  };
}

function evaluatePutFirstRed10am(context: MarketContext): StrategyEvaluation {
  const lastCandle = latest(context.hourly);
  const ordered =
    lastCandle.ma20 !== null &&
    lastCandle.ma40 !== null &&
    lastCandle.ma100 !== null &&
    lastCandle.ma20 !== null && // Avoid unused variable, just strict check
    lastCandle.ma20 < lastCandle.ma40 &&
    lastCandle.ma40 < lastCandle.ma100;
    
  const expensiveZone =
    lastCandle.ma40 !== null &&
    (lastCandle.close > lastCandle.ma40 || isNearLevel(lastCandle.close, lastCandle.ma40, context.profile.nearMaTolerancePct));
    
  const is10am = getNewYorkHour(lastCandle.time) === 10;
  
  const supportLine = findAscendingSupport(context.hourly.slice(-14));
  const breakoutDown = Boolean(supportLine) && isBearishCandle(lastCandle) && lastCandle.close < (supportLine?.supportAtLatest ?? 0);
  
  const elevatedVolume = lastCandle.volume >= context.averageHourlyVolume;
  
  const reasons = [
    buildSignal("Bearish MA stack", ordered, ordered ? "20 < 40 < 100 on the latest hourly candle." : "Hourly moving averages are not in the required bearish order."),
    buildSignal("Expensive zone / bounce fail", expensiveZone, expensiveZone ? "Price is near or above PM40, indicating a failed bounce attempt." : "Price is not high enough to be considered a rejection zone."),
    buildSignal("Ascending line broken", breakoutDown, breakoutDown ? "The 10am red candle broke the recent ascending support line." : "No confirmed bearish break of the local ascending line."),
    buildSignal("10 AM candle is red", is10am && isBearishCandle(lastCandle), is10am && isBearishCandle(lastCandle) ? "The 10 AM hourly candle closed strong red." : "The latest candle is not a strong red 10 AM candle."),
    buildSignal("Elevated volume", elevatedVolume, elevatedVolume ? "Volume is above average." : "Volume is not above average."),
  ];
  
  return {
    strategyId: "put_first_red_10am",
    strategyName: STRATEGY_LABELS.put_first_red_10am,
    matched: reasons.every((reason) => reason.passed),
    score: reasons.filter((reason) => reason.passed).length / reasons.length,
    summary: reasons.every((reason) => reason.passed)
      ? "The 10 AM candle rejected resistance and broke the local ascending support with high volume."
      : "The 10 AM first red candle setup is incomplete or missing key rejection signs.",
    reasonsPassed: reasons.filter((reason) => reason.passed),
    reasonsFailed: reasons.filter((reason) => !reason.passed),
    warnings: buildWarning(context.symbol),
    annotations: [
      ...(lastCandle.ma40 ? [createHorizontalLine("pm40", "PM40 zone", lastCandle.ma40, "#ef4444")] : []),
      ...(supportLine ? [createTrendLine("put-10am-break", "Support break line", [supportLine.from, supportLine.to], "#b91c1c")] : []),
      createMarker("put-10am-latest", "10am candle", { time: lastCandle.time, value: lastCandle.close }, "#eab308"),
    ],
  };
}

function evaluatePutBearChannel(context: MarketContext): StrategyEvaluation {
  const line = findDescendingResistance(context.hourly);
  const lastCandle = latest(context.hourly);
  const previousCandle = context.hourly.length >= 2 ? context.hourly[context.hourly.length - 2] : null;
  
  const inExpensiveZone = Boolean(line) && lastCandle.close >= (line?.resistanceAtLatest ?? 0) * (1 - context.profile.nearMaTolerancePct);
  const isEngulfing = Boolean(previousCandle) && isBearishEngulfing(previousCandle as EnrichedCandle, lastCandle);
  
  const supportLine = findAscendingSupport(context.hourly.slice(-14));
  const breakoutDown = Boolean(supportLine) && lastCandle.close < (supportLine?.supportAtLatest ?? 0);
  
  const reasons = [
    buildSignal("Descending channel exists", Boolean(line), line ? "Recent hourly highs form a downward ceiling." : "No clear descending channel was detected."),
    buildSignal("In expensive zone (channel ceiling)", inExpensiveZone, inExpensiveZone ? "Price is near the top of the descending channel." : "Price is not near the channel's ceiling."),
    buildSignal("Bounce attempt erased (Engulfing)", isEngulfing, isEngulfing ? "A bearish engulfing pattern erased the previous green bounce." : "No bearish engulfing pattern observed on the latest candles."),
    buildSignal("Ascending floor broken", breakoutDown, breakoutDown ? "The red candle broke the local ascending support line." : "The red candle has not broken the recent ascending support line."),
  ];
  
  return {
    strategyId: "put_bear_channel",
    strategyName: STRATEGY_LABELS.put_bear_channel,
    matched: reasons.every((reason) => reason.passed),
    score: reasons.filter((reason) => reason.passed).length / reasons.length,
    summary: reasons.every((reason) => reason.passed)
      ? "Price hit the descending channel ceiling, formed a bearish engulfing, and broke the ascending floor."
      : "The canal bajista setup is incomplete (missing channel, engulfing, or support break).",
    reasonsPassed: reasons.filter((reason) => reason.passed),
    reasonsFailed: reasons.filter((reason) => !reason.passed),
    warnings: buildWarning(context.symbol),
    annotations: [
      ...(line ? [createTrendLine("put-channel", "Channel ceiling", [line.from, line.to], "#f43f5e")] : []),
      ...(supportLine ? [createTrendLine("put-channel-break", "Support break line", [supportLine.from, supportLine.to], "#9f1239")] : []),
      createMarker("put-channel-latest", "Engulfing candle", { time: lastCandle.time, value: lastCandle.close }, "#eab308"),
    ],
  };
}

export function buildMarketContext(input: {
  symbol: string;
  displayName: string;
  hourly: EnrichedCandle[];
  daily: EnrichedCandle[];
}): MarketContext {
  return {
    symbol: input.symbol,
    displayName: input.displayName,
    profile: buildProfile(input.symbol),
    hourly: input.hourly,
    daily: input.daily,
    averageHourlyVolume: averageVolume(input.hourly),
    isSpyTuned: input.symbol !== "SPY",
  };
}

export function evaluateStrategies(context: MarketContext): StrategyEvaluation[] {
  return [
    evaluateFirstGapUp(context),
    evaluateStrongFloor(context),
    evaluateRegularOrStrongDrop(context),
    evaluatePm40Hour(context),
    evaluateBearChannel(context),
    evaluatePutFirstRed10am(context),
    evaluatePutBearChannel(context),
  ];
}

export function buildIndicatorSnapshot(context: MarketContext): IndicatorSnapshot {
  const lastHourly = latest(context.hourly);
  const lastDaily = latest(context.daily);
  const sessionKey = getNewYorkDateKey(lastHourly.time);
  const sessionCandles = context.hourly.filter((candle) => getNewYorkDateKey(candle.time) === sessionKey);

  return {
    latestClose: lastHourly.close,
    latestVolume: lastHourly.volume,
    averageHourlyVolume: context.averageHourlyVolume,
    ma20: lastHourly.ma20,
    ma40: lastHourly.ma40,
    ma100: lastHourly.ma100,
    ma200: lastHourly.ma200,
    dailyMa100: lastDaily.ma100,
    dailyMa200: lastDaily.ma200,
    dailySupport: nonNullLast(lastDaily.ma100, lastDaily.ma200),
    sessionFirstCandleLow: sessionCandles[0]?.low ?? null,
  };
}

export function buildAnalysisResponse(input: {
  symbol: string;
  displayName: string;
  hourly: EnrichedCandle[];
  daily: EnrichedCandle[];
}): AnalysisResponse {
  const context = buildMarketContext(input);
  const strategies = evaluateStrategies(context);
  const matchedStrategy = strategies
    .filter((strategy) => strategy.matched)
    .sort((left, right) => right.score - left.score)[0] ?? null;
  const bestCandidate = matchedStrategy ?? [...strategies].sort((left, right) => right.score - left.score)[0];
  const warnings = Array.from(new Set(strategies.flatMap((strategy) => strategy.warnings)));
  const swingLow = findRecentSwingLow(context.hourly);
  const derivedAnnotations = [
    ...(bestCandidate?.annotations ?? []),
    ...(swingLow ? [createMarker("recent-swing-low", "Recent swing low", swingLow, "#14b8a6")] : []),
  ];

  return {
    symbol: input.symbol,
    asOf: latest(context.hourly).time,
    matchedStrategy,
    summary: matchedStrategy
      ? `${matchedStrategy.strategyName}: ${matchedStrategy.summary}`
      : `No strategy is fully confirmed right now. Closest setup: ${bestCandidate.strategyName}.`,
    indicators: buildIndicatorSnapshot(context),
    signals: [...bestCandidate.reasonsPassed, ...bestCandidate.reasonsFailed],
    warnings,
    annotations: derivedAnnotations,
    candles: {
      hourly: context.hourly.slice(-CHART_WINDOW),
      daily: context.daily,
    },
    strategies,
    disclaimer: DISCLAIMER,
  };
}
