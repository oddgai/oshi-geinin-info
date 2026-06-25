import { PlaywrightCrawler } from "crawlee";
import { parseMinPrice } from "@oshi-geinin/shared";
import type { Scraper } from "./base";
import type { LiveData } from "../types";

const BASE_URL = "https://zaiko.io";
// TODO: The search query should be configurable per user/artist.
// For now, we scrape the general event search page.
const SEARCH_URL = `${BASE_URL}/search`;
const MAX_PAGES = 10; // safety limit

/**
 * Scraper for zaiko.io (ZAIKO).
 *
 * ZAIKO is a Nuxt.js SPA that requires JS rendering. We use PlaywrightCrawler
 * to load the page and extract event data from the rendered DOM.
 *
 * TODO: The internal API at iapi.zaiko.io may be usable if authentication
 * requirements can be determined. For now we use browser rendering.
 */
export class ZaikoScraper implements Scraper {
  readonly siteName = "zaiko";
  readonly siteUrl = BASE_URL;

  async scrape(): Promise<LiveData[]> {
    const results: LiveData[] = [];

    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: MAX_PAGES,
      headless: true,
      requestHandlerTimeoutSecs: 60,
      async requestHandler({ page, request, enqueueLinks }) {
        // Wait for event cards to render
        await page
          .waitForSelector("a[href*='/event/']", {
            timeout: 15_000,
          })
          .catch(() => {
            // No events found on this page
          });

        const events = await page.$$eval(
          "a[href*='/event/']",
          (links, baseUrl) => {
            return links
              .filter((a) => {
                const href = a.getAttribute("href") ?? "";
                // Filter to actual event pages (numeric IDs)
                return /\/event\/\d+/.test(href);
              })
              .map((a) => {
                const href = a.getAttribute("href") ?? "";
                const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;

                // Extract text content from the event card
                const textParts = (a.textContent ?? "")
                  .split("\n")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0);

                return {
                  url: fullUrl,
                  texts: textParts,
                };
              });
          },
          BASE_URL,
        );

        for (const event of events) {
          const liveData = parseZaikoEventCard(event.texts, event.url);
          if (liveData) {
            results.push(liveData);
          }
        }

        // Try to follow pagination (if on search page)
        if (request.url.includes("/search")) {
          await enqueueLinks({
            globs: [`${BASE_URL}/search?*page=*`],
          });
        }
      },
    });

    await crawler.run([SEARCH_URL]);

    return deduplicateByUrl(results);
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Parse event information from a zaiko event card's text content.
 * The card typically shows: title, date, venue in separate text nodes.
 */
export function parseZaikoEventCard(texts: string[], url: string): LiveData | null {
  if (texts.length === 0) return null;

  const title = texts[0] ?? "";
  if (!title) return null;

  const datetimeText = findDateText(texts) ?? "";
  const startAt = parseZaikoDatetime(datetimeText);
  const venue = findVenueText(texts) ?? "";
  const priceText = findPriceText(texts) ?? "";
  const statusText = findStatusText(texts) ?? "";

  return {
    title,
    venue,
    datetimeText,
    startAt,
    endAt: null,
    type: isOnlineEvent(texts) ? "online" : "offline",
    streamingEndAt: null,
    streamingEndText: null,
    ticketPrice: priceText,
    ticketPriceMin: parseMinPrice(priceText),
    ticketStatus: statusText,
    ticketUrl: url,
    sourceUrl: url,
    artistNames: [], // Artist names are not typically shown on event cards
  };
}

/**
 * Parse zaiko datetime formats.
 * Common formats: "2026/04/01 19:00", "2026.04.01 19:00", "Apr 1, 2026 19:00"
 */
export function parseZaikoDatetime(text: string): Date | null {
  // Try YYYY/MM/DD HH:MM or YYYY-MM-DD HH:MM
  const slashMatch = text.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (slashMatch) {
    const [, year, month, day, hour, minute] = slashMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  }

  // Try YYYY/MM/DD without time
  const dateOnly = text.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return null;
}

/** Find the text line that looks like a date. */
function findDateText(texts: string[]): string | undefined {
  return texts.find(
    (t) => /\d{4}[/\-.]/.test(t) || /\d{1,2}月\d{1,2}日/.test(t) || /\d{4}年/.test(t),
  );
}

/** Find the text line that looks like a venue (location). */
function findVenueText(texts: string[]): string | undefined {
  // Venues in Japanese often contain 会場, 劇場, ホール, etc.
  return texts.find(
    (t) =>
      /会場|劇場|ホール|シアター|ライブハウス|LIVE|HALL|THEATER/i.test(t) && !/\d{4}[/\-.]/.test(t), // Exclude date lines
  );
}

/** Find a price text. */
function findPriceText(texts: string[]): string | undefined {
  return texts.find((t) => /[\d,]+円|¥[\d,]+/.test(t));
}

/** Find ticket status text. */
function findStatusText(texts: string[]): string | undefined {
  return texts.find((t) =>
    /発売中|受付中|SOLD\s*OUT|完売|販売終了|受付終了|販売前|受付前/i.test(t),
  );
}

/** Check if any text indicates this is an online/streaming event. */
function isOnlineEvent(texts: string[]): boolean {
  const combined = texts.join(" ");
  return /オンライン|配信|ストリーミング|streaming|online/i.test(combined);
}

/** Remove duplicate entries by URL. */
function deduplicateByUrl(items: LiveData[]): LiveData[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}
