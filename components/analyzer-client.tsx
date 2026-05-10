"use client";

import { useEffect, useState } from "react";
import type {
  AnalysisResponse,
  ChartAnnotation,
  SignalCheck,
  StrategyEvaluation,
  StrategyId,
  WatchlistResponse,
} from "@/lib/types";
import { StrategyChart } from "@/components/strategy-chart";
import { WATCHLIST_SYMBOLS } from "@/lib/watchlist";
type Locale = "en" | "es";

const COPY = {
  en: {
    eyebrow: "Yahoo Finance + Cardona rules",
    headline: "Analyze Your Top Stock Strategies!",
    intro:
      "This MVP reads recent daily and hourly candles, applies all five bullish strategies from the Cardona guide, and explains the closest live setup with chart overlays and a deterministic rule checklist.",
    search: "Search",
    searchHelp:
      "Type a ticker, pull the latest Yahoo Finance candles, and score all five strategies.",
    analyze: "Analyze",
    scanning: "Scanning...",
    translate: "Translate to Spanish",
    translateBack: "Translate to English",
    disclaimer:
      "Final decisions in the source guide happen on the hourly timeframe after 11:00 AM. This tool is educational only and does not place trades or give advice.",
    requestFailed: "Request failed.",
    fetchError: "Unable to analyze the symbol.",
    matchedLive: "Matched setup live",
    noMatch: "No fully confirmed setup",
    closestSetupOnly: "Closest setup only",
    noSymbol: "No symbol analyzed yet",
    startWithSpy: "Start with SPY",
    spyHelp:
      "The strategy engine is tuned for SPY first because the guide uses SPY-specific drop, support, and volume thresholds.",
    latestClose: "Latest close",
    avgVolume: "Avg hourly volume",
    dailySupport: "Daily support",
    checklist: "Rule checklist",
    chart: "Chart",
    chartHelp:
      "Hourly candlesticks with moving averages and setup annotations.",
    chartEmpty: "Run an analysis to render the hourly chart.",
    chartReset: "Reset view",
    chartExpand: "Expand",
    chartClose: "Close",
    strategySelector: "Strategies",
    strategySelectorHelp:
      "Pick any strategy to inspect its score, rule passes, failures, and chart overlays.",
    screener: "Watchlist Screener",
    screenerHelp:
      "Scan the full 21-symbol watchlist and fully analyze every symbol so the whole board shows real strategy results.",
    screenerRefresh: "Refresh watchlist",
    screenerRefreshing: "Refreshing watchlist...",
    screenerTop: "Top opportunities",
    screenerTable: "Full watchlist",
    screenerAnalyzed: "Fully analyzed",
    screenerError: "Analysis error",
    screenerOpen: "Open symbol",
    screenerNoResults: "No fully analyzed opportunities are available yet.",
    screenerCacheCached: "cached",
    screenerCacheFresh: "fresh",
    screenerCacheRefreshed: "refreshed",
    screenerVolume: "Volume",
    screenerChange: "Move",
    screenerStrategy: "Best strategy",
    pass: "Pass",
    fail: "Fail",
    asOf: "As of",
    ma40: "PM40",
    supportLegend: "MA40 / support",
    breakLegend: "Break / trend line",
    gapLegend: "Gap floor",
    triggerLegend: "Trigger marker",
  },
  es: {
    eyebrow: "Yahoo Finance + reglas de Cardona",
    headline: "Analiza Tus Estrategias de Acciones Favoritas!",
    intro:
      "Este MVP lee velas recientes diarias y por hora, aplica las cinco estrategias alcistas de la guía de Cardona y explica la configuración más cercana con anotaciones en el gráfico y una lista determinística de reglas.",
    search: "Buscar",
    searchHelp:
      "Escribe un ticker, trae las velas más recientes de Yahoo Finance y puntúa las cinco estrategias.",
    analyze: "Analizar",
    scanning: "Analizando...",
    translate: "Traducir al español",
    translateBack: "Translate to English",
    disclaimer:
      "Las decisiones finales en la guía original ocurren en el marco de una hora después de las 11:00 AM. Esta herramienta es solo educativa y no ejecuta operaciones ni da asesoría financiera.",
    requestFailed: "La solicitud falló.",
    fetchError: "No se pudo analizar el símbolo.",
    matchedLive: "Estrategia confirmada ahora",
    noMatch: "No hay una estrategia totalmente confirmada",
    closestSetupOnly: "Solo estrategia más cercana",
    noSymbol: "Todavía no se ha analizado un símbolo",
    startWithSpy: "Empieza con SPY",
    spyHelp:
      "El motor de estrategias está ajustado primero para SPY porque la guía usa umbrales específicos de SPY para caída, soporte y volumen.",
    latestClose: "Último cierre",
    avgVolume: "Volumen horario promedio",
    dailySupport: "Soporte diario",
    checklist: "Lista de reglas",
    chart: "Gráfico",
    chartHelp:
      "Velas por hora con medias móviles y anotaciones de la estrategia.",
    chartEmpty: "Ejecuta un análisis para mostrar el gráfico por hora.",
    chartReset: "Reiniciar vista",
    chartExpand: "Expandir",
    chartClose: "Cerrar",
    strategySelector: "Estrategias",
    strategySelectorHelp:
      "Elige cualquier estrategia para revisar su puntaje, reglas aprobadas, fallidas y anotaciones del gráfico.",
    screener: "Monitor de Watchlist",
    screenerHelp:
      "Escanea la watchlist completa de 21 símbolos y analiza por completo cada uno para que toda la tabla muestre resultados reales de estrategia.",
    screenerRefresh: "Actualizar watchlist",
    screenerRefreshing: "Actualizando watchlist...",
    screenerTop: "Mejores oportunidades",
    screenerTable: "Watchlist completa",
    screenerAnalyzed: "Analizado por completo",
    screenerError: "Error de análisis",
    screenerOpen: "Abrir símbolo",
    screenerNoResults: "Todavía no hay oportunidades analizadas por completo.",
    screenerCacheCached: "en caché",
    screenerCacheFresh: "nuevo",
    screenerCacheRefreshed: "actualizado",
    screenerVolume: "Volumen",
    screenerChange: "Movimiento",
    screenerStrategy: "Mejor estrategia",
    pass: "Pasa",
    fail: "Falla",
    asOf: "Hora",
    ma40: "PM40",
    supportLegend: "PM40 / soporte",
    breakLegend: "Ruptura / línea de tendencia",
    gapLegend: "Piso del gap",
    triggerLegend: "Marcador de activación",
  },
} as const;

const TRANSLATIONS: Record<string, string> = {
  "Educational use only. This app summarizes a rule-based interpretation of the Cardona guide and is not financial advice.":
    "Solo para uso educativo. Esta app resume una interpretación basada en reglas de la guía de Cardona y no constituye asesoría financiera.",
  "Bullish MA stack": "Orden alcista de medias móviles",
  "20 > 40 > 100 > 200 on the latest hourly candle.":
    "20 > 40 > 100 > 200 en la vela horaria más reciente.",
  "Hourly moving averages are not in the required bullish order.":
    "Las medias móviles horarias no están en el orden alcista requerido.",
  "Near PM40": "Cerca del PM40",
  "Price is still in the guide's cheap zone near the 40-hour average.":
    "El precio sigue en la zona barata de la guía, cerca del promedio móvil de 40 horas.",
  "Price is too far from the 40-hour average.":
    "El precio está demasiado lejos del promedio móvil de 40 horas.",
  "Breakout candle": "Vela de ruptura",
  "A green candle broke the local descending line.":
    "Una vela verde rompió la línea bajista local.",
  "No confirmed bullish break of the local descending line.":
    "No hay una ruptura alcista confirmada de la línea bajista local.",
  "After 11 AM": "Después de las 11 AM",
  "The latest execution candle is after 11:00 AM New York time.":
    "La última vela de ejecución es después de las 11:00 AM hora de Nueva York.",
  "The latest candle is before the guide's preferred execution time.":
    "La última vela está antes del horario preferido por la guía.",
  "Descending channel exists": "Existe un canal bajista",
  "Recent hourly highs form a downward ceiling.":
    "Los máximos horarios recientes forman un techo descendente.",
  "No clear descending channel was detected.":
    "No se detectó un canal bajista claro.",
  "Stayed below ceiling before breakout":
    "Se mantuvo debajo del techo antes de la ruptura",
  "Price was already trading into the ceiling before the breakout candle.":
    "El precio ya estaba tocando el techo antes de la vela de ruptura.",
  "Recent candles respected the channel ceiling before the breakout.":
    "Las velas recientes respetaron el techo del canal antes de la ruptura.",
  "Green breakout candle": "Vela verde de ruptura",
  "The latest candle closes above the channel ceiling.":
    "La última vela cierra por encima del techo del canal.",
  "The latest candle has not confirmed a bullish break above the channel.":
    "La última vela no ha confirmado una ruptura alcista por encima del canal.",
  "Breakout timing is after 11:00 AM New York time.":
    "El momento de la ruptura es después de las 11:00 AM hora de Nueva York.",
  "The latest candle is earlier than the preferred execution window.":
    "La última vela es anterior a la ventana de ejecución preferida.",
  "Drop size qualifies": "La magnitud de la caída califica",
  "Hammer confirmation for strong drops":
    "Confirmación de martillo para caídas fuertes",
  "Strong-drop hammer confirmation rule is satisfied.":
    "Se cumple la regla de confirmación con vela martillo para caída fuerte.",
  "A strong drop was detected, but no hammer candle appeared before the breakout.":
    "Se detectó una caída fuerte, pero no apareció una vela martillo antes de la ruptura.",
  "Execution timing is after 11:00 AM New York time.":
    "El momento de ejecución es después de las 11:00 AM hora de Nueva York.",
  "The candidate candle is earlier than the guide's preferred execution window.":
    "La vela candidata es anterior a la ventana de ejecución preferida por la guía.",
  "Daily strong floor present": "Hay piso fuerte en diario",
  "Price is near strong floor": "El precio está cerca del piso fuerte",
  "Hourly breakout with green candle": "Ruptura horaria con vela verde",
  "Hourly price broke the local downtrend.":
    "El precio por hora rompió la tendencia bajista local.",
  "No hourly break of the local downtrend is visible.":
    "No se ve una ruptura horaria de la tendencia bajista local.",
  "Volume expansion": "Expansión de volumen",
  "Latest hourly volume is above the elevated threshold.":
    "El volumen horario más reciente está por encima del umbral elevado.",
  "Breakout volume is not strong enough.":
    "El volumen de la ruptura no es lo suficientemente fuerte.",
  "Prior daily decline": "Caída diaria previa",
  "Near daily strong floor": "Cerca del piso fuerte diario",
  "First hourly candle is green": "La primera vela horaria es verde",
  "The opening hourly candle is bullish.":
    "La vela horaria de apertura es alcista.",
  "The opening hourly candle is not green.":
    "La vela horaria de apertura no es verde.",
  "Visible gap up": "Gap alcista visible",
  "Volume spike": "Pico de volumen",
  "Gap floor held": "El piso del gap se mantiene",
  "The first-hour low has held through the session.":
    "El mínimo de la primera hora se ha mantenido durante la sesión.",
  "The first-hour low has been broken, invalidating the gap setup.":
    "El mínimo de la primera hora fue roto, invalidando la estrategia de gap.",
  "Latest market context is after 11 AM":
    "El contexto actual del mercado es después de las 11 AM",
  "The current session has advanced past the post-11 AM decision window.":
    "La sesión actual ya avanzó más allá de la ventana de decisión posterior a las 11 AM.",
  "The current session is still too early for the final decision framing.":
    "La sesión actual todavía es demasiado temprana para la decisión final.",
  "PM40 zone": "Zona PM40",
  "Break line": "Línea de ruptura",
  "Latest candle": "Última vela",
  "Channel ceiling": "Techo del canal",
  "Breakout check": "Revisión de ruptura",
  "Recovery line": "Línea de recuperación",
  "Drop start": "Inicio de la caída",
  "Daily support": "Soporte diario",
  "Hourly break line": "Línea de ruptura horaria",
  "Daily floor": "Piso diario",
  "First candle low": "Mínimo de la primera vela",
  "Gap open": "Apertura del gap",
  "Recent swing low": "Mínimo reciente",
};

function translateDynamic(text: string, locale: Locale) {
  if (locale === "en") {
    return text;
  }

  const exact = TRANSLATIONS[text];
  if (exact) {
    return exact;
  }

  let translated = text;
  translated = translated.replace(
    /^Recent decline is only ([\d.]+) points\.$/,
    "La caída reciente es de solo $1 puntos.",
  );
  translated = translated.replace(
    /^(Strong|Regular) decline detected at ([\d.]+) points\.$/,
    (_, kind: string, points: string) =>
      `${kind === "Strong" ? "Caída fuerte" : "Caída regular"} detectada de ${points} puntos.`,
  );
  translated = translated.replace(
    /^Daily support near ([\d.]+) has at least (\d+) touches\.$/,
    "El soporte diario cerca de $1 tiene al menos $2 toques.",
  );
  translated = translated.replace(
    /^The daily chart does not show enough touches near MA100\/MA200 to count as a strong floor\.$/,
    "El gráfico diario no muestra suficientes toques cerca de MA100/MA200 para contar como piso fuerte.",
  );
  translated = translated.replace(
    /^Daily closing price is still near the identified support floor\.$/,
    "El cierre diario sigue cerca del piso de soporte identificado.",
  );
  translated = translated.replace(
    /^Price is not close enough to the support floor\.$/,
    "El precio no está lo suficientemente cerca del piso de soporte.",
  );
  translated = translated.replace(
    /^Daily context shows a meaningful preceding decline\.$/,
    "El contexto diario muestra una caída previa importante.",
  );
  translated = translated.replace(
    /^Daily context does not show a strong enough prior decline\.$/,
    "El contexto diario no muestra una caída previa suficientemente fuerte.",
  );
  translated = translated.replace(
    /^Price is sitting near the daily support floor\.$/,
    "El precio está cerca del piso de soporte diario.",
  );
  translated = translated.replace(
    /^Price is not close enough to the daily strong floor\.$/,
    "El precio no está lo suficientemente cerca del piso fuerte diario.",
  );
  translated = translated.replace(
    /^The session opened above the prior close with a measurable gap\.$/,
    "La sesión abrió por encima del cierre previo con un gap medible.",
  );
  translated = translated.replace(
    /^No measurable bullish gap is present at the session open\.$/,
    "No hay un gap alcista medible en la apertura de la sesión.",
  );
  translated = translated.replace(
    /^Opening volume clears the strategy's elevated threshold\.$/,
    "El volumen de apertura supera el umbral elevado de la estrategia.",
  );
  translated = translated.replace(
    /^Opening volume is below the strategy threshold\.$/,
    "El volumen de apertura está por debajo del umbral de la estrategia.",
  );
  translated = translated.replace(
    /^([A-Z.]+) is analyzed with SPY-tuned thresholds\. Interpret matches cautiously\.$/,
    "$1 se analiza con umbrales ajustados para SPY. Interpreta las coincidencias con cautela.",
  );
  translated = translated.replace(
    /^No strategy is fully confirmed right now\. Closest setup: (.+)\.$/,
    "Ninguna estrategia está totalmente confirmada ahora. Configuración más cercana: $1.",
  );
  translated = translated.replace(
    /^(.+): (.+)$/,
    (_, strategy: string, summary: string) =>
      `${strategy}: ${translateDynamic(summary, locale)}`,
  );
  translated = translated.replace(
    /^Hourly structure is bullish, price is near PM40, and the latest candle confirms a post-11 AM breakout\.$/,
    "La estructura horaria es alcista, el precio está cerca del PM40 y la última vela confirma una ruptura después de las 11 AM.",
  );
  translated = translated.replace(
    /^The PM40 setup is incomplete because one or more structural conditions are missing\.$/,
    "La estrategia PM40 está incompleta porque falta una o más condiciones estructurales.",
  );
  translated = translated.replace(
    /^A descending hourly channel resolved with a post-11 AM green breakout\.$/,
    "Un canal bajista horario se resolvió con una ruptura verde después de las 11 AM.",
  );
  translated = translated.replace(
    /^The bearish channel setup is incomplete or still trading inside the channel\.$/,
    "La estrategia de canal bajista está incompleta o sigue cotizando dentro del canal.",
  );
  translated = translated.replace(
    /^A (strong|regular) pullback recovered with the required breakout candle\.$/,
    (_, kind: string) =>
      `Un retroceso ${kind === "strong" ? "fuerte" : "regular"} se recuperó con la vela de ruptura requerida.`,
  );
  translated = translated.replace(
    /^The drop-and-reversal setup lacks enough downside magnitude or a confirmed breakout sequence\.$/,
    "La estrategia de caída y reversión no tiene suficiente magnitud bajista o una secuencia de ruptura confirmada.",
  );
  translated = translated.replace(
    /^Daily support and hourly breakout align for the strong-floor setup\.$/,
    "El soporte diario y la ruptura horaria se alinean para la estrategia de piso fuerte.",
  );
  translated = translated.replace(
    /^The strong-floor setup is missing support confirmation, breakout confirmation, or the required volume expansion\.$/,
    "A la estrategia de piso fuerte le falta confirmación de soporte, confirmación de ruptura o la expansión de volumen requerida.",
  );
  translated = translated.replace(
    /^The latest session opened with a validated green gap from strong daily support\.$/,
    "La sesión más reciente abrió con un gap verde validado desde un soporte diario fuerte.",
  );
  translated = translated.replace(
    /^The first-gap setup is incomplete because the context, gap, or floor-hold conditions are not all aligned\.$/,
    "La estrategia del primer gap está incompleta porque el contexto, el gap o las condiciones del piso no están completamente alineados.",
  );

  return translated;
}

function fmtNumber(value: number | null, decimals = 2) {
  if (value === null) {
    return "N/A";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function SignalChecklist({
  locale,
  signals,
}: {
  locale: Locale;
  signals: SignalCheck[];
}) {
  const copy = COPY[locale];
  return (
    <ul className="list">
      {signals.map((signal) => (
        <li key={`${signal.label}-${signal.detail}`}>
          <strong className={signal.passed ? "check-pass" : "check-fail"}>
            {signal.passed ? copy.pass : copy.fail}:{" "}
            {translateDynamic(signal.label, locale)}
          </strong>
          <div className="muted">{translateDynamic(signal.detail, locale)}</div>
        </li>
      ))}
    </ul>
  );
}

export function AnalyzerClient() {
  const [ticker, setTicker] = useState("SPY");
  const [locale, setLocale] = useState<Locale>("en");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [watchlistResult, setWatchlistResult] =
    useState<WatchlistResponse | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] =
    useState<StrategyId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const copy = COPY[locale];

  const activeStrategy =
    result?.strategies.find(
      (strategy) => strategy.strategyId === selectedStrategyId,
    ) ??
    result?.matchedStrategy ??
    result?.strategies[0] ??
    null;
  const activeSignals = activeStrategy
    ? [...activeStrategy.reasonsPassed, ...activeStrategy.reasonsFailed]
    : [];
  const activeWarnings = Array.from(
    new Set([...(result?.warnings ?? []), ...(activeStrategy?.warnings ?? [])]),
  );
  const activeAnnotations: ChartAnnotation[] = activeStrategy
    ? [...activeStrategy.annotations]
    : (result?.annotations ?? []);

  useEffect(() => {
    let cancelled = false;

    async function initialWatchlistLoad() {
      setWatchlistLoading(true);
      setWatchlistError(null);

      try {
        const response = await fetch("/api/watchlist");
        const payload = (await response.json()) as
          | WatchlistResponse
          | { error: string };
        if (!response.ok || "error" in payload) {
          throw new Error(
            "error" in payload ? payload.error : "Request failed.",
          );
        }
        if (!cancelled) {
          setWatchlistResult(payload);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setWatchlistError(
            fetchError instanceof Error
              ? fetchError.message
              : "Request failed.",
          );
        }
      } finally {
        if (!cancelled) {
          setWatchlistLoading(false);
        }
      }
    }

    void initialWatchlistLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runAnalysis(nextTicker: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analyze?ticker=${encodeURIComponent(nextTicker)}`,
      );
      const payload = (await response.json()) as
        | AnalysisResponse
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload ? payload.error : copy.requestFailed,
        );
      }

      setResult(payload);
      setSelectedStrategyId(
        payload.matchedStrategy?.strategyId ??
          payload.strategies[0]?.strategyId ??
          null,
      );
    } catch (fetchError) {
      setResult(null);
      setSelectedStrategyId(null);
      setError(
        fetchError instanceof Error ? fetchError.message : copy.fetchError,
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadWatchlist(forceRefresh: boolean) {
    setWatchlistLoading(true);
    setWatchlistError(null);

    try {
      const response = await fetch(
        `/api/watchlist${forceRefresh ? "?refresh=1" : ""}`,
      );
      const payload = (await response.json()) as
        | WatchlistResponse
        | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Request failed.");
      }
      setWatchlistResult(payload);
    } catch (fetchError) {
      setWatchlistError(
        fetchError instanceof Error ? fetchError.message : "Request failed.",
      );
    } finally {
      setWatchlistLoading(false);
    }
  }

  function watchlistStatusLabel(status: string) {
    switch (status) {
      case "cached":
        return copy.screenerCacheCached;
      case "fresh":
        return copy.screenerCacheFresh;
      case "refreshed":
        return copy.screenerCacheRefreshed;
      default:
        return status;
    }
  }

  function translateStrategy(strategy: StrategyEvaluation) {
    return {
      ...strategy,
      strategyName: strategy.strategyName,
      summary: translateDynamic(strategy.summary, locale),
      warnings: strategy.warnings.map((warning) =>
        translateDynamic(warning, locale),
      ),
      reasonsPassed: strategy.reasonsPassed.map((reason) => ({
        ...reason,
        label: translateDynamic(reason.label, locale),
        detail: translateDynamic(reason.detail, locale),
      })),
      reasonsFailed: strategy.reasonsFailed.map((reason) => ({
        ...reason,
        label: translateDynamic(reason.label, locale),
        detail: translateDynamic(reason.detail, locale),
      })),
      annotations: strategy.annotations.map((annotation) => ({
        ...annotation,
        label: translateDynamic(annotation.label, locale),
      })),
    };
  }

  const visibleStrategy = activeStrategy
    ? translateStrategy(activeStrategy)
    : null;

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1>{copy.headline}</h1>
        <p>{copy.intro}</p>
      </section>

      <section className="grid">
        <aside className="panel">
          <div className="panel-inner">
            <div className="toolbar-row">
              <div>
                <h2>{copy.search}</h2>
                <p className="muted">{copy.searchHelp}</p>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setLocale(locale === "en" ? "es" : "en")}
              >
                {locale === "en" ? copy.translate : copy.translateBack}
              </button>
            </div>
            <form
              className="search-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAnalysis(ticker);
              }}
            >
              <input
                aria-label="Ticker"
                value={ticker}
                onChange={(event) =>
                  setTicker(event.target.value.toUpperCase())
                }
                placeholder="SPY"
              />

              <div className="badge-row">
                {WATCHLIST_SYMBOLS.map((symbol) => (
                  <button
                    key={symbol}
                    className="badge badge-button"
                    type="button"
                    onClick={() => {
                      setTicker(symbol);
                      void runAnalysis(symbol);
                    }}
                  >
                    {symbol}
                  </button>
                ))}
              </div>

              <button className="primary-button" type="submit">
                {loading ? copy.scanning : copy.analyze}
              </button>
            </form>

            {error ? <p className="error">{error}</p> : null}

            <div className="disclaimer">{copy.disclaimer}</div>
          </div>
        </aside>

        <section className="panel">
          <div className="panel-inner">
            {result ? (
              <div className="strategy-card">
                <div
                  className={`status-pill ${result.matchedStrategy ? "ok" : "no"}`}
                >
                  {result.matchedStrategy ? copy.matchedLive : copy.noMatch}
                </div>
                <div>
                  <div className="muted">
                    {result.symbol} • {copy.asOf}{" "}
                    {new Date(result.asOf).toLocaleString()}
                  </div>
                  <h2>
                    {visibleStrategy?.strategyName ?? copy.closestSetupOnly}
                  </h2>
                  <p className="muted">
                    {visibleStrategy
                      ? visibleStrategy.summary
                      : translateDynamic(result.summary, locale)}
                  </p>
                </div>

                <div>
                  <h3>{copy.strategySelector}</h3>
                  <p className="muted">{copy.strategySelectorHelp}</p>
                </div>

                <div className="strategy-selector">
                  {result.strategies.map((strategy) => (
                    <button
                      className={`strategy-pill ${selectedStrategyId === strategy.strategyId ? "active" : ""}`}
                      key={strategy.strategyId}
                      type="button"
                      onClick={() => setSelectedStrategyId(strategy.strategyId)}
                    >
                      {strategy.strategyName}:{" "}
                      {(strategy.score * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>

                <div className="stats">
                  <div className="stat">
                    {copy.latestClose}
                    <strong>${fmtNumber(result.indicators.latestClose)}</strong>
                  </div>
                  <div className="stat">
                    {copy.avgVolume}
                    <strong>
                      {Math.round(
                        result.indicators.averageHourlyVolume,
                      ).toLocaleString()}
                    </strong>
                  </div>
                  <div className="stat">
                    {copy.ma40}
                    <strong>{fmtNumber(result.indicators.ma40)}</strong>
                  </div>
                  <div className="stat">
                    {copy.dailySupport}
                    <strong>{fmtNumber(result.indicators.dailySupport)}</strong>
                  </div>
                </div>

                {activeWarnings.map((warning) => (
                  <p className="warning" key={warning}>
                    {translateDynamic(warning, locale)}
                  </p>
                ))}

                <div>
                  <h3>{copy.checklist}</h3>
                  <SignalChecklist locale={locale} signals={activeSignals} />
                </div>
              </div>
            ) : (
              <div className="strategy-card">
                <div className="status-pill">{copy.noSymbol}</div>
                <h2>{copy.startWithSpy}</h2>
                <p className="muted">{copy.spyHelp}</p>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-inner chart-wrap">
            <div>
              <h2>{copy.chart}</h2>
              <p className="muted">{copy.chartHelp}</p>
            </div>
            <div className="chart-surface">
              <StrategyChart
                candles={result?.candles.hourly ?? null}
                annotations={
                  visibleStrategy?.annotations ??
                  activeAnnotations.map((annotation) => ({
                    ...annotation,
                    label: translateDynamic(annotation.label, locale),
                  }))
                }
                emptyLabel={copy.chartEmpty}
                expandLabel={copy.chartExpand}
                closeLabel={copy.chartClose}
              />
            </div>
            <div className="chart-legend">
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "#0f172a" }}
                />{" "}
                MA20
              </span>
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "#d946ef" }}
                />{" "}
                {copy.supportLegend}
              </span>
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "#f97316" }}
                />{" "}
                {copy.breakLegend}
              </span>
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "#a855f7" }}
                />{" "}
                {copy.gapLegend}
              </span>
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "#eab308" }}
                />{" "}
                {copy.triggerLegend}
              </span>
            </div>
            {result ? (
              <p className="disclaimer">
                {translateDynamic(result.disclaimer, locale)}
              </p>
            ) : null}
          </div>
        </section>
      </section>

      <section className="watchlist-grid">
        <section className="panel watchlist-panel">
          <div className="panel-inner watchlist-wrap">
            <div className="toolbar-row">
              <div>
                <h2>{copy.screener}</h2>
                <p className="muted">{copy.screenerHelp}</p>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => void loadWatchlist(true)}
              >
                {watchlistLoading
                  ? copy.screenerRefreshing
                  : copy.screenerRefresh}
              </button>
            </div>

            {watchlistError ? <p className="error">{watchlistError}</p> : null}

            <div>
              <h3>{copy.screenerTop}</h3>
              {watchlistResult &&
              watchlistResult.topOpportunities.length > 0 ? (
                <div className="watchlist-top-grid">
                  {watchlistResult.topOpportunities.map((opportunity) => (
                    <button
                      key={`${opportunity.symbol}-${opportunity.bestStrategyId}`}
                      className="watchlist-card"
                      type="button"
                      onClick={() => {
                        setTicker(opportunity.symbol);
                        void runAnalysis(opportunity.symbol);
                      }}
                    >
                      <div className="watchlist-card-head">
                        <strong>{opportunity.symbol}</strong>
                        <span
                          className={`status-pill ${opportunity.matched ? "ok" : "no"}`}
                        >
                          {watchlistStatusLabel(opportunity.analysisSource)}
                        </span>
                      </div>
                      <div className="muted">
                        {opportunity.bestStrategyName}
                      </div>
                      <div className="watchlist-score">
                        {(opportunity.score * 100).toFixed(0)}%
                      </div>
                      <div className="muted">
                        {translateDynamic(opportunity.summary, locale)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">{copy.screenerNoResults}</p>
              )}
            </div>

            <div>
              <h3>{copy.screenerTable}</h3>
              <div className="watchlist-table-wrap">
                <table className="watchlist-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>{copy.latestClose}</th>
                      <th>{copy.screenerChange}</th>
                      <th>{copy.screenerVolume}</th>
                      <th>{copy.screenerStrategy}</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistResult?.quotes.map((row) => (
                      <tr key={row.symbol}>
                        <td>
                          <button
                            className="watchlist-symbol-button"
                            type="button"
                            onClick={() => {
                              setTicker(row.symbol);
                              void runAnalysis(row.symbol);
                            }}
                          >
                            {row.symbol}
                          </button>
                        </td>
                        <td>
                          {row.regularMarketPrice === null
                            ? "N/A"
                            : `$${fmtNumber(row.regularMarketPrice)}`}
                        </td>
                        <td>
                          {row.regularMarketChangePercent === null
                            ? "N/A"
                            : `${fmtNumber(row.regularMarketChangePercent)}%`}
                        </td>
                        <td>
                          {row.regularMarketVolume === null
                            ? "N/A"
                            : Math.round(
                                row.regularMarketVolume,
                              ).toLocaleString()}
                        </td>
                        <td>
                          {row.bestStrategyName ? (
                            <div>
                              <strong>{row.bestStrategyName}</strong>
                              <div className="muted">
                                {row.score !== undefined
                                  ? `${(row.score * 100).toFixed(0)}%`
                                  : ""}
                              </div>
                            </div>
                          ) : row.analysisStatus === "error" ? (
                            <span className="error">{copy.screenerError}</span>
                          ) : (
                            <span className="muted">{copy.screenerError}</span>
                          )}
                        </td>
                        <td>
                          <div className="watchlist-status-cell">
                            <span
                              className={`status-pill ${row.matched ? "ok" : "no"}`}
                            >
                              {row.analysisStatus === "error"
                                ? copy.screenerError
                                : copy.screenerAnalyzed}
                            </span>
                            <span className="muted">
                              {watchlistStatusLabel(row.cacheStatus)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )) ?? null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
