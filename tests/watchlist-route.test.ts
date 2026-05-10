import { GET } from "@/app/api/watchlist/route";
import { resetSecurityStateForTests } from "@/lib/security";
import { getWatchlistScreen } from "@/lib/watchlist-service";
import type { WatchlistResponse } from "@/lib/types";
import { beforeEach, vi } from "vitest";

vi.mock("@/lib/watchlist-service", () => ({
  getWatchlistScreen: vi.fn(),
}));

const mockResponse: WatchlistResponse = {
  watchlist: ["SPY", "QQQ"],
  quotes: [],
  shortlisted: ["SPY"],
  topOpportunities: [],
  generatedAt: "2026-05-09T16:00:00.000Z",
  ttlSeconds: 120,
};

describe("GET /api/watchlist", () => {
  beforeEach(() => {
    vi.mocked(getWatchlistScreen).mockReset();
    resetSecurityStateForTests();
  });

  it("returns watchlist screening data", async () => {
    vi.mocked(getWatchlistScreen).mockResolvedValue(mockResponse);
    const response = await GET(new Request("http://localhost/api/watchlist"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ shortlisted: ["SPY"] });
  });

  it("passes refresh mode to the service", async () => {
    vi.mocked(getWatchlistScreen).mockResolvedValue(mockResponse);
    await GET(new Request("http://localhost/api/watchlist?refresh=1"));
    expect(getWatchlistScreen).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it("returns a 502 on watchlist failures", async () => {
    vi.mocked(getWatchlistScreen).mockRejectedValue(new Error("Watchlist failed"));
    const response = await GET(new Request("http://localhost/api/watchlist"));
    expect(response.status).toBe(502);
  });
});
