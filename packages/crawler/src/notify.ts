import { prisma } from "@oshi-geinin/db";
import type { User, Live } from "@oshi-geinin/db";

export async function findUsersToNotify(
  liveId: string
): Promise<User[]> {
  const liveArtists = await prisma.liveArtist.findMany({
    where: { liveId },
    select: { artistId: true },
  });
  const artistIds = liveArtists.map((la) => la.artistId);

  if (artistIds.length === 0) return [];

  const alreadyNotified = await prisma.notification.findMany({
    where: { liveId, type: "new_live" },
    select: { userId: true },
  });
  const notifiedUserIds = new Set(alreadyNotified.map((n) => n.userId));

  const favorites = await prisma.userFavoriteArtist.findMany({
    where: { artistId: { in: artistIds } },
    include: { user: true },
  });

  const uniqueUsers = new Map<string, User>();
  for (const fav of favorites) {
    if (!notifiedUserIds.has(fav.userId)) {
      uniqueUsers.set(fav.userId, fav.user);
    }
  }

  return Array.from(uniqueUsers.values());
}

export async function sendNewLiveNotification(
  user: User,
  live: Live
): Promise<void> {
  const message = [
    `お気に入り芸人の新着ライブ！`,
    ``,
    `📌 ${live.title}`,
    `📍 ${live.venue}`,
    `📅 ${live.datetimeText}`,
    `💴 ${live.ticketPrice}`,
    `🎫 ${live.ticketStatus}`,
    live.type === "online" ? `🖥 オンライン` : `📍 現地`,
    ``,
    `チケット: ${live.ticketUrl}`,
  ].join("\n");

  await pushLineMessage(user.lineUserId, message);

  await prisma.notification.create({
    data: { userId: user.id, liveId: live.id, type: "new_live" },
  });
}

async function pushLineMessage(
  lineUserId: string,
  message: string
): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: message }],
    }),
  });

  if (!res.ok) {
    console.error(`LINE push failed: ${res.status} ${await res.text()}`);
  }
}
