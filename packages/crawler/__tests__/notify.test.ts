import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@oshi-geinin/db", () => ({
  prisma: {
    liveArtist: {
      findMany: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    userFavoriteArtist: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@oshi-geinin/db";
import { findUsersToNotify, sendNewLiveNotification } from "../src/notify";

const mockPrismaLiveArtist = prisma.liveArtist as {
  findMany: ReturnType<typeof vi.fn>;
};
const mockPrismaNotification = prisma.notification as {
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};
const mockPrismaUserFavoriteArtist = prisma.userFavoriteArtist as {
  findMany: ReturnType<typeof vi.fn>;
};

const sampleUser = {
  id: "user-uuid-1",
  lineUserId: "line-user-1",
  createdAt: new Date(),
};

const sampleLive = {
  id: "live-uuid-1",
  title: "Test Live",
  venue: "Test Venue",
  startAt: new Date("2026-04-01T18:00:00Z"),
  endAt: new Date("2026-04-01T20:00:00Z"),
  datetimeText: "2026-04-01 18:00",
  type: "offline",
  streamingEndAt: null,
  streamingEndText: null,
  relatedLiveId: null,
  ticketPrice: "5000円",
  ticketPriceMin: 5000,
  ticketStatus: "on_sale",
  ticketUrl: "https://example.com/ticket/1",
  sourceSite: "example.com",
  sourceUrl: "https://example.com/live/1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("findUsersToNotify", () => {
  it("returns users who favorited artists linked to the live", async () => {
    mockPrismaLiveArtist.findMany.mockResolvedValue([
      { artistId: "artist-uuid-1" },
    ]);
    mockPrismaNotification.findMany.mockResolvedValue([]);
    mockPrismaUserFavoriteArtist.findMany.mockResolvedValue([
      { userId: sampleUser.id, artistId: "artist-uuid-1", user: sampleUser },
    ]);

    const result = await findUsersToNotify("live-uuid-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(sampleUser);
    expect(mockPrismaLiveArtist.findMany).toHaveBeenCalledWith({
      where: { liveId: "live-uuid-1" },
      select: { artistId: true },
    });
    expect(mockPrismaUserFavoriteArtist.findMany).toHaveBeenCalledWith({
      where: { artistId: { in: ["artist-uuid-1"] } },
      include: { user: true },
    });
  });

  it("skips users who have already been notified", async () => {
    const alreadyNotifiedUser = {
      id: "user-uuid-2",
      lineUserId: "line-user-2",
      createdAt: new Date(),
    };

    mockPrismaLiveArtist.findMany.mockResolvedValue([
      { artistId: "artist-uuid-1" },
    ]);
    mockPrismaNotification.findMany.mockResolvedValue([
      { userId: alreadyNotifiedUser.id },
    ]);
    mockPrismaUserFavoriteArtist.findMany.mockResolvedValue([
      {
        userId: sampleUser.id,
        artistId: "artist-uuid-1",
        user: sampleUser,
      },
      {
        userId: alreadyNotifiedUser.id,
        artistId: "artist-uuid-1",
        user: alreadyNotifiedUser,
      },
    ]);

    const result = await findUsersToNotify("live-uuid-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(sampleUser.id);
    expect(mockPrismaNotification.findMany).toHaveBeenCalledWith({
      where: { liveId: "live-uuid-1", type: "new_live" },
      select: { userId: true },
    });
  });

  it("returns empty array when no artists are linked to the live", async () => {
    mockPrismaLiveArtist.findMany.mockResolvedValue([]);

    const result = await findUsersToNotify("live-uuid-1");

    expect(result).toHaveLength(0);
    expect(mockPrismaNotification.findMany).not.toHaveBeenCalled();
    expect(mockPrismaUserFavoriteArtist.findMany).not.toHaveBeenCalled();
  });

  it("deduplicates users who favor multiple artists in the same live", async () => {
    mockPrismaLiveArtist.findMany.mockResolvedValue([
      { artistId: "artist-uuid-1" },
      { artistId: "artist-uuid-2" },
    ]);
    mockPrismaNotification.findMany.mockResolvedValue([]);
    mockPrismaUserFavoriteArtist.findMany.mockResolvedValue([
      { userId: sampleUser.id, artistId: "artist-uuid-1", user: sampleUser },
      { userId: sampleUser.id, artistId: "artist-uuid-2", user: sampleUser },
    ]);

    const result = await findUsersToNotify("live-uuid-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(sampleUser.id);
  });
});

describe("sendNewLiveNotification", () => {
  it("formats message correctly and calls LINE API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", mockFetch);
    mockPrismaNotification.create.mockResolvedValue({});

    await sendNewLiveNotification(sampleUser, sampleLive);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.to).toBe(sampleUser.lineUserId);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].type).toBe("text");

    const text: string = body.messages[0].text;
    expect(text).toContain("お気に入り芸人の新着ライブ！");
    expect(text).toContain(sampleLive.title);
    expect(text).toContain(sampleLive.venue);
    expect(text).toContain(sampleLive.datetimeText);
    expect(text).toContain(sampleLive.ticketPrice);
    expect(text).toContain(sampleLive.ticketStatus);
    expect(text).toContain(sampleLive.ticketUrl);
    expect(text).toContain("📍 現地");
  });

  it("formats message with online label when live type is online", async () => {
    const onlineLive = { ...sampleLive, type: "online" };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", mockFetch);
    mockPrismaNotification.create.mockResolvedValue({});

    await sendNewLiveNotification(sampleUser, onlineLive);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].text).toContain("🖥 オンライン");
  });

  it("creates a notification record in DB after sending", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", mockFetch);
    mockPrismaNotification.create.mockResolvedValue({});

    await sendNewLiveNotification(sampleUser, sampleLive);

    expect(mockPrismaNotification.create).toHaveBeenCalledWith({
      data: {
        userId: sampleUser.id,
        liveId: sampleLive.id,
        type: "new_live",
      },
    });
  });

  it("logs error when LINE API returns non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue("Bad Request"),
    });
    vi.stubGlobal("fetch", mockFetch);
    mockPrismaNotification.create.mockResolvedValue({});

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendNewLiveNotification(sampleUser, sampleLive);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("LINE push failed: 400")
    );

    errorSpy.mockRestore();
  });
});
