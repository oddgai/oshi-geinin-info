// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LiveCard } from "../../src/components/LiveCard";

afterEach(cleanup);

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("LiveCard", () => {
  it("renders live info", () => {
    render(
      <LiveCard
        live={{
          id: "1",
          title: "お笑いライブ",
          venue: "ルミネ",
          datetimeText: "4/1 18:30",
          type: "offline",
          ticketStatus: "販売中",
          ticketUrl: "https://example.com",
          ticketPrice: "3,500円",
        }}
      />
    );
    expect(screen.getByText("お笑いライブ")).toBeDefined();
    expect(screen.getByText("ルミネ")).toBeDefined();
    expect(screen.getByText("販売中")).toBeDefined();
  });

  it("shows NEW badge when isNew is true", () => {
    render(
      <LiveCard
        live={{
          id: "2",
          title: "新しいライブ",
          type: "online",
        }}
        isNew={true}
      />
    );
    expect(screen.getByText("NEW")).toBeDefined();
  });

  it("does not show NEW badge when isNew is false", () => {
    render(
      <LiveCard
        live={{
          id: "3",
          title: "古いライブ",
          type: "offline",
        }}
        isNew={false}
      />
    );
    expect(screen.queryByText("NEW")).toBeNull();
  });

  it("shows online label for online type", () => {
    render(
      <LiveCard
        live={{
          id: "4",
          title: "オンラインライブ",
          type: "online",
        }}
      />
    );
    expect(screen.getByText("オンライン")).toBeDefined();
  });

  it("shows offline label for offline type", () => {
    render(
      <LiveCard
        live={{
          id: "5",
          title: "オフラインライブ",
          type: "offline",
        }}
      />
    );
    expect(screen.getByText("オフライン")).toBeDefined();
  });

  it("shows ticket purchase link when ticketUrl is provided", () => {
    render(
      <LiveCard
        live={{
          id: "6",
          title: "チケットあるライブ",
          type: "offline",
          ticketUrl: "https://ticket.example.com",
        }}
      />
    );
    const link = screen.getByText("チケット購入");
    expect(link).toBeDefined();
    expect(link.closest("a")?.getAttribute("href")).toBe("https://ticket.example.com");
  });

  it("shows streaming end date for online lives", () => {
    render(
      <LiveCard
        live={{
          id: "7",
          title: "配信ライブ",
          type: "online",
          streamingEndAt: "2026-04-10T00:00:00.000Z",
        }}
      />
    );
    expect(screen.getByText(/配信終了/)).toBeDefined();
  });

  it("truncates performers list beyond 3", () => {
    render(
      <LiveCard
        live={{
          id: "8",
          title: "大人数ライブ",
          type: "offline",
          performers: ["A", "B", "C", "D", "E"],
        }}
      />
    );
    expect(screen.getByText(/他2名/)).toBeDefined();
  });
});
