import type { Scraper } from "./scrapers/base";
import { FanyScraper } from "./scrapers/fany";
import { storeLives } from "./store";
import { findUsersToNotify, sendNewLiveNotification } from "./notify";
import { prisma } from "@oshi-geinin/db";

const scrapers: Record<string, () => Scraper> = {
  fany: () => new FanyScraper(),
  // yoshimoto, zaiko, tiget, eplus will be added later
};

export async function handler() {
  const site = process.env.CRAWL_SITE;
  if (!site) throw new Error("CRAWL_SITE env var is required");

  const createScraper = scrapers[site];
  if (!createScraper) {
    throw new Error(`Unknown site: ${site}`);
  }

  const scraper = createScraper();
  console.log(`Scraping ${scraper.siteName}...`);

  const liveDataList = await scraper.scrape();
  console.log(`Found ${liveDataList.length} lives`);

  const { newLives } = await storeLives(liveDataList, scraper.siteName);
  console.log(`${newLives.length} new lives stored`);

  // Notify users for each new live
  for (const live of newLives) {
    const liveWithArtists = await prisma.live.findUnique({
      where: { id: live.id },
      include: { artists: { include: { artist: true } } },
    });
    if (!liveWithArtists) continue;

    const users = await findUsersToNotify(live.id);
    for (const user of users) {
      await sendNewLiveNotification(user, liveWithArtists);
    }
    console.log(`Notified ${users.length} users for "${live.title}"`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      site,
      total: liveDataList.length,
      new: newLives.length,
    }),
  };
}
