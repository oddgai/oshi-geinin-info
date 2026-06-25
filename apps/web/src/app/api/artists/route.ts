import { NextResponse } from "next/server";
import { prisma } from "@oshi-geinin/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");

  const where = q ? { OR: [{ name: { contains: q } }, { aliases: { has: q } }] } : {};

  const [artists, total] = await Promise.all([
    prisma.artist.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.artist.count({ where }),
  ]);

  return NextResponse.json({ artists, total, page, limit });
}
