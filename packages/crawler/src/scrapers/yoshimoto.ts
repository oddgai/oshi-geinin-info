import * as cheerio from "cheerio";
import { parseMinPrice } from "@oshi-geinin/shared";
import type { Scraper } from "./base";
import type { LiveData } from "../types";

/**
 * Shape of product items extracted from the Shopify-based
 * online-ticket.yoshimoto.co.jp site.
 *
 * The site embeds a `PG_all_product_items` JS array in the page source.
 * Each entry has: content (searchable text), handle, title, img, price, vendor.
 */
interface YoshimotoProduct {
  content: string;
  handle: string;
  title: string;
  img: string;
  price: string;
  vendor: string;
}

const BASE_URL = "https://online-ticket.yoshimoto.co.jp";
const COLLECTION_URL = `${BASE_URL}/collections/all`;
const MAX_PAGES = 50; // safety limit

/**
 * Scraper for online-ticket.yoshimoto.co.jp (よしもとオンラインチケット).
 *
 * This is a Shopify-based site. Product listings are embedded in the page
 * source as a JS array `PG_all_product_items`. We parse the HTML to extract
 * this array rather than scraping DOM elements.
 */
export class YoshimotoScraper implements Scraper {
  readonly siteName = "yoshimoto";
  readonly siteUrl = BASE_URL;

  async scrape(): Promise<LiveData[]> {
    const products = await this.fetchAllProducts();
    return products.map((p) => this.toLiveData(p));
  }

  /**
   * Fetch the collection page and extract the PG_all_product_items array.
   * The site paginates client-side from a single JS array, so one fetch
   * should get all items. If paginated server-side, we follow page links.
   */
  async fetchAllProducts(): Promise<YoshimotoProduct[]> {
    const products: YoshimotoProduct[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? COLLECTION_URL : `${COLLECTION_URL}?page=${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      }
      const html = await res.text();
      const batch = extractProductsFromHtml(html);
      if (batch.length === 0) break;
      products.push(...batch);

      // If we found the JS array, all products are in one page
      // (Shopify client-side pagination). Break after first successful page.
      if (batch.length > 0) break;
    }

    return products;
  }

  /** Convert a product into our LiveData format. */
  toLiveData(p: YoshimotoProduct): LiveData {
    const datetimeText = extractDatetimeFromTitle(p.title);
    const startAt = parseYoshimotoDatetime(datetimeText);
    const priceText = p.price ? `${p.price}円` : "";
    const ticketPriceMin = p.price
      ? parseMinPrice(priceText)
      : null;

    return {
      title: p.title,
      venue: p.vendor || "",
      datetimeText,
      startAt,
      endAt: null,
      type: "online", // This is the online ticket site
      streamingEndAt: null,
      streamingEndText: null,
      ticketPrice: priceText,
      ticketPriceMin,
      ticketStatus: "", // Not available in product listing
      ticketUrl: `${BASE_URL}/products/${encodeURIComponent(p.handle)}`,
      sourceUrl: `${BASE_URL}/products/${encodeURIComponent(p.handle)}`,
      artistNames: extractArtistsFromContent(p.content, p.title),
    };
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Extract the PG_all_product_items array from the page's JavaScript.
 * Falls back to scraping DOM product cards if the JS array is not found.
 */
export function extractProductsFromHtml(html: string): YoshimotoProduct[] {
  // Try to extract from the PG_all_product_items JS variable
  const jsMatch = html.match(
    /PG_all_product_items\s*=\s*(\[[\s\S]*?\]);\s*(?:var|let|const|\/\/|$)/
  );
  if (jsMatch) {
    try {
      const items = JSON.parse(jsMatch[1]) as YoshimotoProduct[];
      return items;
    } catch {
      // Fall through to DOM parsing
    }
  }

  // Fallback: parse the DOM for product cards
  return extractProductsFromDom(html);
}

/** Fallback DOM-based extraction using Cheerio. */
function extractProductsFromDom(html: string): YoshimotoProduct[] {
  const $ = cheerio.load(html);
  const products: YoshimotoProduct[] = [];

  $(".list-view-item, .grid-view-item").each((_i, el) => {
    const $el = $(el);
    const linkEl = $el.find("a[href*='/products/']");
    const href = linkEl.attr("href") ?? "";
    const handle = href.replace("/products/", "");
    const title =
      $el.find(".product-card__title").text().trim() ||
      linkEl.find(".visually-hidden").text().trim();
    const priceText = $el.find(".price-item").first().text().trim();
    const price = priceText.replace(/[¥￥,]/g, "");

    if (title) {
      products.push({
        content: title,
        handle,
        title,
        img: "",
        price,
        vendor: "",
      });
    }
  });

  return products;
}

/**
 * Extract date/time from the product title.
 * Yoshimoto titles often contain the date like: "イベント名（3/26　21:00）"
 * or "イベント名 2026年4月1日(火) 19:00"
 */
export function extractDatetimeFromTitle(title: string): string {
  // Try 年月日 format first: "2026年4月1日(火) 19:00"
  const nenMatch = title.match(
    /\d{4}年\d{1,2}月\d{1,2}日.*?\d{1,2}:\d{2}/
  );
  if (nenMatch) return nenMatch[0];

  // Try M/D HH:MM format: "(3/26 21:00)" or "（3/26　21:00）"
  const slashMatch = title.match(
    /(\d{1,2})\/(\d{1,2})\s*[　\s]*(\d{1,2}):(\d{2})/
  );
  if (slashMatch) {
    const [, month, day, hour, minute] = slashMatch;
    return `${month}/${day} ${hour}:${minute}`;
  }

  // Try just M/D format
  const dateOnly = title.match(/(\d{1,2})\/(\d{1,2})/);
  if (dateOnly) {
    return `${dateOnly[1]}/${dateOnly[2]}`;
  }

  return title;
}

/**
 * Parse yoshimoto datetime text into a Date.
 * Handles both "M/D HH:MM" (assumes current year) and "YYYY年M月D日" formats.
 */
export function parseYoshimotoDatetime(text: string): Date | null {
  // Try 年月日 format first (handled by shared parseDatetime)
  const nenMatch = text.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}):(\d{2})/
  );
  if (nenMatch) {
    const [, year, month, day, hour, minute] = nenMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
  }

  // Try M/D HH:MM format (assume current year)
  const slashMatch = text.match(
    /(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/
  );
  if (slashMatch) {
    const [, month, day, hour, minute] = slashMatch;
    const now = new Date();
    const year = now.getFullYear();
    const date = new Date(
      year,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
    // If the date is more than 2 months in the past, assume next year
    if (date.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
      date.setFullYear(year + 1);
    }
    return date;
  }

  return null;
}

/**
 * Extract artist names from the content field.
 * The content field is a concatenation of product text including performer info.
 */
function extractArtistsFromContent(
  content: string,
  title: string
): string[] {
  // Remove the title portion from content to isolate description
  const desc = content.replace(title, "").trim();
  if (!desc) return [];

  // Look for performer patterns: 出演：X, Y, Z or 出演者：X / Y
  const performerMatch = desc.match(
    /出演[者]?[：:]\s*(.+?)(?:\n|$|。)/
  );
  if (performerMatch) {
    return performerMatch[1]
      .split(/[、,／\/]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return [];
}
