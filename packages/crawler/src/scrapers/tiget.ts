import * as cheerio from "cheerio";
import type { Scraper } from "./base";
import type { LiveData } from "../types";

const BASE_URL = "https://tiget.net";
// TODO: Tag/category should be configurable per deployment.
const EVENTS_URL = `${BASE_URL}/events`;
const MAX_PAGES = 20; // safety limit

/**
 * Intermediate type for event info scraped from list pages.
 */
interface TigetListEvent {
  eventId: string;
  title: string;
  dateText: string;
  venue: string;
  performers: string[];
  status: string;
  url: string;
}

/**
 * Scraper for tiget.net.
 *
 * Tiget is server-rendered HTML. We scrape the event list pages and extract
 * event data. The list pages contain title, date, venue, performers, and
 * status for each event card.
 *
 * Detail pages contain JSON-LD with structured data including price, but
 * fetching every detail page would be too slow. We extract what we can from
 * the list pages.
 */
export class TigetScraper implements Scraper {
  readonly siteName = "tiget";
  readonly siteUrl = BASE_URL;

  async scrape(): Promise<LiveData[]> {
    const events = await this.fetchAllEvents();
    return events.map((e) => this.toLiveData(e));
  }

  /** Paginate through event list pages. */
  async fetchAllEvents(): Promise<TigetListEvent[]> {
    const allEvents: TigetListEvent[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? EVENTS_URL : `${EVENTS_URL}?page=${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) break; // No more pages
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      }
      const html = await res.text();
      const events = parseTigetListPage(html);
      if (events.length === 0) break;
      allEvents.push(...events);
    }

    return allEvents;
  }

  /** Convert a list event to LiveData. */
  toLiveData(e: TigetListEvent): LiveData {
    const datetimeText = e.dateText;
    const startAt = parseTigetDatetime(datetimeText);

    return {
      title: e.title,
      venue: e.venue,
      datetimeText,
      startAt,
      endAt: null,
      type: isOnlineEvent(e.title, e.venue) ? "online" : "offline",
      streamingEndAt: null,
      streamingEndText: null,
      ticketPrice: "", // Price is only on detail pages
      ticketPriceMin: null,
      ticketStatus: e.status,
      ticketUrl: e.url,
      sourceUrl: e.url,
      artistNames: e.performers,
    };
  }
}

// ---------------------------------------------------------------------------
// HTML parsing
// ---------------------------------------------------------------------------

/**
 * Parse a tiget event list page HTML and extract event cards.
 *
 * Each event card on tiget.net follows this pattern:
 * - Link to /events/{id}
 * - Title in a heading element
 * - "開催：{date}" text
 * - "出演：{performers}" text
 * - "場所：{venue}" text
 * - Status badge text
 */
export function parseTigetListPage(html: string): TigetListEvent[] {
  const $ = cheerio.load(html);
  const events: TigetListEvent[] = [];

  // Find all links to event detail pages
  $('a[href*="/events/"]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr("href") ?? "";

    // Only process event detail links (numeric IDs)
    const idMatch = href.match(/\/events\/(\d+)/);
    if (!idMatch) return;

    const eventId = idMatch[1];
    const fullText = $el.text();
    const textLines = fullText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Extract structured fields from text lines
    const title = extractTigetTitle(textLines);
    if (!title) return;

    const dateText = extractField(textLines, "開催");
    const venue = extractField(textLines, "場所");
    const performerText = extractField(textLines, "出演");
    const status = extractTigetStatus(textLines);

    const performers = performerText
      ? performerText
          .split(/[、,／/]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    events.push({
      eventId,
      title,
      dateText,
      venue,
      performers,
      status,
      url: `${BASE_URL}/events/${eventId}`,
    });
  });

  // Deduplicate (same event may appear in multiple link elements)
  return deduplicateById(events);
}

/**
 * Parse tiget date format into a Date.
 * Common formats: "2026年4月1日(水)" or "2026年04月01日(水) 19:00"
 */
export function parseTigetDatetime(text: string): Date | null {
  // Try full datetime with time
  const fullMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}):(\d{2})/);
  if (fullMatch) {
    const [, year, month, day, hour, minute] = fullMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  }

  // Try date only
  const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the title from text lines (first non-field, non-status line). */
function extractTigetTitle(lines: string[]): string {
  for (const line of lines) {
    // Skip field lines and status badges
    if (/^(開催|場所|出演)[：:]/.test(line)) continue;
    if (/^(受付中|完売|受付終了|あと\d+日)$/.test(line)) continue;
    if (line.length > 2) return line;
  }
  return "";
}

/** Extract a field value like "開催：2026年4月1日" → "2026年4月1日". */
function extractField(lines: string[], prefix: string): string {
  for (const line of lines) {
    const match = line.match(new RegExp(`^${prefix}[：:]\\s*(.+)`));
    if (match) return match[1].trim();
  }
  return "";
}

/** Extract ticket status from text lines. */
function extractTigetStatus(lines: string[]): string {
  const statusPatterns = ["受付中", "完売", "受付終了", "完売・受付終了", "販売前", "受付前"];
  for (const line of lines) {
    if (statusPatterns.some((p) => line.includes(p))) return line;
    if (/^あと\d+日$/.test(line)) return line;
  }
  return "";
}

/** Check if event is online. */
function isOnlineEvent(title: string, venue: string): boolean {
  const combined = `${title} ${venue}`;
  return /オンライン|配信|ストリーミング|streaming|online/i.test(combined);
}

/** Deduplicate events by ID. */
function deduplicateById(events: TigetListEvent[]): TigetListEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.eventId)) return false;
    seen.add(e.eventId);
    return true;
  });
}
