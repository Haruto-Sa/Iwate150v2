"use client";

import { useState } from "react";
import { Event } from "@/lib/types";
import { CalendarBoard } from "@/components/home/CalendarBoard";
import { LegacyCalendarBoard } from "@/components/home/LegacyCalendarBoard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Button } from "@/components/ui/Button";

type Props = {
  events: Event[];
};

/**
 * 月間・一覧表示を切り替える。
 * @param props - イベント一覧
 * @returns 表示切替付きカレンダー
 * @example <HomeCalendarSwitcher events={events} />
 */
export function HomeCalendarSwitcher({ events }: Props) {
  const [view, setView] = useState<"modern" | "legacy">("modern");

  return (
    <section id="home-calendar" className="scroll-mt-28 space-y-5">
      <SectionTitle label="カレンダー" />
      <div className="inline-flex gap-1 rounded-full border border-app-line/10 bg-app-surface p-1 shadow-sm">
        <Button
          variant={view === "modern" ? "primary" : "ghost"}
          size="sm"
          aria-pressed={view === "modern"}
          onClick={() => setView("modern")}
        >
          カレンダー表示
        </Button>
        <Button
          variant={view === "legacy" ? "primary" : "ghost"}
          size="sm"
          aria-pressed={view === "legacy"}
          onClick={() => setView("legacy")}
        >
          縦スクロール表示
        </Button>
      </div>

      {view === "modern" ? <CalendarBoard events={events} /> : <LegacyCalendarBoard events={events} />}
    </section>
  );
}
