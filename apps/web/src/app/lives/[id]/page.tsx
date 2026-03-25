import { notFound } from "next/navigation";
import Link from "next/link";

async function getLive(id: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/lives/${id}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch live");
    return res.json();
  } catch {
    return null;
  }
}

export default async function LiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLive(id);

  if (!data) {
    notFound();
  }

  const live = data.live;
  const isOnline = live.type === "online";

  const startAt = live.startAt
    ? new Date(live.startAt).toLocaleString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const streamingEndAt =
    isOnline && live.streamingEndAt
      ? new Date(live.streamingEndAt).toLocaleString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="max-w-2xl">
      <Link
        href="/lives"
        className="inline-block text-sm text-blue-600 hover:text-blue-700 mb-4"
      >
        ← ライブ一覧に戻る
      </Link>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              isOnline
                ? "bg-blue-100 text-blue-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {isOnline ? "オンライン" : "オフライン"}
          </span>
          {live.ticketStatus && (
            <span className="text-xs text-gray-500 border border-gray-300 px-2 py-0.5 rounded">
              {live.ticketStatus}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">{live.title}</h1>

        <dl className="space-y-3 text-sm">
          {startAt && (
            <div className="flex gap-4">
              <dt className="w-24 text-gray-500 flex-shrink-0">日時</dt>
              <dd className="text-gray-900">{startAt}</dd>
            </div>
          )}
          {live.venue && (
            <div className="flex gap-4">
              <dt className="w-24 text-gray-500 flex-shrink-0">会場</dt>
              <dd className="text-gray-900">{live.venue}</dd>
            </div>
          )}
          {live.ticketPrice && (
            <div className="flex gap-4">
              <dt className="w-24 text-gray-500 flex-shrink-0">料金</dt>
              <dd className="text-gray-900">{live.ticketPrice}</dd>
            </div>
          )}
          {streamingEndAt && (
            <div className="flex gap-4">
              <dt className="w-24 text-gray-500 flex-shrink-0">配信終了</dt>
              <dd className="text-blue-700">{streamingEndAt}</dd>
            </div>
          )}
        </dl>

        {live.artists && live.artists.length > 0 && (
          <div className="mt-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              出演者
            </h2>
            <ul className="space-y-1">
              {live.artists.map((a: any) => (
                <li key={a.artist.id}>
                  <Link
                    href={`/artists/${a.artist.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {a.artist.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {live.ticketUrl && (
          <div className="mt-6">
            <a
              href={live.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              チケットを購入する
            </a>
          </div>
        )}

        {(live.relatedLive || live.relatedFrom) && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              関連ライブ
            </h2>
            {live.relatedLive && (
              <Link
                href={`/lives/${live.relatedLive.id}`}
                className="text-sm text-blue-600 hover:underline block"
              >
                {live.relatedLive.title}
              </Link>
            )}
            {live.relatedFrom && (
              <Link
                href={`/lives/${live.relatedFrom.id}`}
                className="text-sm text-blue-600 hover:underline block"
              >
                {live.relatedFrom.title}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
