"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors"
        >
          推し芸人ライブ情報
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors">
            トップ
          </Link>
          <Link href="/lives" className="text-gray-600 hover:text-blue-600 transition-colors">
            ライブ一覧
          </Link>
          <Link href="/artists" className="text-gray-600 hover:text-blue-600 transition-colors">
            芸人一覧
          </Link>
          <Link href="/settings" className="text-gray-600 hover:text-blue-600 transition-colors">
            設定
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <span className="text-gray-700 hidden sm:block">{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors"
              >
                ログアウト
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("line")}
              className="bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600 transition-colors"
            >
              LINEログイン
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
