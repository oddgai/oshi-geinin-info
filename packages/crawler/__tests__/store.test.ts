import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@oshi-geinin/db", () => ({
  prisma: {
    live: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    artist: {
      findMany: vi.fn(),
    },
    liveArtist: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@oshi-geinin/db";
import { storeLives } from "../src/store";
import type { LiveData } from "../src/types";

const mockPrismaLive = prisma.live as {
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};
const mockPrismaArtist = prisma.artist as {
  findMany: ReturnType<typeof vi.fn>;
};
const mockPrismaLiveArtist = prisma.liveArtist as {
  create: ReturnType<typeof vi.fn>;
};

const sampleLiveData: LiveData = {
  title: "Test Live",
  venue: "Test Venue",
  datetimeText: "2026-04-01 18:00",
  startAt: new Date("2026-04-01T18:00:00Z"),
  endAt: new Date("2026-04-01T20:00:00Z"),
  type: "offline",
  streamingEndAt: null,
  streamingEndText: null,
  ticketPrice: "5000円",
  ticketPriceMin: 5000,
  ticketStatus: "on_sale",
  ticketUrl: "https://example.com/ticket/1",
  sourceUrl: "https://example.com/live/1",
  artistNames: ["Artist A", "Artist B"],
};

const sampleCreatedLive = {
  id: "live-uuid-1",
  title: sampleLiveData.title,
  venue: sampleLiveData.venue,
  datetimeText: sampleLiveData.datetimeText,
  startAt: sampleLiveData.startAt,
  endAt: sampleLiveData.endAt,
  type: sampleLiveData.type,
  streamingEndAt: null,
  streamingEndText: null,
  relatedLiveId: null,
  ticketPrice: sampleLiveData.ticketPrice,
  ticketPriceMin: sampleLiveData.ticketPriceMin,
  ticketStatus: sampleLiveData.ticketStatus,
  ticketUrl: sampleLiveData.ticketUrl,
  sourceSite: "example.com",
  sourceUrl: sampleLiveData.sourceUrl,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storeLives", () => {
  it("inserts new lives and returns them when sourceUrl does not exist", async () => {
    mockPrismaLive.findUnique.mockResolvedValue(null);
    mockPrismaLive.create.mockResolvedValue(sampleCreatedLive);
    mockPrismaArtist.findMany.mockResolvedValue([]);
    mockPrismaLiveArtist.create.mockResolvedValue({});

    const result = await storeLives([sampleLiveData], "example.com");

    expect(mockPrismaLive.findUnique).toHaveBeenCalledWith({
      where: { sourceUrl: sampleLiveData.sourceUrl },
    });
    expect(mockPrismaLive.create).toHaveBeenCalledOnce();
    expect(result.newLives).toHaveLength(1);
    expect(result.newLives[0]).toEqual(sampleCreatedLive);
  });

  it("skips existing lives matched by sourceUrl", async () => {
    mockPrismaLive.findUnique.mockResolvedValue(sampleCreatedLive);

    const result = await storeLives([sampleLiveData], "example.com");

    expect(mockPrismaLive.findUnique).toHaveBeenCalledWith({
      where: { sourceUrl: sampleLiveData.sourceUrl },
    });
    expect(mockPrismaLive.create).not.toHaveBeenCalled();
    expect(result.newLives).toHaveLength(0);
  });

  it("processes multiple lives, inserting new ones and skipping existing ones", async () => {
    const secondLiveData: LiveData = {
      ...sampleLiveData,
      title: "Second Live",
      sourceUrl: "https://example.com/live/2",
      artistNames: [],
    };
    const secondCreatedLive = {
      ...sampleCreatedLive,
      id: "live-uuid-2",
      title: "Second Live",
      sourceUrl: "https://example.com/live/2",
    };

    mockPrismaLive.findUnique
      .mockResolvedValueOnce(sampleCreatedLive) // first already exists
      .mockResolvedValueOnce(null); // second is new
    mockPrismaLive.create.mockResolvedValue(secondCreatedLive);
    mockPrismaArtist.findMany.mockResolvedValue([]);

    const result = await storeLives([sampleLiveData, secondLiveData], "example.com");

    expect(mockPrismaLive.create).toHaveBeenCalledOnce();
    expect(result.newLives).toHaveLength(1);
    expect(result.newLives[0].sourceUrl).toBe("https://example.com/live/2");
  });
});

describe("matchAndLinkArtists (via storeLives)", () => {
  it("links artists matched by name", async () => {
    const liveDataWithArtist: LiveData = {
      ...sampleLiveData,
      artistNames: ["Artist A"],
    };
    const artistA = {
      id: "artist-uuid-1",
      name: "Artist A",
      aliases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaLive.findUnique.mockResolvedValue(null);
    mockPrismaLive.create.mockResolvedValue(sampleCreatedLive);
    mockPrismaArtist.findMany.mockResolvedValue([artistA]);
    mockPrismaLiveArtist.create.mockResolvedValue({});

    await storeLives([liveDataWithArtist], "example.com");

    expect(mockPrismaLiveArtist.create).toHaveBeenCalledWith({
      data: { liveId: sampleCreatedLive.id, artistId: artistA.id },
    });
  });

  it("links artists matched by alias", async () => {
    const liveDataWithAlias: LiveData = {
      ...sampleLiveData,
      artistNames: ["ArtistAAlias"],
    };
    const artistA = {
      id: "artist-uuid-1",
      name: "Artist A",
      aliases: ["ArtistAAlias", "A-chan"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaLive.findUnique.mockResolvedValue(null);
    mockPrismaLive.create.mockResolvedValue(sampleCreatedLive);
    mockPrismaArtist.findMany.mockResolvedValue([artistA]);
    mockPrismaLiveArtist.create.mockResolvedValue({});

    await storeLives([liveDataWithAlias], "example.com");

    expect(mockPrismaLiveArtist.create).toHaveBeenCalledWith({
      data: { liveId: sampleCreatedLive.id, artistId: artistA.id },
    });
  });

  it("logs a warning for unmatched artist names", async () => {
    const liveDataWithUnknown: LiveData = {
      ...sampleLiveData,
      artistNames: ["Unknown Artist"],
    };

    mockPrismaLive.findUnique.mockResolvedValue(null);
    mockPrismaLive.create.mockResolvedValue(sampleCreatedLive);
    mockPrismaArtist.findMany.mockResolvedValue([]);
    mockPrismaLiveArtist.create.mockResolvedValue({});

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await storeLives([liveDataWithUnknown], "example.com");

    expect(mockPrismaLiveArtist.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(`Unmatched artist: "Unknown Artist"`);

    warnSpy.mockRestore();
  });

  it("does not create liveArtist links when artistNames is empty", async () => {
    const liveDataNoArtists: LiveData = {
      ...sampleLiveData,
      artistNames: [],
    };

    mockPrismaLive.findUnique.mockResolvedValue(null);
    mockPrismaLive.create.mockResolvedValue(sampleCreatedLive);
    mockPrismaArtist.findMany.mockResolvedValue([]);

    await storeLives([liveDataNoArtists], "example.com");

    expect(mockPrismaLiveArtist.create).not.toHaveBeenCalled();
  });
});
