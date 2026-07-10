import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@oshi-geinin/db";
import { authOptions } from "@/lib/auth";
import { withApiLogging } from "@/lib/logger";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session as any)?.userId ?? null;
}

export const GET = withApiLogging(async () => {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await prisma.userFavoriteArtist.findMany({
    where: { userId },
    include: { artist: true },
    orderBy: { artist: { name: "asc" } },
  });

  return NextResponse.json({ favorites });
});

export const POST = withApiLogging(async (request: Request) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { artistId } = body;

  if (!artistId) {
    return NextResponse.json({ error: "artistId is required" }, { status: 400 });
  }

  const favorite = await prisma.userFavoriteArtist.upsert({
    where: { userId_artistId: { userId, artistId } },
    update: {},
    create: { userId, artistId },
    include: { artist: true },
  });

  return NextResponse.json({ favorite }, { status: 201 });
});
