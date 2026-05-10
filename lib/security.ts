const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;

type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitBucket = "analyze" | "watchlist" | "watchlist-refresh";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMITS: Record<RateLimitBucket, RateLimitConfig> = {
  analyze: {
    limit: 30,
    windowMs: 60 * 1000,
  },
  watchlist: {
    limit: 12,
    windowMs: 60 * 1000,
  },
  "watchlist-refresh": {
    limit: 3,
    windowMs: 5 * 60 * 1000,
  },
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export function validateTicker(rawTicker: string | null): string {
  const ticker = rawTicker?.trim().toUpperCase() ?? "";

  if (!ticker) {
    throw new Error("Ticker is required.");
  }

  if (!TICKER_PATTERN.test(ticker)) {
    throw new Error("Ticker must be 1-10 characters and use only letters, numbers, dots, or hyphens.");
  }

  return ticker;
}

function getClientAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

function pruneRateLimitStore(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function enforceRateLimit(
  request: Request,
  bucket: RateLimitBucket,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  pruneRateLimitStore(now);

  const client = getClientAddress(request);
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `${bucket}:${client}`;
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { ok: true };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return { ok: true };
}

export function resetSecurityStateForTests() {
  rateLimitStore.clear();
}
