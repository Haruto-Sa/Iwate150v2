"use client";

import { useEffect, useMemo, useState } from "react";
import { Event } from "@/lib/types";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Sparkles, X } from "lucide-react";
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

export function CalendarBoard({ events }: Props) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [popupDate, setPopupDate] = useState<Date | null>(null);

  const monthEvents = useMemo(() => {
    return events.map((ev) => {
      const start = toDate(ev.start_date);
      const end = toDate(ev.end_date) ?? start;
      return { ...ev, start, end };
    });
  }, [events]);

  const days = useMemo(() => {
    const start = new Date(currentMonth);
    const startWeek = start.getDay();
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const total = end.getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startWeek; i++) cells.push({ date: null });
    for (let day = 1; day <= total; day++) {
      cells.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) });
    }
    return cells;
  }, [currentMonth]);

  const selectedEvents = useMemo(() => {
    if (!popupDate) return [];
    return monthEvents.filter((ev) => {
      if (!ev.start) return false;
      const end = ev.end ?? ev.start;
      return ev.start <= popupDate && popupDate <= end;
    });
  }, [monthEvents, popupDate]);

  useEffect(() => {
    if (!popupDate) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopupDate(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [popupDate]);

  const monthLabel = `${currentMonth.getFullYear()}年 ${String(currentMonth.getMonth() + 1).padStart(2, "0")}月`;

  return (
    <div className="glass relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#0e1c21] via-[#0a1519] to-[#10262b] p-4 ring-1 ring-emerald-200/10 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-emerald-100 ring-1 ring-white/15 shadow-lg shadow-emerald-900/30">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-xl text-white">イベントカレンダー</p>
            <p className="text-xs text-emerald-50/70">タップで予定をピックアップ</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-sm text-emerald-50/80 shadow-inner">
          <Button
            variant="glass"
            onClick={() =>
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
            }
            aria-label="previous month"
            className="h-11 w-11 rounded-full p-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="px-2 font-semibold text-emerald-100">{monthLabel}</span>
          <Button
            variant="glass"
            onClick={() =>
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
            }
            aria-label="next month"
            className="h-11 w-11 rounded-full p-0"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-wide text-emerald-100/70">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d} className="rounded-lg bg-white/5 py-1 ring-1 ring-white/5">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 text-sm">
        {days.map((cell, idx) => {
          const day = cell.date?.getDate();
          const isToday =
            cell.date &&
            cell.date.getFullYear() === today.getFullYear() &&
            cell.date.getMonth() === today.getMonth() &&
            day === today.getDate();
          const isSelected =
            popupDate &&
            cell.date &&
            popupDate.toDateString() === cell.date.toDateString();
          const evCount = (() => {
            if (!cell.date) return 0;
            const currentDate = cell.date;
            return monthEvents.filter(
              (ev) =>
                ev.start &&
                ev.start <= currentDate &&
                currentDate <= (ev.end ?? ev.start)
            ).length;
          })();
          return (
            <button
              key={idx}
              disabled={!cell.date}
              onClick={() => cell.date && setPopupDate(cell.date)}
              className={`flex h-14 flex-col items-center justify-center rounded-2xl border transition ${
                !cell.date
                  ? "border-transparent"
                  : isSelected
                    ? "border-emerald-300/70 bg-gradient-to-br from-emerald-400/30 to-cyan-400/20 text-white shadow-lg shadow-emerald-900/30"
                    : isToday
                      ? "border-emerald-200/60 bg-white/10 text-emerald-100 ring-1 ring-emerald-200/30"
                      : "border-white/10 bg-white/5 text-emerald-50/85 hover:border-emerald-200/40 hover:bg-white/10"
              }`}
            >
              <span className={`${isToday ? "font-semibold text-emerald-100" : ""}`}>{day ?? ""}</span>
              {evCount > 0 && (
                <span className="mt-1 rounded-full bg-emerald-300/90 px-2 py-[2px] text-[10px] text-[#0a1619]">
                  {evCount} 件
                </span>
              )}
            </button>
          );
        })}
      </div>

      {popupDate && (
        <div
          className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-[#081015]/70 px-4 backdrop-blur-[2px]"
          onClick={() => setPopupDate(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-emerald-200/30 bg-gradient-to-b from-[#102028] to-[#0b171d] p-4 text-emerald-50 ring-1 ring-emerald-200/20 shadow-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-100/70">
                  <Sparkles className="h-4 w-4" />
                  {`${popupDate.getFullYear()}-${String(popupDate.getMonth() + 1).padStart(2, "0")}-${String(popupDate.getDate()).padStart(2, "0")}`}
                </p>
                <p className="mt-1 text-sm text-emerald-50/80">この日のイベント</p>
              </div>
              <Button
                variant="glass"
                size="sm"
                onClick={() => setPopupDate(null)}
                className="h-9 w-9 p-0"
                aria-label="close popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selectedEvents.length === 0 ? (
              <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-emerald-50/75">
                この日に登録されたイベントはありません。
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {selectedEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-white/10 to-white/5 px-3 py-2 shadow-inner"
                  >
                    <div className="space-y-0.5">
                      <p className="text-white">{ev.title}</p>
                      <p className="flex items-center gap-1 text-xs text-emerald-100/80">
                        <MapPin className="h-3.5 w-3.5" />
                        {ev.location ?? "未設定"}
                      </p>
                    </div>
                    <span className="text-[11px] text-emerald-100/70">
                      {ev.start_date}
                      {ev.end_date && ev.end_date !== ev.start_date ? ` – ${ev.end_date}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
