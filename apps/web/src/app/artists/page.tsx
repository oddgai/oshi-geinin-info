import { ArtistCard } from "@/components/ArtistCard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

async function getArtists(q: string, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (q) params.set("q", q);

  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/artists?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return { artists: [], total: 0, page: 1, limit: 20 };
    return res.json();
  } catch {
    return { artists: [], total: 0, page: 1, limit: 20 };
  }
}

async function getFavoriteArtistIds(): Promise<Set<string>> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/favorites`, { cache: "no-store" });
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set(data.favorites?.map((f: any) => f.artistId) ?? []);
  } catch {
    return new Set();
  }
}

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const page = Number(params.page ?? "1");

  const session = await getServerSession(authOptions);

  const [data, favoriteIds] = await Promise.all([
    getArtists(q, page),
    session ? getFavoriteArtistIds() : Promise.resolve(new Set<string>()),
  ]);

  const artists: any[] = data.artists ?? [];
  const total: number = data.total ?? 0;
  const limit: number = data.limit ?? 20;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">芸人一覧</h1>

      <form action="/artists" method="get" className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="芸人名で検索"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
          >
            検索
          </button>
        </div>
      </form>

      <p className="text-sm text-gray-500 mb-4">{total}名</p>

      {artists.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>芸人が見つかりません。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {artists.map((artist: any) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                isFavorited={favoriteIds.has(artist.id)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/artists?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  前へ
                </Link>
              )}
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/artists?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  次へ
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
