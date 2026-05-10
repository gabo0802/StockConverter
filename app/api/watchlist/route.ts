import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security";
import { getWatchlistScreen } from "@/lib/watchlist-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh");
  const forceRefresh = refresh === "1" || refresh === "true";
  const rateLimit = enforceRateLimit(
    request,
    forceRefresh ? "watchlist-refresh" : "watchlist",
  );

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many watchlist requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const result = await getWatchlistScreen({ forceRefresh });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Watchlist route failed", error);
    return NextResponse.json(
      { error: "Unable to load watchlist data right now." },
      { status: 502 },
    );
  }
}
