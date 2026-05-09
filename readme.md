# Strategy Signal Board

A simple educational web app for reviewing bullish stock strategies using recent Yahoo Finance data. This app was vibecoded for my dad lol.

The app reads daily and hourly candles, evaluates five Cardona-inspired setups, and shows:

- the current best live match, if one exists
- every strategy's score
- a rule-by-rule pass/fail breakdown for any selected strategy
- chart overlays explaining why the setup passed or failed
- an English/Spanish UI toggle

This project is built with `Next.js`, `React`, `TypeScript`, `yahoo-finance2`, and `lightweight-charts`.

## Disclaimer

This app is for educational use only. It does not place trades and does not provide financial advice.

## Features

- Server-side Yahoo Finance data fetching through `GET /api/analyze`
- Hourly + daily rule engine for 5 bullish strategies
- Strategy-by-strategy inspection instead of only the top match
- Interactive chart with:
  - candlesticks
  - MA20 / MA40 / MA100 / MA200 overlays
  - support lines
  - breakout lines
  - gap-floor markers
- English/Spanish UI toggle
- SPY-first thresholds with warnings for non-SPY symbols

## Strategies Included

The current MVP evaluates these five setups:

1. `PM 40 en Hora`
2. `Canal Bajista`
3. `Caida Regular/Fuerte`
4. `Piso Fuerte`
5. `Primer Gap al Alza`

These are implemented as deterministic heuristics based on the source guide. The app does not attempt subjective chart reading.

## Tech Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `yahoo-finance2`
- `lightweight-charts`
- `Vitest`
- `Testing Library`

## Getting Started

### Requirements

- `Node.js` 23+
- `npm`

### Install

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

Then open `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

## Deploying to Vercel

This project is designed to deploy on `Vercel`.

### Why Vercel

The app uses a server route at `app/api/analyze/route.ts` to fetch Yahoo Finance data and run the strategy engine. That means it needs a platform that can run Next.js server functionality, not just static files.

### One-Time Setup

1. Push this repository to GitHub.
2. Go to `https://vercel.com`.
3. Import `gabo0802/StockConverter`.
4. Keep the detected framework as `Next.js`.
5. Deploy.

### Build Settings

For this repo, the default Vercel settings should work:

- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Install Command: `npm install`
- Output: managed automatically by Vercel

The repo includes a minimal `vercel.json` so Vercel treats the project explicitly as a Next.js app.

### After Deploy

Vercel will give you a live URL such as:

```text
https://stock-converter-your-project.vercel.app
```

Each push to your main branch can automatically trigger a fresh deployment.

## Scripts

- `npm run dev` starts the Next.js dev server
- `npm run build` creates the production build
- `npm start` runs the production server
- `npm run lint` runs ESLint
- `npm test` runs the Vitest suite

## Project Structure

```text
app/
  api/analyze/route.ts     API endpoint for analysis
  globals.css              Global styling
  layout.tsx               Root layout
  page.tsx                 App entry page

components/
  analyzer-client.tsx      Search, language toggle, strategy selection UI
  strategy-chart.tsx       Chart renderer

lib/
  constants.ts             Strategy labels and defaults
  indicators.ts            Indicator and candle helpers
  strategy-engine.ts       Strategy evaluation logic
  types.ts                 Shared types
  yahoo.ts                 Yahoo Finance integration

tests/
  analyzer-client.test.tsx UI tests
  api-route.test.ts        API tests
  indicators.test.ts       Helper tests
  strategy-engine.test.ts  Strategy engine tests
```

## How It Works

### 1. Data Fetching

The app fetches:

- quote metadata
- recent hourly candles
- recent daily candles

All data is fetched on the server through `yahoo-finance2`.

### 2. Indicator Layer

The app computes:

- simple moving averages: `20`, `40`, `100`, `200`
- average hourly volume
- recent drop size
- support proximity
- descending resistance / breakout heuristics

### 3. Strategy Engine

Each strategy returns:

- whether it matched
- a score
- passed rules
- failed rules
- warnings
- chart annotations

The UI can inspect any strategy individually.

### 4. Charting

The chart displays recent hourly candles plus annotations from the currently selected strategy.

## API

### `GET /api/analyze?ticker=SPY`

Returns normalized analysis data for the requested ticker.

Example:

```json
{
  "symbol": "SPY",
  "asOf": "2026-05-09T16:00:00.000Z",
  "matchedStrategy": null,
  "summary": "No strategy is fully confirmed right now. Closest setup: PM 40 en Hora.",
  "indicators": {
    "latestClose": 500,
    "latestVolume": 100,
    "averageHourlyVolume": 90,
    "ma20": 499,
    "ma40": 498,
    "ma100": 495,
    "ma200": 490,
    "dailyMa100": 495,
    "dailyMa200": 490,
    "dailySupport": 495,
    "sessionFirstCandleLow": 497
  },
  "signals": [],
  "warnings": [],
  "annotations": [],
  "candles": {
    "hourly": [],
    "daily": []
  },
  "strategies": [],
  "disclaimer": "Educational use only. This app summarizes a rule-based interpretation of the Cardona guide and is not financial advice."
}
```

### Error Cases

- `400` when `ticker` is missing or invalid
- `502` when Yahoo/upstream analysis fails

## Current Product Behavior

- The app is tuned for `SPY` first.
- Non-`SPY` tickers can still be analyzed.
- Non-`SPY` symbols show a warning because thresholds are currently SPY-based.
- The UI starts in English and can be toggled to Spanish.
- Users can inspect all strategies, not just the strongest one.

## Testing

Run:

```bash
npm test
```

The suite covers:

- indicator helpers
- strategy engine behavior
- API route behavior
- client search/translation/strategy-selection flow

## Notes and Limitations

- Yahoo Finance is the only data source in this MVP.
- Strategy rules are heuristic approximations of the source guide.
- Some rules in the original guide are SPY-specific, especially volume and point-drop thresholds.
- There is no persistence, auth, watchlist, or historical replay mode in this version.

## Possible Next Steps

- historical date/time replay
- saved watchlists
- adjustable thresholds per ticker
- richer bilingual strategy copy from a dedicated i18n layer
- side-by-side daily and hourly chart views
