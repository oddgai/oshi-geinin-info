import { NextResponse } from "next/server";
import { prisma } from "@oshi-geinin/db";
import { withApiLogging } from "@/lib/logger";

export const GET = withApiLogging(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const live = await prisma.live.findUnique({
      where: { id },
      include: {
        artists: {
          include: { artist: true },
        },
        relatedLive: true,
        relatedFrom: true,
      },
    });

    if (!live) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ live });
  },
);
