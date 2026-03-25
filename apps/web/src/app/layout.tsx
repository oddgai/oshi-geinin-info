import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "推し芸人ライブ情報",
  description: "お笑い芸人のライブ情報をまとめてチェック",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        <SessionProvider>
          <Header />
          <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
