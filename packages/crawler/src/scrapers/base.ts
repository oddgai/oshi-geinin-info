import type { LiveData } from "../types";

export interface Scraper {
  readonly siteName: string;
  readonly siteUrl: string;
  scrape(): Promise<LiveData[]>;
}
