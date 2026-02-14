"use client";

import { useMemo, useState } from "react";
import { Event } from "@/lib/types";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  events: Event[];
};

function toDate(value?: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const weekJa = ["日", "月", "火", "水", "木", "金", "土"];

export function LegacyCalendarBoard({ events }: Props) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const monthEvents = useMemo(() => {
    return events.map((ev) => {
      const start = toDate(ev.start_date);
      const end = toDate(ev.end_date) ?? start;
      return { ...ev, start, end };
    });
  }, [events]);

  const monthLabel = `${currentMonth.getFullYear()}年 ${String(currentMonth.getMonth() + 1).padStart(2, "0")}月`;
  const maxDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const dayRows = useMemo(() => {
    return Array.from({ length: maxDay }, (_, idx) => {
      const day = idx + 1;
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const list = monthEvents.filter((ev) => {
        if (!ev.start) return false;
        return ev.start <= date && date <= (ev.end ?? ev.start);
      });
      return { date, day, list };
    });
  }, [maxDay, currentMonth, monthEvents]);

  return (
    <div className="glass rounded-3xl border border-emerald-900/10 bg-white p-4 ring-1 ring-emerald-900/10 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/60">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-xl text-emerald-950">Legacyイベント一覧</p>
            <p className="text-xs text-emerald-900/65">日ごとの縦長タイムライン表示</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-50 px-2 py-1 text-sm text-emerald-900/80">
          <Button
            variant="ghost"
            onClick={() =>
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
            }
            aria-label="previous month"
            className="h-11 w-11 rounded-full p-0 hover:bg-emerald-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="px-2 font-semibold text-emerald-900">{monthLabel}</span>
          <Button
            variant="ghost"
            onClick={() =>
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
            }
            aria-label="next month"
            className="h-11 w-11 rounded-full p-0 hover:bg-emerald-100"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {dayRows.map(({ date, day, list }) => {
          const weekday = date.getDay();
          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
          return (
            <article
              key={date.toISOString()}
              className={`rounded-2xl border p-3 ${
                isToday
                  ? "border-emerald-400/60 bg-emerald-50 ring-1 ring-emerald-300/40"
                  : "border-emerald-900/10 bg-white"
              }`}
            >
              <div className="flex gap-3">
                <div className="w-16 shrink-0 text-center">
                  <p className="text-xl font-semibold text-emerald-950">{day}</p>
                  <p
                    className={`text-xs ${
                      weekday === 0
                        ? "text-rose-600"
                        : weekday === 6
                          ? "text-blue-600"
                          : "text-emerald-900/65"
                    }`}
                  >
                    {weekJa[weekday]}
                  </p>
                  {isToday && (
                    <p className="mt-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      TODAY
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {list.length === 0 ? (
                    <p className="text-sm text-emerald-900/50">イベントなし</p>
                  ) : (
                    list.map((ev) => (
                      <div
                        key={`${date.toISOString()}-${ev.id}`}
                        className="rounded-xl border border-emerald-900/10 bg-emerald-50/60 px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-emerald-950">{ev.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-900/70">
                          <MapPin className="h-3.5 w-3.5" />
                          {ev.location ?? "未設定"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-emerald-900/60">
                          {ev.start_date}
                          {ev.end_date && ev.end_date !== ev.start_date ? ` – ${ev.end_date}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
