import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  live: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@oshi-geinin/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { GET as getLives } from "@/app/api/lives/route";
import { GET as getLiveById } from "@/app/api/lives/[id]/route";

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/lives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
  });

  it("returns paginated lives list", async () => {
    const mockLives = [
      {
        id: "live-1",
        title: "Concert A",
        type: "offline",
        startAt: "2026-04-01T00:00:00.000Z",
        artists: [{ artistId: "artist-1", artist: { id: "artist-1", name: "Artist A" } }],
      },
    ];
    mockPrisma.live.findMany.mockResolvedValue(mockLives);
    mockPrisma.live.count.mockResolvedValue(1);

    const request = makeRequest("http://localhost:3000/api/lives");
    const response = await getLives(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lives).toEqual(mockLives);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);
  });

  it("filters by type", async () => {
    mockPrisma.live.findMany.mockResolvedValue([]);
    mockPrisma.live.count.mockResolvedValue(0);

    const request = makeRequest("http://localhost:3000/api/lives?type=online");
    await getLives(request);

    expect(mockPrisma.live.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "online" }),
      })
    );
  });

  it("filters by artistId", async () => {
    mockPrisma.live.findMany.mockResolvedValue([]);
    mockPrisma.live.count.mockResolvedValue(0);

    const request = makeRequest("http://localhost:3000/api/lives?artistId=artist-1");
    await getLives(request);

    expect(mockPrisma.live.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          artists: { some: { artistId: "artist-1" } },
        }),
      })
    );
  });

  it("filters by dateFrom and dateTo", async () => {
    mockPrisma.live.findMany.mockResolvedValue([]);
    mockPrisma.live.count.mockResolvedValue(0);

    const request = makeRequest(
      "http://localhost:3000/api/lives?dateFrom=2026-04-01&dateTo=2026-04-30"
    );
    await getLives(request);

    expect(mockPrisma.live.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startAt: {
            gte: new Date("2026-04-01"),
            lte: new Date("2026-04-30"),
          },
        }),
      })
    );
  });

  it("applies pagination", async () => {
    mockPrisma.live.findMany.mockResolvedValue([]);
    mockPrisma.live.count.mockResolvedValue(50);

    const request = makeRequest("http://localhost:3000/api/lives?page=2&limit=5");
    const response = await getLives(request);
    const data = await response.json();

    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
    expect(mockPrisma.live.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    );
  });
});

describe("GET /api/lives/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns live detail with artists", async () => {
    const mockLive = {
      id: "live-1",
      title: "Concert A",
      type: "offline",
      artists: [
        {
          liveId: "live-1",
          artistId: "artist-1",
          artist: { id: "artist-1", name: "Artist A" },
        },
      ],
      relatedLive: null,
      relatedFrom: [],
    };
    mockPrisma.live.findUnique.mockResolvedValue(mockLive);

    const request = makeRequest("http://localhost:3000/api/lives/live-1");
    const response = await getLiveById(request, {
      params: Promise.resolve({ id: "live-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.live).toEqual(mockLive);
    expect(mockPrisma.live.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "live-1" } })
    );
  });

  it("returns 404 when live not found", async () => {
    mockPrisma.live.findUnique.mockResolvedValue(null);

    const request = makeRequest("http://localhost:3000/api/lives/nonexistent");
    const response = await getLiveById(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Not found");
  });
});
