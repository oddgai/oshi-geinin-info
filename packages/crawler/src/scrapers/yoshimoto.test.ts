import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  YoshimotoScraper,
  extractProductsFromHtml,
  extractDatetimeFromTitle,
  parseYoshimotoDatetime,
} from "./yoshimoto";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("YoshimotoScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scrape", () => {
    it("fetches and converts products to LiveData", async () => {
      const html = buildMockHtml([
        {
          content: "テストライブ（4/1　19:00）テスト劇場出演：芸人A、芸人B",
          handle: "test-live-4-1-19-00",
          title: "テストライブ（4/1　19:00）",
          img: "https://example.com/img.jpg",
          price: "1500",
          vendor: "テスト劇場",
        },
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const scraper = new YoshimotoScraper();
      const results = await scraper.scrape();

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("テストライブ（4/1　19:00）");
      expect(results[0].venue).toBe("テスト劇場");
      expect(results[0].ticketPrice).toBe("1500円");
      expect(results[0].ticketPriceMin).toBe(1500);
      expect(results[0].type).toBe("online");
      expect(results[0].ticketUrl).toContain("/products/test-live-4-1-19-00");
      expect(results[0].artistNames).toEqual(["芸人A", "芸人B"]);
    });

    it("returns empty array when no products found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<html><body></body></html>"),
      });

      const scraper = new YoshimotoScraper();
      const results = await scraper.scrape();

      expect(results).toHaveLength(0);
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const scraper = new YoshimotoScraper();
      await expect(scraper.scrape()).rejects.toThrow("Failed to fetch");
    });
  });
});

describe("extractProductsFromHtml", () => {
  it("extracts products from PG_all_product_items JS variable", () => {
    const html = buildMockHtml([
      {
        content: "テスト公演",
        handle: "test-handle",
        title: "テスト公演",
        img: "",
        price: "3000",
        vendor: "なんばグランド花月",
      },
    ]);

    const products = extractProductsFromHtml(html);
    expect(products).toHaveLength(1);
    expect(products[0].title).toBe("テスト公演");
    expect(products[0].vendor).toBe("なんばグランド花月");
    expect(products[0].price).toBe("3000");
  });

  it("returns empty array for empty page", () => {
    const products = extractProductsFromHtml("<html></html>");
    expect(products).toHaveLength(0);
  });
});

describe("extractDatetimeFromTitle", () => {
  it("extracts M/D HH:MM from parenthesized format", () => {
    expect(extractDatetimeFromTitle("テスト（4/1　19:00）")).toBe("4/1 19:00");
  });

  it("extracts 年月日 format", () => {
    const result = extractDatetimeFromTitle(
      "テスト 2026年4月1日(火) 19:00"
    );
    expect(result).toBe("2026年4月1日(火) 19:00");
  });

  it("returns title when no date pattern found", () => {
    expect(extractDatetimeFromTitle("日時未定")).toBe("日時未定");
  });
});

describe("parseYoshimotoDatetime", () => {
  it("parses 年月日 format", () => {
    const result = parseYoshimotoDatetime("2026年4月1日(火) 19:00");
    expect(result).toEqual(new Date(2026, 3, 1, 19, 0));
  });

  it("parses M/D HH:MM format", () => {
    const result = parseYoshimotoDatetime("4/1 19:00");
    // Should return a date in the current or next year
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(3); // April = 3
    expect(result!.getDate()).toBe(1);
    expect(result!.getHours()).toBe(19);
    expect(result!.getMinutes()).toBe(0);
  });

  it("returns null for unparseable text", () => {
    expect(parseYoshimotoDatetime("日時未定")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function buildMockHtml(products: unknown[]): string {
  return `
    <html>
    <body>
    <script>
    var PG_all_product_items = ${JSON.stringify(products)};
    var PG_fts_show_count = "50";
    </script>
    </body>
    </html>
  `;
}
