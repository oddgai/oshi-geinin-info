import { prisma } from "@oshi-geinin/db";
import type { Live } from "@oshi-geinin/db";
import type { LiveData } from "./types";

export async function storeLives(
  livesData: LiveData[],
  sourceSite: string
): Promise<{ newLives: Live[] }> {
  const newLives: Live[] = [];

  for (const data of livesData) {
    const existing = await prisma.live.findUnique({
      where: { sourceUrl: data.sourceUrl },
    });

    if (existing) continue;

    const live = await prisma.live.create({
      data: {
        title: data.title,
        venue: data.venue,
        startAt: data.startAt,
        endAt: data.endAt,
        datetimeText: data.datetimeText,
        type: data.type,
        streamingEndAt: data.streamingEndAt,
        streamingEndText: data.streamingEndText,
        ticketPrice: data.ticketPrice,
        ticketPriceMin: data.ticketPriceMin,
        ticketStatus: data.ticketStatus,
        ticketUrl: data.ticketUrl,
        sourceSite: sourceSite,
        sourceUrl: data.sourceUrl,
      },
    });

    // Match artist names against DB
    await matchAndLinkArtists(live.id, data.artistNames);

    newLives.push(live);
  }

  return { newLives };
}

async function matchAndLinkArtists(
  liveId: string,
  artistNames: string[]
): Promise<void> {
  const allArtists = await prisma.artist.findMany();

  for (const name of artistNames) {
    const matched = allArtists.find(
      (a) =>
        a.name === name || a.aliases.includes(name)
    );

    if (matched) {
      await prisma.liveArtist.create({
        data: { liveId, artistId: matched.id },
      });
    } else {
      console.warn(`Unmatched artist: "${name}"`);
    }
  }
}
