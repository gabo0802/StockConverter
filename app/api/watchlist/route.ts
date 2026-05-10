import { NextResponse } from "next/server";
import { getWatchlistScreen } from "@/lib/watchlist-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh");

  try {
    const result = await getWatchlistScreen({ forceRefresh: refresh === "1" || refresh === "true" });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown watchlist error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
