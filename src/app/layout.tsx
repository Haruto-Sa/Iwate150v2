/*
UI Concept: 「いわての旅帖」
温白の紙、松葉色の文字、朱色の目印。岩手の写真と余白で旅を案内する。
ナビゲーションだけに透過を使い、本文はコントラストと読みやすさを優先する。
*/

import { ColorThemeSync } from "@/components/preferences/ColorThemeSync";
import { COLOR_THEME_SCRIPT } from "@/lib/colorThemeScript";

import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DevelopmentServiceWorkerReset } from "@/components/layout/DevelopmentServiceWorkerReset";
import { MobileNav } from "@/components/layout/MobileNav";
import { PwaInstallPrompt } from "@/components/layout/PwaInstallPrompt";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { buildPageMetadata } from "@/lib/seo";
import { APP_THEME_COLOR } from "@/lib/config";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const display = Cormorant_Garamond({
  variable: "--font-editorial",
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
  viewportFit: "cover",
};

/**
 * 共通ナビゲーションと旅帖の表示基盤を提供する。
 * @param props - ページ内容
 * @returns アプリ全体のHTML
 * @example <RootLayout><Home /></RootLayout>
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head><script id="voja-color-theme" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: COLOR_THEME_SCRIPT }} /></head>
      <body suppressHydrationWarning className={`${display.variable} ${body.variable} antialiased`}>
        <ColorThemeSync />
        <SessionProvider>
          <DevelopmentServiceWorkerReset />
          <div className="flex min-h-screen flex-col bg-transparent text-app-ink-strong">
            <Header />
            <main id="main-content" className="page-shell mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6 sm:px-6 sm:pt-10 md:pb-16">
              {children}
            </main>
            <MobileNav />
            <Footer />
            <PwaInstallPrompt />
            <SpeedInsights />
            <Analytics />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
