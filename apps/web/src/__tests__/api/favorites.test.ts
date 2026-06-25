import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  userFavoriteArtist: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
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

import { GET as getFavorites, POST as postFavorite } from "@/app/api/favorites/route";
import { DELETE as deleteFavorite } from "@/app/api/favorites/[artistId]/route";

function makeRequest(url: string, options?: RequestInit): Request {
  return new Request(url, options);
}

describe("GET /api/favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await getFavorites();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns favorites for authenticated user", async () => {
    mockGetServerSession.mockResolvedValue({ userId: "user-1" });

    const mockFavorites = [
      {
        userId: "user-1",
        artistId: "artist-1",
        artist: { id: "artist-1", name: "Artist A" },
      },
    ];
    mockPrisma.userFavoriteArtist.findMany.mockResolvedValue(mockFavorites);

    const response = await getFavorites();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.favorites).toEqual(mockFavorites);
    expect(mockPrisma.userFavoriteArtist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });
});

describe("POST /api/favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = makeRequest("http://localhost:3000/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: "artist-1" }),
    });
    const response = await postFavorite(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("creates a favorite for authenticated user", async () => {
    mockGetServerSession.mockResolvedValue({ userId: "user-1" });

    const mockFavorite = {
      userId: "user-1",
      artistId: "artist-1",
      artist: { id: "artist-1", name: "Artist A" },
    };
    mockPrisma.userFavoriteArtist.upsert.mockResolvedValue(mockFavorite);

    const request = makeRequest("http://localhost:3000/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: "artist-1" }),
    });
    const response = await postFavorite(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.favorite).toEqual(mockFavorite);
    expect(mockPrisma.userFavoriteArtist.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_artistId: { userId: "user-1", artistId: "artist-1" } },
        create: { userId: "user-1", artistId: "artist-1" },
      }),
    );
  });

  it("returns 400 when artistId is missing", async () => {
    mockGetServerSession.mockResolvedValue({ userId: "user-1" });

    const request = makeRequest("http://localhost:3000/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await postFavorite(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("artistId is required");
  });
});

describe("DELETE /api/favorites/[artistId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = makeRequest("http://localhost:3000/api/favorites/artist-1", {
      method: "DELETE",
    });
    const response = await deleteFavorite(request, {
      params: Promise.resolve({ artistId: "artist-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("deletes a favorite for authenticated user", async () => {
    mockGetServerSession.mockResolvedValue({ userId: "user-1" });
    mockPrisma.userFavoriteArtist.delete.mockResolvedValue({});

    const request = makeRequest("http://localhost:3000/api/favorites/artist-1", {
      method: "DELETE",
    });
    const response = await deleteFavorite(request, {
      params: Promise.resolve({ artistId: "artist-1" }),
    });

    expect(response.status).toBe(204);
    expect(mockPrisma.userFavoriteArtist.delete).toHaveBeenCalledWith({
      where: { userId_artistId: { userId: "user-1", artistId: "artist-1" } },
    });
  });
});
