import { describe, it, expect, vi, beforeEach } from "vitest";
import { FanyScraper } from "../../src/scrapers/fany";

// Mock @oshi-geinin/shared
vi.mock("@oshi-geinin/shared", () => ({
  parseDatetime: vi.fn((text: string) => {
    const match = text.match(
      /(\d{4})\/(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2})/
    );
    if (!match) return null;
    const [, year, month, day, hour, minute] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
  }),
  parseMinPrice: vi.fn((text: string) => {
    const matches = text.match(/[\d,]+(?=円)/g);
    if (!matches || matches.length === 0) return null;
    const prices = matches.map((m: string) => Number(m.replace(/,/g, "")));
    return Math.min(...prices);
  }),
}));

/** Helper to create a mock performance object matching the API shape. */
function makeMockPerformance(overrides: Record<string, unknown> = {}) {
  return {
    id: 12345,
    event_id: 9999,
    name: "テストライブ 2026",
    venue_name: 'ルミネtheよしもと(<span class="g-dayofweek">東京都</span>)',
    performer_detail:
      "[ネタ]チュートリアル／マユリカ／金属バット",
    performance_date:
      '2026/04/01(<span class="g-dayofweek">火</span>)',
    open_start_time_text: "開場 18:00  開演 18:30",
    streaming_method_code: "00",
    precautions_detail: "前売 3,500円（税込） 当日 4,000円（税込）",
    other_detail: "",
    event: {
      id: 9999,
      name: "テストライブ 2026",
    },
    performance_sales: [
      {
        display_sales_status: "先着発売中",
        display_sales_style: "fany_icon__onsale",
        destination_url: "/reception/50000/12345",
        sales_name: "一般発売",
      },
    ],
    performance_streaming: [],
    ...overrides,
  };
}

describe("FanyScraper", () => {
  let scraper: FanyScraper;

  beforeEach(() => {
    scraper = new FanyScraper();
    vi.clearAllMocks();
  });

  describe("properties", () => {
    it("has correct siteName and siteUrl", () => {
      expect(scraper.siteName).toBe("fany");
      expect(scraper.siteUrl).toBe("https://ticket.fany.lol");
    });
  });

  describe("toLiveData", () => {
    it("correctly parses a standard performance into LiveData", () => {
      const perf = makeMockPerformance();
      const result = scraper.toLiveData(perf as never);

      expect(result.title).toBe("テストライブ 2026");
      expect(result.venue).toBe("ルミネtheよしもと(東京都)");
      expect(result.datetimeText).toBe(
        "2026/04/01(火) 開場 18:00  開演 18:30"
      );
      expect(result.startAt).toEqual(
        new Date(2026, 3, 1, 18, 0)
      );
      expect(result.endAt).toBeNull();
      expect(result.type).toBe("offline");
      expect(result.ticketPrice).toBe("3,500円（税込） / 4,000円（税込）");
      expect(result.ticketPriceMin).toBe(3500);
      expect(result.ticketStatus).toBe("先着発売中");
      expect(result.ticketUrl).toBe(
        "https://ticket.fany.lol/reception/50000/12345"
      );
      expect(result.sourceUrl).toBe(
        "https://ticket.fany.lol/event/detail/9999/12345"
      );
      expect(result.artistNames).toEqual([
        "チュートリアル",
        "マユリカ",
        "金属バット",
      ]);
    });

    it("handles online events based on streaming_method_code", () => {
      const perf = makeMockPerformance({
        streaming_method_code: "01",
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.type).toBe("online");
    });

    it("handles empty performer_detail", () => {
      const perf = makeMockPerformance({ performer_detail: "" });
      const result = scraper.toLiveData(perf as never);
      expect(result.artistNames).toEqual([]);
    });

    it("handles missing performance_sales", () => {
      const perf = makeMockPerformance({ performance_sales: [] });
      const result = scraper.toLiveData(perf as never);
      expect(result.ticketStatus).toBe("");
      expect(result.ticketUrl).toBe("");
    });

    it("handles missing price info", () => {
      const perf = makeMockPerformance({
        precautions_detail: "お一人様2枚まで",
        other_detail: "",
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.ticketPrice).toBe("");
      expect(result.ticketPriceMin).toBeNull();
    });

    it("picks on-sale ticket over sold-out ones", () => {
      const perf = makeMockPerformance({
        performance_sales: [
          {
            display_sales_status: "抽選受付終了",
            display_sales_style: "fany_icon__soldout",
            destination_url: "/reception/old/12345",
            sales_name: "先行抽選",
          },
          {
            display_sales_status: "先着発売中",
            display_sales_style: "fany_icon__onsale",
            destination_url: "/reception/current/12345",
            sales_name: "一般発売",
          },
        ],
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.ticketStatus).toBe("先着発売中");
      expect(result.ticketUrl).toBe(
        "https://ticket.fany.lol/reception/current/12345"
      );
    });

    it("prefers upcoming sale over ended sale", () => {
      const perf = makeMockPerformance({
        performance_sales: [
          {
            display_sales_status: "先着発売終了",
            display_sales_style: "fany_icon__soldout",
            destination_url: "/reception/ended/12345",
            sales_name: "先行",
          },
          {
            display_sales_status: "受付前",
            display_sales_style: "fany_icon__before",
            destination_url: "/reception/upcoming/12345",
            sales_name: "一般発売",
          },
        ],
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.ticketStatus).toBe("受付前");
      expect(result.ticketUrl).toBe(
        "https://ticket.fany.lol/reception/upcoming/12345"
      );
    });

    it("falls back to event name when performance name is empty", () => {
      const perf = makeMockPerformance({
        name: "",
        event: { id: 9999, name: "イベント名フォールバック" },
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.title).toBe("イベント名フォールバック");
    });

    it("handles performance_date with no time text", () => {
      const perf = makeMockPerformance({
        open_start_time_text: "  ",
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.datetimeText).toBe("2026/04/01(火)");
    });

    it("handles absolute destination_url", () => {
      const perf = makeMockPerformance({
        performance_sales: [
          {
            display_sales_status: "先着発売中",
            display_sales_style: "fany_icon__onsale",
            destination_url:
              "https://ticket.fany.lol/reception/50000/12345",
            sales_name: "一般発売",
          },
        ],
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.ticketUrl).toBe(
        "https://ticket.fany.lol/reception/50000/12345"
      );
    });

    it("strips role prefixes from performer names", () => {
      const perf = makeMockPerformance({
        performer_detail:
          "[MC]司会者／[ゲスト]ゲスト芸人／【特別出演】特別芸人",
      });
      const result = scraper.toLiveData(perf as never);
      expect(result.artistNames).toEqual([
        "司会者",
        "ゲスト芸人",
        "特別芸人",
      ]);
    });
  });

  describe("scrape (integration with fetch mock)", () => {
    it("paginates through API until empty response", async () => {
      const perf1 = makeMockPerformance({ id: 1 });
      const perf2 = makeMockPerformance({ id: 2 });

      const fetchMock = vi.fn();
      // First page: 2 items
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [perf1, perf2],
      });
      // Second page: empty = stop
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      vi.stubGlobal("fetch", fetchMock);

      const results = await scraper.scrape();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://ticket.fany.lol/search/event_more?offset=0"
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "https://ticket.fany.lol/search/event_more?offset=10"
      );
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("テストライブ 2026");

      vi.unstubAllGlobals();
    });

    it("throws on HTTP error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        })
      );

      await expect(scraper.scrape()).rejects.toThrow(
        "Failed to fetch"
      );

      vi.unstubAllGlobals();
    });

    it("handles non-array response gracefully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ error: "unexpected" }),
        })
      );

      const results = await scraper.scrape();
      expect(results).toEqual([]);

      vi.unstubAllGlobals();
    });
  });
});
