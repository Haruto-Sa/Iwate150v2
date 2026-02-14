"use client";

import { useState } from "react";
import { Event } from "@/lib/types";
import { CalendarBoard } from "@/components/home/CalendarBoard";
import { LegacyCalendarBoard } from "@/components/home/LegacyCalendarBoard";
import { Button } from "@/components/ui/Button";

type Props = {
  events: Event[];
};

export function HomeCalendarSwitcher({ events }: Props) {
  const [view, setView] = useState<"modern" | "legacy">("modern");

  return (
    <section id="home-calendar" className="scroll-mt-28 space-y-3">
      <div className="inline-flex gap-1 rounded-full border border-emerald-900/10 bg-white p-1 shadow-sm">
        <Button
          variant={view === "modern" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setView("modern")}
        >
          通常カレンダー
        </Button>
        <Button
          variant={view === "legacy" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setView("legacy")}
        >
          Legacy縦長
        </Button>
      </div>

      {view === "modern" ? <CalendarBoard events={events} /> : <LegacyCalendarBoard events={events} />}
    </section>
  );
}
