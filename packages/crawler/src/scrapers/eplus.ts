import * as cheerio from "cheerio";
import type { Scraper } from "./base";
import type { LiveData } from "../types";

const BASE_URL = "https://eplus.jp";
const COMEDY_URL = `${BASE_URL}/sf/play/comedy/`;
const MAX_PAGES = 10; // safety limit (50 events per page)

/**
 * Intermediate type for event info scraped from eplus list pages.
 */
interface EplusListEvent {
  title: string;
  dateText: string;
  venue: string;
  timeText: string;
  status: string;
  detailUrl: string;
  isStreaming: boolean;
}

/**
 * Scraper for eplus.jp comedy section.
 *
 * eplus is server-rendered HTML. The comedy section lists events at
 * /sf/play/comedy/ with pagination at /sf/play/comedy/p{N}.
 * Each event is an anchor linking to /sf/detail/{eventId}.
 *
 * Event cards show: date, title, venue (prefecture), time, status.
 */
export class EplusScraper implements Scraper {
  readonly siteName = "eplus";
  readonly siteUrl = `${BASE_URL}/sf/play/comedy`;

  async scrape(): Promise<LiveData[]> {
    const events = await this.fetchAllEvents();
    return events.map((e) => this.toLiveData(e));
  }

  /** Paginate through comedy event list pages. */
  async fetchAllEvents(): Promise<EplusListEvent[]> {
    const allEvents: EplusListEvent[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? COMEDY_URL : `${BASE_URL}/sf/play/comedy/p${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) break;
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      }
      const html = await res.text();
      const events = parseEplusListPage(html);
      if (events.length === 0) break;
      allEvents.push(...events);
    }

    return allEvents;
  }

  /** Convert a list event to LiveData. */
  toLiveData(e: EplusListEvent): LiveData {
    const fullDatetime = e.timeText ? `${e.dateText} ${e.timeText}` : e.dateText;
    const startAt = parseEplusDatetime(fullDatetime);

    return {
      title: e.title,
      venue: e.venue,
      datetimeText: fullDatetime,
      startAt,
      endAt: null,
      type: e.isStreaming ? "online" : "offline",
      streamingEndAt: null,
      streamingEndText: null,
      ticketPrice: "", // Price is only on detail pages
      ticketPriceMin: null,
      ticketStatus: e.status,
      ticketUrl: e.detailUrl,
      sourceUrl: e.detailUrl,
      artistNames: [], // Not shown on list pages
    };
  }
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

/**
 * Parse an eplus comedy list page and extract event info.
 *
 * Each event on eplus.jp is typically rendered as an anchor element
 * linking to /sf/detail/{id}. The text content contains:
 * - Date line: "2026/4/1(水)" or "2026/3/20(金・祝)"
 * - Title (heading)
 * - Venue with prefecture: "渋谷区文化総合センター大和田 さくらホール（東京都）"
 * - Time: "開演：19:00～（開場：18:30～）"
 * - Status badge: "受付中" or "予定枚数終了"
 * - Optional "Streaming+" label
 */
export function parseEplusListPage(html: string): EplusListEvent[] {
  const $ = cheerio.load(html);
  const events: EplusListEvent[] = [];
  const seen = new Set<string>();

  $('a[href*="/sf/detail/"]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr("href") ?? "";
    if (!href.includes("/sf/detail/")) return;

    const detailUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Deduplicate by URL
    if (seen.has(detailUrl)) return;
    seen.add(detailUrl);

    const fullText = $el.text();
    const lines = fullText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (lines.length === 0) return;

    const parsed = parseEplusEventLines(lines);
    if (!parsed.title) return;

    events.push({
      ...parsed,
      detailUrl,
      isStreaming: /Streaming\+|配信/i.test(fullText),
    });
  });

  return events;
}

/**
 * Parse eplus date format: "YYYY/M/DD(曜)" with optional time.
 * e.g., "2026/4/1(水) 開演：19:00～（開場：18:30～）"
 */
export function parseEplusDatetime(text: string): Date | null {
  // Extract date part: YYYY/M/DD
  const dateMatch = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;

  // Extract time: look for 開演：HH:MM or just HH:MM
  const timeMatch = text.match(/(?:開演[：:]?\s*)?(\d{1,2}):(\d{2})(?:～|〜)?/);
  if (timeMatch) {
    const [, hour, minute] = timeMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  }

  return new Date(Number(year), Number(month) - 1, Number(day));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ParsedEventLines {
  title: string;
  dateText: string;
  venue: string;
  timeText: string;
  status: string;
}

/**
 * Parse event info from text lines of an eplus event card.
 */
function parseEplusEventLines(lines: string[]): ParsedEventLines {
  let dateText = "";
  let title = "";
  let venue = "";
  let timeText = "";
  let status = "";

  for (const line of lines) {
    // Date line: starts with YYYY/
    if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(line)) {
      dateText = line;
      continue;
    }

    // Time line: contains 開演 or 開場
    if (/開演|開場/.test(line)) {
      timeText = line;
      continue;
    }

    // Status: specific known patterns
    if (/^(受付中|予定枚数終了|販売中|販売終了|受付終了)$/.test(line.trim())) {
      status = line.trim();
      continue;
    }

    // Streaming label
    if (/^Streaming\+$/.test(line.trim())) continue;

    // Venue: contains prefecture in parentheses like "（東京都）"
    if (/（.+[都道府県]）/.test(line) || /\(.+[都道府県]\)/.test(line)) {
      venue = line;
      continue;
    }

    // Otherwise, treat as title (first non-categorized line)
    if (!title && line.length > 1) {
      title = line;
    }
  }

  return { title, dateText, venue, timeText, status };
}
