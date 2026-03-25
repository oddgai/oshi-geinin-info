import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LiveCard } from "@/components/LiveCard";
import Link from "next/link";

async function getFavoriteLives() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/lives?favorites=true`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function isNew(createdAt: string | Date) {
  const date = new Date(createdAt);
  const now = new Date();
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

export default async function TopPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          推し芸人ライブ情報
        </h1>
        <p className="text-gray-600 mb-2">
          お気に入りの芸人のライブ情報をまとめてチェックできます。
        </p>
        <p className="text-gray-600 mb-8">
          ライブの開始前にLINE通知でお知らせします。
        </p>
        <Link
          href="/api/auth/signin"
          className="inline-block bg-green-500 text-white px-6 py-3 rounded-lg text-base font-medium hover:bg-green-600 transition-colors"
        >
          LINEでログイン
        </Link>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl mb-2">♥</div>
            <h3 className="font-semibold text-gray-900 mb-1">芸人をお気に入り登録</h3>
            <p className="text-sm text-gray-600">好きな芸人を登録するだけ</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl mb-2">📅</div>
            <h3 className="font-semibold text-gray-900 mb-1">ライブ情報を自動収集</h3>
            <p className="text-sm text-gray-600">複数チケットサイトから自動取得</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-2xl mb-2">🔔</div>
            <h3 className="font-semibold text-gray-900 mb-1">LINE通知</h3>
            <p className="text-sm text-gray-600">開演前にお知らせします</p>
          </div>
        </div>
      </div>
    );
  }

  const data = await getFavoriteLives();
  const lives: any[] = data?.lives ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          お気に入りのライブ
        </h1>
        <Link
          href="/artists"
          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          芸人を追加する →
        </Link>
      </div>

      {lives.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">お気に入りの芸人のライブ情報がありません。</p>
          <Link
            href="/artists"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            芸人を探す
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lives.map((live: any) => {
            const performers = live.artists?.map(
              (a: any) => a.artist?.name
            ).filter(Boolean);
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
                isNew={live.createdAt ? isNew(live.createdAt) : false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
