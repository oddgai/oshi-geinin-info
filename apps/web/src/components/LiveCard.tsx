import React from "react";
import Link from "next/link";

export type LiveCardProps = {
  live: {
    id: string;
    title: string;
    venue?: string | null;
    datetimeText?: string | null;
    type?: string | null;
    ticketStatus?: string | null;
    ticketUrl?: string | null;
    ticketPrice?: string | null;
    streamingEndAt?: string | Date | null;
    performers?: string[];
  };
  isNew?: boolean;
};

export function LiveCard({ live, isNew }: LiveCardProps) {
  const isOnline = live.type === "online";

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isNew && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
              NEW
            </span>
          )}
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
      </div>

      <Link href={`/lives/${live.id}`}>
        <h3 className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-1 line-clamp-2">
          {live.title}
        </h3>
      </Link>

      <div className="text-sm text-gray-600 space-y-1">
        {live.datetimeText && (
          <p>
            <span className="font-medium">日時:</span> {live.datetimeText}
          </p>
        )}
        {live.venue && (
          <p>
            <span className="font-medium">会場:</span> {live.venue}
          </p>
        )}
        {live.ticketPrice && (
          <p>
            <span className="font-medium">料金:</span> {live.ticketPrice}
          </p>
        )}
        {live.performers && live.performers.length > 0 && (
          <p>
            <span className="font-medium">出演:</span>{" "}
            {live.performers.slice(0, 3).join("、")}
            {live.performers.length > 3 && ` 他${live.performers.length - 3}名`}
          </p>
        )}
        {isOnline && live.streamingEndAt && (
          <p className="text-blue-600">
            <span className="font-medium">配信終了:</span>{" "}
            {new Date(live.streamingEndAt).toLocaleDateString("ja-JP")}
          </p>
        )}
      </div>

      {live.ticketUrl && (
        <div className="mt-3">
          <a
            href={live.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
          >
            チケット購入
          </a>
        </div>
      )}
    </div>
  );
}
