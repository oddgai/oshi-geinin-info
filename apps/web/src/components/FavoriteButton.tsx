"use client";

import { useState } from "react";

type FavoriteButtonProps = {
  artistId: string;
  initialFavorited?: boolean;
};

export function FavoriteButton({
  artistId,
  initialFavorited = false,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    // Optimistic update
    setFavorited((prev) => !prev);
    setLoading(true);

    try {
      if (!favorited) {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artistId }),
        });
        if (!res.ok) {
          // Revert on error
          setFavorited(false);
        }
      } else {
        const res = await fetch(`/api/favorites/${artistId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          // Revert on error
          setFavorited(true);
        }
      }
    } catch {
      // Revert on network error
      setFavorited((prev) => !prev);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={favorited ? "お気に入りから削除" : "お気に入りに追加"}
      className={`flex-shrink-0 text-2xl transition-colors disabled:opacity-50 ${
        favorited ? "text-red-500 hover:text-red-600" : "text-gray-300 hover:text-red-400"
      }`}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
