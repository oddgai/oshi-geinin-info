"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LiveFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [artistName, setArtistName] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");

  const apply = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (type) params.set("type", type);
    if (artistName) params.set("q", artistName);
    if (status) params.set("status", status);
    params.set("page", "1");
    router.push(`/lives?${params.toString()}`);
  };

  const reset = () => {
    setDateFrom("");
    setDateTo("");
    setType("");
    setArtistName("");
    setStatus("");
    router.push("/lives");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">絞り込み</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">開始日</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">終了日</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">種別</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">すべて</option>
            <option value="online">オンライン</option>
            <option value="offline">オフライン</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">芸人名</label>
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="芸人名で検索"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">チケット状況</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">すべて</option>
            <option value="販売中">販売中</option>
            <option value="販売終了">販売終了</option>
            <option value="近日公開">近日公開</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={apply}
          className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 transition-colors"
        >
          適用
        </button>
        <button
          onClick={reset}
          className="bg-gray-100 text-gray-700 text-sm px-4 py-1.5 rounded hover:bg-gray-200 transition-colors"
        >
          リセット
        </button>
      </div>
    </div>
  );
}
