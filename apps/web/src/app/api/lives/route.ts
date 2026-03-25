import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@oshi-geinin/db";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get("artistId");
  const type = searchParams.get("type");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const favoritesOnly = searchParams.get("favorites") === "true";
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");

  // Build where clause
  const where: any = {};

  if (type) {
    where.type = type;
  }

  if (dateFrom || dateTo) {
    where.startAt = {};
    if (dateFrom) where.startAt.gte = new Date(dateFrom);
    if (dateTo) where.startAt.lte = new Date(dateTo);
  }

  if (artistId) {
    where.artists = { some: { artistId } };
  }

  if (favoritesOnly) {
    const session = await getServerSession(authOptions);
    const userId = (session as any)?.userId ?? null;
    if (userId) {
      where.artists = {
        some: {
          artist: { favoritedBy: { some: { userId } } },
        },
      };
    }
  }

  const [lives, total] = await Promise.all([
    prisma.live.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startAt: "asc" },
      include: {
        artists: { include: { artist: true } },
      },
    }),
    prisma.live.count({ where }),
  ]);

  return NextResponse.json({ lives, total, page, limit });
}
