import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";

async function getNotificationSettings() {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/notification-settings`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  const data = await getNotificationSettings();
  const settings = data?.settings ?? {
    newLiveNotification: true,
    streamingEndReminder: true,
    reminderHoursBefore: 1,
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 mb-6">設定</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          LINE連携
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          ログイン中のアカウント
        </p>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-medium text-sm">
            {session.user?.name?.charAt(0) ?? "L"}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {session.user?.name ?? "LINEユーザー"}
            </p>
            <p className="text-xs text-green-600">連携済み</p>
          </div>
        </div>
      </div>

      <SettingsForm initialSettings={settings} />
    </div>
  );
}
