import { parseDatetime, parseMinPrice } from "@oshi-geinin/shared";
import type { Scraper } from "./base";
import type { LiveData } from "../types";

/**
 * JSON shape returned by the ticket.fany.lol search API.
 * Only the fields we actually use are typed here.
 */
interface FanyPerformanceSale {
  display_sales_status: string;
  display_sales_style: string;
  destination_url: string;
  sales_name: string;
}

interface FanyEvent {
  id: number;
  name: string;
}

interface FanyPerformance {
  id: number;
  event_id: number;
  name: string;
  venue_name: string;
  performer_detail: string;
  performance_date: string;
  open_start_time_text: string;
  streaming_method_code: string;
  precautions_detail: string;
  other_detail: string;
  event: FanyEvent;
  performance_sales: FanyPerformanceSale[];
  performance_streaming: unknown[];
}

const BASE_URL = "https://ticket.fany.lol";
const SEARCH_API = `${BASE_URL}/search/event_more`;
const BATCH_SIZE = 10;
const MAX_PAGES = 30; // safety limit: 300 events max

/**
 * Scraper for ticket.fany.lol (FANYチケット / Yoshimoto).
 *
 * Uses the JSON API at /search/event_more which returns performance data
 * without requiring browser rendering.
 */
export class FanyScraper implements Scraper {
  readonly siteName = "fany";
  readonly siteUrl = BASE_URL;

  async scrape(): Promise<LiveData[]> {
    const allPerformances = await this.fetchAllPerformances();
    return allPerformances.map((p) => this.toLiveData(p));
  }

  /** Paginate through the search API collecting all performances. */
  async fetchAllPerformances(): Promise<FanyPerformance[]> {
    const performances: FanyPerformance[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * BATCH_SIZE;
      const batch = await this.fetchPage(offset);
      if (batch.length === 0) break;
      performances.push(...batch);
    }

    return performances;
  }

  /** Fetch a single page of results from the API. */
  async fetchPage(offset: number): Promise<FanyPerformance[]> {
    const url = `${SEARCH_API}?offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data as FanyPerformance[];
  }

  /** Convert a raw API performance object into our LiveData format. */
  toLiveData(p: FanyPerformance): LiveData {
    const datetimeText = buildDatetimeText(p);
    const startAt = parseDatetime(datetimeText);
    const ticketPrice = extractPrice(p);
    const ticketPriceMin = parseMinPrice(ticketPrice);
    const bestSale = pickBestSale(p.performance_sales);
    const isOnline = p.streaming_method_code !== "00";
    const performers = parsePerformers(p.performer_detail);

    return {
      title: p.name || p.event?.name || "",
      venue: stripHtml(p.venue_name) || "",
      datetimeText,
      startAt,
      endAt: null,
      type: isOnline ? "online" : "offline",
      streamingEndAt: null,
      streamingEndText: null,
      ticketPrice,
      ticketPriceMin,
      ticketStatus: bestSale?.display_sales_status ?? "",
      ticketUrl: bestSale?.destination_url ? normalizeUrl(bestSale.destination_url) : "",
      sourceUrl: `${BASE_URL}/event/detail/${p.event_id}/${p.id}`,
      artistNames: performers,
    };
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Build a human-readable datetime string from the API fields. */
function buildDatetimeText(p: FanyPerformance): string {
  const date = stripHtml(p.performance_date ?? "").trim();
  const time = (p.open_start_time_text ?? "").trim();
  if (date && time) return `${date} ${time}`;
  if (date) return date;
  return time;
}

/**
 * Try to extract a price string from precautions_detail or other_detail.
 * The search API does not include a dedicated price field, so we look for
 * yen amounts in the free-text fields.
 */
function extractPrice(p: FanyPerformance): string {
  const combined = `${p.precautions_detail ?? ""} ${p.other_detail ?? ""}`;
  // Match patterns like "3,500円" or "前売3500円 / 当日4000円"
  const pricePattern = /[\d,]+円(?:[\s（(]税込[\s）)]?)?/g;
  const matches = combined.match(pricePattern);
  if (matches && matches.length > 0) {
    return matches.join(" / ");
  }
  return "";
}

/** Split performer_detail by common delimiters (／, /, 、) */
function parsePerformers(detail: string): string[] {
  if (!detail || !detail.trim()) return [];
  const cleaned = stripHtml(detail);
  // Remove role prefixes like [ネタ], [MC], 【ゲスト】 etc.
  const withoutRoles = cleaned.replace(/[[［【][^\]］】]*[\]］】]/g, "");
  return withoutRoles
    .split(/[／/、,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Remove HTML tags from a string. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** Ensure a URL is absolute. */
function normalizeUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
}

/**
 * Pick the "best" sale entry to represent ticket status/URL.
 * Priority: currently on-sale > upcoming > ended.
 */
function pickBestSale(sales: FanyPerformanceSale[]): FanyPerformanceSale | undefined {
  if (!sales || sales.length === 0) return undefined;

  // On-sale indicators
  const onSale = sales.find(
    (s) => s.display_sales_status.includes("発売中") || s.display_sales_status.includes("受付中"),
  );
  if (onSale) return onSale;

  // Upcoming
  const upcoming = sales.find(
    (s) => s.display_sales_status.includes("受付前") || s.display_sales_status.includes("発売前"),
  );
  if (upcoming) return upcoming;

  // Fallback to first
  return sales[0];
}
