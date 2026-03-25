import { NextResponse } from "next/server";
import { prisma } from "@oshi-geinin/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      lives: {
        include: { live: true },
        where: { live: { startAt: { gte: new Date() } } },
        orderBy: { live: { startAt: "asc" } },
      },
    },
  });

  if (!artist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ artist });
}
