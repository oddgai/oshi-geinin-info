import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  artist: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@oshi-geinin/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { GET as getArtists } from "@/app/api/artists/route";
import { GET as getArtistById } from "@/app/api/artists/[id]/route";

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/artists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated artists list with defaults", async () => {
    const mockArtists = [
      { id: "1", name: "Artist A", aliases: [] },
      { id: "2", name: "Artist B", aliases: ["B-chan"] },
    ];
    mockPrisma.artist.findMany.mockResolvedValue(mockArtists);
    mockPrisma.artist.count.mockResolvedValue(2);

    const request = makeRequest("http://localhost:3000/api/artists");
    const response = await getArtists(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.artists).toEqual(mockArtists);
    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 20,
      orderBy: { name: "asc" },
    });
  });

  it("filters by search query q", async () => {
    const mockArtists = [{ id: "1", name: "Funny Guy", aliases: [] }];
    mockPrisma.artist.findMany.mockResolvedValue(mockArtists);
    mockPrisma.artist.count.mockResolvedValue(1);

    const request = makeRequest("http://localhost:3000/api/artists?q=Funny");
    const response = await getArtists(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.artists).toEqual(mockArtists);
    expect(data.total).toBe(1);

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith({
      where: { OR: [{ name: { contains: "Funny" } }, { aliases: { has: "Funny" } }] },
      skip: 0,
      take: 20,
      orderBy: { name: "asc" },
    });
  });

  it("applies pagination params", async () => {
    mockPrisma.artist.findMany.mockResolvedValue([]);
    mockPrisma.artist.count.mockResolvedValue(100);

    const request = makeRequest("http://localhost:3000/api/artists?page=3&limit=10");
    const response = await getArtists(request);
    const data = await response.json();

    expect(data.page).toBe(3);
    expect(data.limit).toBe(10);

    expect(mockPrisma.artist.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 20,
      take: 10,
      orderBy: { name: "asc" },
    });
  });
});

describe("GET /api/artists/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns artist with upcoming lives", async () => {
    const mockArtist = {
      id: "artist-1",
      name: "Artist A",
      aliases: [],
      lives: [
        {
          liveId: "live-1",
          artistId: "artist-1",
          live: { id: "live-1", title: "Concert", startAt: "2026-04-01T00:00:00.000Z" },
        },
      ],
    };
    mockPrisma.artist.findUnique.mockResolvedValue(mockArtist);

    const request = makeRequest("http://localhost:3000/api/artists/artist-1");
    const response = await getArtistById(request, {
      params: Promise.resolve({ id: "artist-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.artist).toEqual(mockArtist);
    expect(mockPrisma.artist.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "artist-1" } })
    );
  });

  it("returns 404 when artist not found", async () => {
    mockPrisma.artist.findUnique.mockResolvedValue(null);

    const request = makeRequest("http://localhost:3000/api/artists/nonexistent");
    const response = await getArtistById(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Not found");
  });
});
