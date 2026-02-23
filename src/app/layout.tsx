/*
UI Concept: 「透明な地図の温室」
- liquid / frosted glass と深い森のトーンを重ねたポストモダンな観光ダッシュボード
- 触感のある余白とガラス面、ノイズレイヤーで静かな空気感を演出し、アクセントに夕暮れオレンジ
- タイポはディスプレイに Cormorant Garamond、本文に Noto Sans JP で温かみと可読性を両立
- モバイル優先の下部ガラスナビと、指の届く大きめタップ領域
- 1〜2箇所のフェード/スライドのみで軽やかなモーション、Lucideアイコンで文脈を補強
*/

import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import { AuthGate } from "@/components/auth/AuthGate";
import { SessionProvider } from "@/components/auth/SessionProvider";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Noto_Sans_JP({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Iwate150",
  description:
    "岩手の観光地やイベントを地図・検索・ARで楽しめる観光ガイドアプリ。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${display.variable} ${body.variable} antialiased`}>
        <SessionProvider>
          <div className="grain" />
          <div className="flex min-h-screen flex-col bg-transparent text-[#0f1c1a]">
            <Header />
            <AuthGate>
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-12 sm:pb-16">
                {children}
              </main>
            </AuthGate>
            <MobileNav />
            <Footer />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
