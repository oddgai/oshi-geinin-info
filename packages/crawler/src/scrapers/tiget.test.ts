import { describe, it, expect, vi, beforeEach } from "vitest";
import { TigetScraper, parseTigetListPage, parseTigetDatetime } from "./tiget";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("TigetScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scrape", () => {
    it("fetches and converts events to LiveData", async () => {
      const html = buildMockListPage([
        {
          id: "12345",
          title: "お笑いライブ 2026春",
          date: "2026年4月1日(水)",
          venue: "渋谷ライブハウス",
          performers: "芸人A、芸人B",
          status: "受付中",
        },
      ]);

      // First page returns events, second page returns empty
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(html),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve("<html><body></body></html>"),
        });

      const scraper = new TigetScraper();
      const results = await scraper.scrape();

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("お笑いライブ 2026春");
      expect(results[0].venue).toBe("渋谷ライブハウス");
      expect(results[0].datetimeText).toBe("2026年4月1日(水)");
      expect(results[0].startAt).toEqual(new Date(2026, 3, 1));
      expect(results[0].ticketStatus).toBe("受付中");
      expect(results[0].artistNames).toEqual(["芸人A", "芸人B"]);
      expect(results[0].sourceUrl).toBe("https://tiget.net/events/12345");
      expect(results[0].type).toBe("offline");
    });

    it("stops pagination on empty page", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body></body></html>"),
      });

      const scraper = new TigetScraper();
      const results = await scraper.scrape();

      expect(results).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("stops pagination on 404", async () => {
      const html = buildMockListPage([
        {
          id: "100",
          title: "テストライブ",
          date: "2026年5月1日(金)",
          venue: "テスト会場",
          performers: "",
          status: "受付中",
        },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(html),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        });

      const scraper = new TigetScraper();
      const results = await scraper.scrape();

      expect(results).toHaveLength(1);
    });
  });
});

describe("parseTigetListPage", () => {
  it("parses event cards from HTML", () => {
    const html = buildMockListPage([
      {
        id: "12345",
        title: "テストライブ",
        date: "2026年4月1日(水)",
        venue: "渋谷ライブハウス",
        performers: "芸人A、芸人B",
        status: "受付中",
      },
      {
        id: "67890",
        title: "別のライブ",
        date: "2026年5月10日(日)",
        venue: "大阪ホール",
        performers: "芸人C",
        status: "完売・受付終了",
      },
    ]);

    const events = parseTigetListPage(html);
    expect(events).toHaveLength(2);

    expect(events[0].title).toBe("テストライブ");
    expect(events[0].dateText).toBe("2026年4月1日(水)");
    expect(events[0].venue).toBe("渋谷ライブハウス");
    expect(events[0].performers).toEqual(["芸人A", "芸人B"]);
    expect(events[0].status).toBe("受付中");

    expect(events[1].title).toBe("別のライブ");
    expect(events[1].status).toBe("完売・受付終了");
  });

  it("deduplicates events by ID", () => {
    const html = `
      <html><body>
        <a href="/events/100">
          テストライブ
          開催：2026年4月1日(水)
          場所：渋谷
        </a>
        <a href="/events/100">
          テストライブ
          開催：2026年4月1日(水)
          場所：渋谷
        </a>
      </body></html>
    `;

    const events = parseTigetListPage(html);
    expect(events).toHaveLength(1);
  });

  it("skips non-event links", () => {
    const html = `
      <html><body>
        <a href="/events">イベント一覧</a>
        <a href="/about">サイトについて</a>
      </body></html>
    `;

    const events = parseTigetListPage(html);
    expect(events).toHaveLength(0);
  });

  it("returns empty array for empty page", () => {
    const events = parseTigetListPage("<html><body></body></html>");
    expect(events).toHaveLength(0);
  });
});

describe("parseTigetDatetime", () => {
  it("parses date with time", () => {
    expect(parseTigetDatetime("2026年4月1日(水) 19:00")).toEqual(new Date(2026, 3, 1, 19, 0));
  });

  it("parses date without time", () => {
    expect(parseTigetDatetime("2026年4月1日(水)")).toEqual(new Date(2026, 3, 1));
  });

  it("parses zero-padded date", () => {
    expect(parseTigetDatetime("2026年04月01日(水)")).toEqual(new Date(2026, 3, 1));
  });

  it("returns null for unparseable text", () => {
    expect(parseTigetDatetime("日時未定")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface MockEvent {
  id: string;
  title: string;
  date: string;
  venue: string;
  performers: string;
  status: string;
}

function buildMockListPage(events: MockEvent[]): string {
  const eventCards = events
    .map(
      (e) => `
    <a href="/events/${e.id}">
      ${e.title}
      開催：${e.date}
      ${e.performers ? `出演：${e.performers}` : ""}
      場所：${e.venue}
      ${e.status}
    </a>
  `,
    )
    .join("\n");

  return `
    <html>
    <body>
      <div class="event-list">
        ${eventCards}
      </div>
    </body>
    </html>
  `;
}
