import { describe, it, expect } from "vitest";
import { parseZaikoEventCard, parseZaikoDatetime } from "./zaiko";

describe("parseZaikoEventCard", () => {
  it("parses a typical event card", () => {
    const texts = [
      "お笑いライブ 2026",
      "2026/04/15 19:00",
      "渋谷ライブハウス",
      "¥3,500",
      "発売中",
    ];
    const result = parseZaikoEventCard(
      texts,
      "https://zaiko.io/event/12345"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("お笑いライブ 2026");
    expect(result!.datetimeText).toBe("2026/04/15 19:00");
    expect(result!.startAt).toEqual(new Date(2026, 3, 15, 19, 0));
    expect(result!.venue).toBe("渋谷ライブハウス");
    expect(result!.ticketPrice).toBe("¥3,500");
    expect(result!.ticketStatus).toBe("発売中");
    expect(result!.ticketUrl).toBe("https://zaiko.io/event/12345");
    expect(result!.type).toBe("offline");
  });

  it("detects online events", () => {
    const texts = ["オンライン配信ライブ", "2026/05/01 20:00"];
    const result = parseZaikoEventCard(
      texts,
      "https://zaiko.io/event/99999"
    );

    expect(result!.type).toBe("online");
  });

  it("returns null for empty texts", () => {
    expect(parseZaikoEventCard([], "https://zaiko.io/event/1")).toBeNull();
  });

  it("returns null for empty title", () => {
    expect(
      parseZaikoEventCard([""], "https://zaiko.io/event/1")
    ).toBeNull();
  });

  it("handles card with minimal info", () => {
    const texts = ["ライブイベント"];
    const result = parseZaikoEventCard(
      texts,
      "https://zaiko.io/event/1"
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe("ライブイベント");
    expect(result!.startAt).toBeNull();
    expect(result!.venue).toBe("");
    expect(result!.ticketStatus).toBe("");
  });
});

describe("parseZaikoDatetime", () => {
  it("parses YYYY/MM/DD HH:MM", () => {
    expect(parseZaikoDatetime("2026/04/15 19:00")).toEqual(
      new Date(2026, 3, 15, 19, 0)
    );
  });

  it("parses YYYY-MM-DD HH:MM", () => {
    expect(parseZaikoDatetime("2026-04-15 19:00")).toEqual(
      new Date(2026, 3, 15, 19, 0)
    );
  });

  it("parses YYYY.MM.DD HH:MM", () => {
    expect(parseZaikoDatetime("2026.04.15 19:00")).toEqual(
      new Date(2026, 3, 15, 19, 0)
    );
  });

  it("parses date without time", () => {
    expect(parseZaikoDatetime("2026/04/15")).toEqual(
      new Date(2026, 3, 15)
    );
  });

  it("returns null for unparseable text", () => {
    expect(parseZaikoDatetime("Coming soon")).toBeNull();
  });
});
