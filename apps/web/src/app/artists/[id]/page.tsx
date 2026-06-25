import { notFound } from "next/navigation";
import Link from "next/link";
import { LiveCard } from "@/components/LiveCard";

async function getArtist(id: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/artists/${id}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch artist");
    return res.json();
  } catch {
    return null;
  }
}

export default async function ArtistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getArtist(id);

  if (!data) {
    notFound();
  }

  const artist = data.artist;
  const upcomingLives = artist.lives?.map((al: any) => al.live) ?? [];

  return (
    <div className="max-w-2xl">
      <Link href="/artists" className="inline-block text-sm text-blue-600 hover:text-blue-700 mb-4">
        ← 芸人一覧に戻る
      </Link>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{artist.name}</h1>
        {artist.aliases && artist.aliases.length > 0 && (
          <p className="text-sm text-gray-500">別名: {artist.aliases.join("、")}</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">今後のライブ</h2>

        {upcomingLives.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>予定されているライブはありません。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {upcomingLives.map((live: any) => (
              <LiveCard
                key={live.id}
                live={{
                  id: live.id,
                  title: live.title,
                  venue: live.venue,
                  datetimeText: live.startAt
                    ? new Date(live.startAt).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null,
                  type: live.type,
                  ticketStatus: live.ticketStatus,
                  ticketUrl: live.ticketUrl,
                  ticketPrice: live.ticketPrice,
                  streamingEndAt: live.streamingEndAt,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
