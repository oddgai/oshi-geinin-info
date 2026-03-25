import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EplusScraper,
  parseEplusListPage,
  parseEplusDatetime,
} from "./eplus";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("EplusScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scrape", () => {
    it("fetches and converts events to LiveData", async () => {
      const html = buildMockListPage([
        {
          id: "4462400001-P0030019P021001",
          date: "2026/4/1(水)",
          title: "お笑いライブ Spring 2026",
          venue: "ルミネtheよしもと（東京都）",
          time: "開演：19:00～（開場：18:30～）",
          status: "受付中",
        },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(html),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve("<html><body></body></html>"),
        });

      const scraper = new EplusScraper();
      const results = await scraper.scrape();

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("お笑いライブ Spring 2026");
      expect(results[0].venue).toBe("ルミネtheよしもと（東京都）");
      expect(results[0].startAt).toEqual(new Date(2026, 3, 1, 19, 0));
      expect(results[0].ticketStatus).toBe("受付中");
      expect(results[0].type).toBe("offline");
      expect(results[0].sourceUrl).toContain("/sf/detail/");
    });

    it("detects streaming events", async () => {
      const html = buildMockListPage([
        {
          id: "1234-P001",
          date: "2026/5/1(金)",
          title: "オンラインライブ",
          venue: "",
          time: "開演：20:00～",
          status: "受付中",
          streaming: true,
        },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(html),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve("<html></html>"),
        });

      const scraper = new EplusScraper();
      const results = await scraper.scrape();

      expect(results[0].type).toBe("online");
    });

    it("stops pagination on 404", async () => {
      const html = buildMockListPage([
        {
          id: "100-P001",
          date: "2026/6/1(月)",
          title: "テスト",
          venue: "テスト（東京都）",
          time: "",
          status: "受付中",
        },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(html),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        });

      const scraper = new EplusScraper();
      const results = await scraper.scrape();

      expect(results).toHaveLength(1);
    });
  });
});

describe("parseEplusListPage", () => {
  it("parses event cards from HTML", () => {
    const html = buildMockListPage([
      {
        id: "4462400001-P0030019P021001",
        date: "2026/4/1(水)",
        title: "お笑いライブ",
        venue: "ルミネtheよしもと（東京都）",
        time: "開演：19:00～（開場：18:30～）",
        status: "受付中",
      },
      {
        id: "9999-P001",
        date: "2026/5/10(日)",
        title: "コメディフェスタ",
        venue: "なんばグランド花月（大阪府）",
        time: "開演：14:00～",
        status: "予定枚数終了",
      },
    ]);

    const events = parseEplusListPage(html);
    expect(events).toHaveLength(2);

    expect(events[0].title).toBe("お笑いライブ");
    expect(events[0].dateText).toBe("2026/4/1(水)");
    expect(events[0].venue).toBe("ルミネtheよしもと（東京都）");
    expect(events[0].timeText).toBe("開演：19:00～（開場：18:30～）");
    expect(events[0].status).toBe("受付中");

    expect(events[1].title).toBe("コメディフェスタ");
    expect(events[1].status).toBe("予定枚数終了");
  });

  it("deduplicates events by URL", () => {
    const html = `
      <html><body>
        <a href="/sf/detail/100-P001">
          2026/4/1(水)
          テストライブ
          テスト会場（東京都）
          受付中
        </a>
        <a href="/sf/detail/100-P001">
          2026/4/1(水)
          テストライブ
          テスト会場（東京都）
          受付中
        </a>
      </body></html>
    `;

    const events = parseEplusListPage(html);
    expect(events).toHaveLength(1);
  });

  it("returns empty array for empty page", () => {
    const events = parseEplusListPage("<html><body></body></html>");
    expect(events).toHaveLength(0);
  });
});

describe("parseEplusDatetime", () => {
  it("parses date with 開演 time", () => {
    expect(
      parseEplusDatetime("2026/4/1(水) 開演：19:00～（開場：18:30～）")
    ).toEqual(new Date(2026, 3, 1, 19, 0));
  });

  it("parses date without time", () => {
    expect(parseEplusDatetime("2026/4/1(水)")).toEqual(
      new Date(2026, 3, 1)
    );
  });

  it("parses holiday date", () => {
    expect(parseEplusDatetime("2026/3/20(金・祝)")).toEqual(
      new Date(2026, 2, 20)
    );
  });

  it("parses date with simple time", () => {
    expect(parseEplusDatetime("2026/12/25(木) 19:30～")).toEqual(
      new Date(2026, 11, 25, 19, 30)
    );
  });

  it("returns null for unparseable text", () => {
    expect(parseEplusDatetime("日時未定")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface MockEvent {
  id: string;
  date: string;
  title: string;
  venue: string;
  time: string;
  status: string;
  streaming?: boolean;
}

function buildMockListPage(events: MockEvent[]): string {
  const eventCards = events
    .map(
      (e) => `
    <a href="/sf/detail/${e.id}">
      ${e.date}
      ${e.title}
      ${e.venue}
      ${e.time}
      ${e.status}
      ${e.streaming ? "Streaming+" : ""}
    </a>
  `
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
