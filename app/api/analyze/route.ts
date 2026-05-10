import { NextResponse } from "next/server";
import { enforceRateLimit, validateTicker } from "@/lib/security";
import { getCachedSymbolAnalysis } from "@/lib/yahoo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request, "analyze");
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many analysis requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawTicker = searchParams.get("ticker");

  if (!rawTicker) {
    return NextResponse.json({ error: "Query param `ticker` is required." }, { status: 400 });
  }

  try {
    const ticker = validateTicker(rawTicker);
    const { analysis } = await getCachedSymbolAnalysis(ticker);
    return NextResponse.json(analysis, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis error.";
    const isClientError = /required|letters|numbers|dots|hyphens/i.test(message);

    if (isClientError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("Analyze route failed", error);
    return NextResponse.json(
      { error: "Unable to analyze this symbol right now." },
      { status: 502 },
    );
  }
}
