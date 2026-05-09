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
}: {
  candles: EnrichedCandle[] | null;
  annotations: ChartAnnotation[];
  emptyLabel: string;
  height: number;
  chartRef?: MutableRefObject<IChartApi | null>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current || !candles) {
      return;
    }

    const chart = createChart(hostRef.current, {
      layout: {
        background: { color: "#fffdf9" },
        textColor: "#334155",
        fontFamily: "Georgia, serif",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.18)" },
        horzLines: { color: "rgba(148, 163, 184, 0.18)" },
      },
      width: hostRef.current.clientWidth,
      height,
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.25)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.25)",
      },
    });
    if (chartRef) {
      chartRef.current = chart;
    }

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
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

    addMaSeries(chart, candles, (candle) => candle.ma20, "#0f172a");
    addMaSeries(chart, candles, (candle) => candle.ma40, "#d946ef");
    addMaSeries(chart, candles, (candle) => candle.ma100, "#f97316");
    addMaSeries(chart, candles, (candle) => candle.ma200, "#7c3aed");

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
  }, [annotations, candles, chartRef, height]);

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
}: {
  candles: EnrichedCandle[] | null;
  annotations: ChartAnnotation[];
  emptyLabel: string;
  expandLabel: string;
  closeLabel: string;
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
