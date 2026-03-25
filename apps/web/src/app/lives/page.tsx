import { Suspense } from "react";
import { LiveCard } from "@/components/LiveCard";
import { LiveFilter } from "@/components/LiveFilter";
import Link from "next/link";

async function getLives(searchParams: Record<string, string>) {
  const params = new URLSearchParams();
  if (searchParams.type) params.set("type", searchParams.type);
  if (searchParams.dateFrom) params.set("dateFrom", searchParams.dateFrom);
  if (searchParams.dateTo) params.set("dateTo", searchParams.dateTo);
  if (searchParams.q) params.set("artistId", searchParams.q);
  const page = searchParams.page ?? "1";
  params.set("page", page);
  params.set("limit", "20");

  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/lives?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return { lives: [], total: 0, page: 1, limit: 20 };
    return res.json();
  } catch {
    return { lives: [], total: 0, page: 1, limit: 20 };
  }
}

export default async function LivesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const data = await getLives(params);
  const lives: any[] = data.lives ?? [];
  const total: number = data.total ?? 0;
  const page: number = Number(params.page ?? "1");
  const limit: number = data.limit ?? 20;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">ライブ一覧</h1>
      <div className="mb-6">
        <Suspense>
          <LiveFilter />
        </Suspense>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {total}件のライブ
      </p>

      {lives.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>該当するライブが見つかりません。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {lives.map((live: any) => {
              const performers = live.artists
                ?.map((a: any) => a.artist?.name)
                .filter(Boolean);
              return (
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
                    performers,
                  }}
                />
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/lives?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
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
                  href={`/lives?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
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
