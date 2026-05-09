import { NextResponse } from "next/server";
import { fetchSymbolAnalysis } from "@/lib/yahoo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "Query param `ticker` is required." }, { status: 400 });
  }

  try {
    const analysis = await fetchSymbolAnalysis(ticker);
    return NextResponse.json(analysis, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis error.";
    const status = /required|invalid/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
