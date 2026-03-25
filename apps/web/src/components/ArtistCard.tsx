import Link from "next/link";
import { FavoriteButton } from "./FavoriteButton";

export type ArtistCardProps = {
  artist: {
    id: string;
    name: string;
    aliases?: string[];
  };
  isFavorited?: boolean;
};

export function ArtistCard({ artist, isFavorited = false }: ArtistCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Link href={`/artists/${artist.id}`}>
          <h3 className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate">
            {artist.name}
          </h3>
        </Link>
        {artist.aliases && artist.aliases.length > 0 && (
          <p className="text-sm text-gray-500 truncate mt-0.5">
            別名: {artist.aliases.join("、")}
          </p>
        )}
      </div>
      <FavoriteButton artistId={artist.id} initialFavorited={isFavorited} />
    </div>
  );
}
