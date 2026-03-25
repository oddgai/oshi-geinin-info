"use client";

import { useState } from "react";

type Settings = {
  newLiveNotification: boolean;
  streamingEndReminder: boolean;
  reminderHoursBefore: number;
};

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: Settings;
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        通知設定
      </h2>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900">新着ライブ通知</p>
            <p className="text-xs text-gray-500">
              お気に入り芸人の新しいライブが追加されたときに通知
            </p>
          </div>
          <button
            onClick={() =>
              setSettings((s) => ({
                ...s,
                newLiveNotification: !s.newLiveNotification,
              }))
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              settings.newLiveNotification ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 mt-0.5 ml-0.5 rounded-full bg-white shadow transition-transform ${
                settings.newLiveNotification ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900">配信終了リマインダー</p>
            <p className="text-xs text-gray-500">
              アーカイブ配信終了前に通知
            </p>
          </div>
          <button
            onClick={() =>
              setSettings((s) => ({
                ...s,
                streamingEndReminder: !s.streamingEndReminder,
              }))
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              settings.streamingEndReminder ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 mt-0.5 ml-0.5 rounded-full bg-white shadow transition-transform ${
                settings.streamingEndReminder
                  ? "translate-x-5"
                  : "translate-x-0"
              }`}
            />
          </button>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">
            リマインダー通知タイミング
          </label>
          <select
            value={settings.reminderHoursBefore}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                reminderHoursBefore: Number(e.target.value),
              }))
            }
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={1}>1時間前</option>
            <option value={3}>3時間前</option>
            <option value={6}>6時間前</option>
            <option value={24}>24時間前</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">保存しました</span>
        )}
      </div>
    </div>
  );
}
