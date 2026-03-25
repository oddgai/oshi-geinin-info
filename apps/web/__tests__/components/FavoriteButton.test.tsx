// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { FavoriteButton } from "../../src/components/FavoriteButton";

afterEach(cleanup);

describe("FavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders unfavorited state by default", () => {
    render(<FavoriteButton artistId="artist-1" />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("お気に入りに追加");
    expect(button.textContent).toBe("♡");
  });

  it("renders favorited state when initialFavorited is true", () => {
    render(<FavoriteButton artistId="artist-1" initialFavorited={true} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("お気に入りから削除");
    expect(button.textContent).toBe("♥");
  });

  it("optimistically toggles to favorited on click", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<FavoriteButton artistId="artist-1" initialFavorited={false} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    // Optimistic update: should show favorited immediately
    expect(button.textContent).toBe("♥");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: "artist-1" }),
      });
    });
  });

  it("optimistically toggles to unfavorited on click when favorited", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<FavoriteButton artistId="artist-1" initialFavorited={true} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    // Optimistic update: should show unfavorited immediately
    expect(button.textContent).toBe("♡");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/favorites/artist-1", {
        method: "DELETE",
      });
    });
  });

  it("reverts optimistic update on API failure when adding favorite", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });

    render(<FavoriteButton artistId="artist-1" initialFavorited={false} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    await waitFor(() => {
      // Should revert back to unfavorited after failure
      expect(button.textContent).toBe("♡");
    });
  });

  it("reverts optimistic update on API failure when removing favorite", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });

    render(<FavoriteButton artistId="artist-1" initialFavorited={true} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    await waitFor(() => {
      // Should revert back to favorited after failure
      expect(button.textContent).toBe("♥");
    });
  });
});
