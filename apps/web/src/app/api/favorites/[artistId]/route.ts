import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@oshi-geinin/db";
import { authOptions } from "@/lib/auth";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session as any)?.userId ?? null;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artistId } = await params;

  await prisma.userFavoriteArtist.delete({
    where: { userId_artistId: { userId, artistId } },
  });

  return new NextResponse(null, { status: 204 });
}
