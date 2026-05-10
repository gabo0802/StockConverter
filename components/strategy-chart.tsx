"use client";

import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import type { ChartAnnotation, EnrichedCandle } from "@/lib/types";

type ThemeMode = "light" | "dark";

const CHART_THEME = {
  light: {
    background: "#fffdf9",
    text: "#334155",
    grid: "rgba(148, 163, 184, 0.18)",
    border: "rgba(148, 163, 184, 0.25)",
    up: "#16a34a",
    down: "#dc2626",
    ma20: "#38bdf8",
    ma40: "#f59e0b",
    ma100: "#f97316",
    ma200: "#8b5cf6",
  },
  dark: {
    background: "#0f172a",
    text: "#e2e8f0",
    grid: "rgba(148, 163, 184, 0.16)",
    border: "rgba(148, 163, 184, 0.28)",
    up: "#22c55e",
    down: "#f87171",
    ma20: "#67e8f9",
    ma40: "#fbbf24",
    ma100: "#fb923c",
    ma200: "#c084fc",
  },
} as const;

function toTimestamp(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}

function addMaSeries(chart: IChartApi, candles: EnrichedCandle[], accessor: (candle: EnrichedCandle) => number | null, color: string) {
  const series = chart.addSeries(LineSeries, {
    color,
    lineWidth: 3,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  });

  series.setData(
    candles
      .map((candle) => ({ time: toTimestamp(candle.time), value: accessor(candle) }))
      .filter((point): point is { time: UTCTimestamp; value: number } => typeof point.value === "number"),
  );
}

function addAnnotation(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  annotation: ChartAnnotation,
  markers: SeriesMarker<UTCTimestamp>[],
) {
  if (annotation.type === "horizontalLine" && typeof annotation.value === "number") {
    series.createPriceLine({
      price: annotation.value,
      title: annotation.label,
      color: annotation.color,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
    });
    return;
  }

  if (annotation.type === "marker" && annotation.point) {
    markers.push({
      time: toTimestamp(annotation.point.time),
      position: "aboveBar",
      color: annotation.color,
      shape: "circle",
      text: annotation.label,
    });
    return;
  }

  if (annotation.type === "trendLine" && annotation.points) {
    const lineSeries = chart.addSeries(LineSeries, {
      color: annotation.color,
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      lineStyle: LineStyle.Solid,
    });
    lineSeries.setData(
      annotation.points.map((point) => ({
        time: toTimestamp(point.time),
        value: point.value,
      })),
    );
  }
}

function StrategyChartCanvas({
  candles,
  annotations,
  emptyLabel,
  height,
  chartRef,
  theme,
}: {
  candles: EnrichedCandle[] | null;
  annotations: ChartAnnotation[];
  emptyLabel: string;
  height: number;
  chartRef?: MutableRefObject<IChartApi | null>;
  theme: ThemeMode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current || !candles) {
      return;
    }

    const palette = CHART_THEME[theme];
    const chart = createChart(hostRef.current, {
      layout: {
        background: { color: palette.background },
        textColor: palette.text,
        fontFamily: "Georgia, serif",
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      width: hostRef.current.clientWidth,
      height,
      timeScale: {
        borderColor: palette.border,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: palette.border,
      },
    });
    if (chartRef) {
      chartRef.current = chart;
    }

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderVisible: false,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });

    candleSeries.setData(
      candles.map((candle) => ({
        time: toTimestamp(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    addMaSeries(chart, candles, (candle) => candle.ma20, palette.ma20);
    addMaSeries(chart, candles, (candle) => candle.ma40, palette.ma40);
    addMaSeries(chart, candles, (candle) => candle.ma100, palette.ma100);
    addMaSeries(chart, candles, (candle) => candle.ma200, palette.ma200);

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    for (const annotation of annotations) {
      addAnnotation(chart, candleSeries, annotation, markers);
    }
    const seriesMarkers = createSeriesMarkers(candleSeries, markers);

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (hostRef.current) {
        chart.applyOptions({ width: hostRef.current.clientWidth });
      }
    });
    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      seriesMarkers.detach();
      if (chartRef) {
        chartRef.current = null;
      }
      chart.remove();
    };
  }, [annotations, candles, chartRef, height, theme]);

  if (!candles) {
    return <div ref={hostRef} style={{ height: "100%", minHeight: height, padding: 24 }} className="muted">{emptyLabel}</div>;
  }

  return <div ref={hostRef} style={{ height: "100%", minHeight: height }} />;
}

export function StrategyChart({
  candles,
  annotations,
  emptyLabel,
  expandLabel,
  closeLabel,
  theme,
}: {
  candles: EnrichedCandle[] | null;
  annotations: ChartAnnotation[];
  emptyLabel: string;
  expandLabel: string;
  closeLabel: string;
  theme: ThemeMode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const baseChartRef = useRef<IChartApi | null>(null);
  const modalChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  function resetView(target: "base" | "modal") {
    const chart = target === "base" ? baseChartRef.current : modalChartRef.current;
    chart?.timeScale().fitContent();
  }

  function onChartDoubleClick(target: "base" | "modal") {
    resetView(target);
  }

  return (
    <>
      <div className="chart-stage">
        <div className="chart-controls">
          <button className="chart-control-button" type="button" onClick={() => setIsExpanded(true)}>
            {expandLabel}
          </button>
        </div>
        <div className="chart-canvas-shell" onDoubleClick={() => onChartDoubleClick("base")}>
          <StrategyChartCanvas
            candles={candles}
            annotations={annotations}
            emptyLabel={emptyLabel}
            height={460}
            chartRef={baseChartRef}
            theme={theme}
          />
        </div>
      </div>

      {isExpanded && typeof document !== "undefined"
        ? createPortal(
            <div className="chart-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setIsExpanded(false)}>
              <div className="chart-modal" onClick={(event) => event.stopPropagation()}>
                <div className="chart-modal-toolbar">
                  <button className="chart-control-button" type="button" onClick={() => setIsExpanded(false)}>
                    {closeLabel}
                  </button>
                </div>
                <div className="chart-canvas-shell chart-canvas-expanded" onDoubleClick={() => onChartDoubleClick("modal")}>
                  <StrategyChartCanvas
                    candles={candles}
                    annotations={annotations}
                    emptyLabel={emptyLabel}
                    height={720}
                    chartRef={modalChartRef}
                    theme={theme}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export { CHART_THEME };
