/*
UI Concept: 「透明な地図の温室」
- liquid / frosted glass と深い森のトーンを重ねたポストモダンな観光ダッシュボード
- 触感のある余白とガラス面、ノイズレイヤーで静かな空気感を演出し、アクセントに夕暮れオレンジ
- タイポはディスプレイに Cormorant Garamond、本文に Noto Sans JP で温かみと可読性を両立
- モバイル優先の下部ガラスナビと、指の届く大きめタップ領域
- 1〜2箇所のフェード/スライドのみで軽やかなモーション、Lucideアイコンで文脈を補強
*/

import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DevelopmentServiceWorkerReset } from "@/components/layout/DevelopmentServiceWorkerReset";
import { MobileNav } from "@/components/layout/MobileNav";
import { PwaInstallPrompt } from "@/components/layout/PwaInstallPrompt";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { buildPageMetadata } from "@/lib/seo";
import { APP_THEME_COLOR } from "@/lib/config";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

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
  ...buildPageMetadata(),
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: APP_THEME_COLOR,
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
          <DevelopmentServiceWorkerReset />
          <div className="grain" />
          <div className="flex min-h-screen flex-col bg-transparent text-[#0f1c1a]">
            <Header />
            <main className="page-shell mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-12 sm:pb-16">
              {children}
            </main>
            <MobileNav />
            <Footer />
            <PwaInstallPrompt />
            <OnboardingOverlay />
            <SpeedInsights />
            <Analytics />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
