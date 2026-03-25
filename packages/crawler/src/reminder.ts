import { prisma } from "@oshi-geinin/db";

export async function handler() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const endOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);

  const expiringLives = await prisma.live.findMany({
    where: {
      type: "online",
      streamingEndAt: {
        gte: startOfTomorrow,
        lte: endOfTomorrow,
      },
    },
    include: {
      artists: { include: { artist: true } },
    },
  });

  for (const live of expiringLives) {
    const artistIds = live.artists.map((la) => la.artistId);

    const favorites = await prisma.userFavoriteArtist.findMany({
      where: { artistId: { in: artistIds } },
      include: { user: true },
    });

    const alreadyNotified = await prisma.notification.findMany({
      where: { liveId: live.id, type: "streaming_end_reminder" },
      select: { userId: true },
    });
    const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));

    for (const fav of favorites) {
      if (notifiedIds.has(fav.userId)) continue;

      const message = [
        `⏰ 配信終了リマインド`,
        ``,
        `「${live.title}」の配信が明日終了します`,
        `📅 配信終了: ${live.streamingEndText ?? live.streamingEndAt?.toLocaleDateString("ja-JP")}`,
        ``,
        `視聴: ${live.ticketUrl}`,
      ].join("\n");

      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: fav.user.lineUserId,
          messages: [{ type: "text", text: message }],
        }),
      });

      await prisma.notification.create({
        data: {
          userId: fav.userId,
          liveId: live.id,
          type: "streaming_end_reminder",
        },
      });
    }
  }

  return { statusCode: 200, body: `Processed ${expiringLives.length} expiring lives` };
}
