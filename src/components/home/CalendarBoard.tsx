"use client";

import { useMemo, useState } from "react";
import { Event } from "@/lib/types";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  events: Event[];
};

/**
 * ISO日付をカレンダー上のローカル日付に変換する。
 * @param value - YYYY-MM-DD
 * @returns 日付、未指定時はnull
 * @example toDate("2026-10-16")
 */
function toDate(value?: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * 日付からイベントを選択するカレンダー。選択内容は直下に表示する。
 * @param props - 開催予定イベント
 * @returns 月間カレンダーと選択日の予定
 * @example <CalendarBoard events={events} />
 */
export function CalendarBoard({ events }: Props) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
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
    const end = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
    );
    const total = end.getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < startWeek; i++) cells.push({ date: null });
    for (let day = 1; day <= total; day++) {
      cells.push({
        date: new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          day,
        ),
      });
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

  const monthLabel = `${currentMonth.getFullYear()}年 ${String(currentMonth.getMonth() + 1).padStart(2, "0")}月`;

  return (
    <div className="rounded-2xl border border-emerald-900/15 bg-white p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full items-center justify-between gap-1 text-sm">
          <Button
            variant="ghost"
            aria-label="前の月"
            className="h-11 w-11 !p-0"
            onClick={() => {
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() - 1,
                  1,
                ),
              );
              setPopupDate(null);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium tabular-nums" aria-live="polite">
            {monthLabel}
          </span>
          <Button
            variant="ghost"
            aria-label="次の月"
            className="h-11 w-11 !p-0"
            onClick={() => {
              setCurrentMonth(
                new Date(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() + 1,
                  1,
                ),
              );
              setPopupDate(null);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 text-center text-xs text-emerald-900/70">
        {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
          <span key={day} className="py-2">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm">
        {days.map((cell, index) => {
          if (!cell.date) return <span key={index} />;
          const date = cell.date;
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = popupDate?.toDateString() === date.toDateString();
          const count = monthEvents.filter(
            (event) =>
              event.start &&
              event.start <= date &&
              date <= (event.end ?? event.start),
          ).length;
          return (
            <button
              key={index}
              onClick={() => setPopupDate(date)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-controls="calendar-day-events"
              aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日、イベント${count}件`}
              className={`flex min-h-14 flex-col items-center justify-center rounded-lg border transition-colors ${isSelected ? "border-emerald-800 bg-emerald-800 text-white" : isToday ? "border-[#a14432] bg-[#fbf5ed] text-emerald-950" : "border-transparent text-emerald-950 hover:bg-emerald-50"}`}
            >
              <span className={isToday ? "font-bold" : ""}>
                {date.getDate()}
              </span>
              <span
                aria-hidden="true"
                className={`mt-1 h-1 w-1 rounded-full ${count ? (isSelected ? "bg-white" : "bg-[#a14432]") : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
      <div
        id="calendar-day-events"
        className={popupDate ? "mt-4 border-t border-emerald-900/15 pt-4" : undefined}
        aria-live="polite"
      >
        {popupDate ? (
          <>
            <h3 className="text-sm font-medium">
              {popupDate.getMonth() + 1}月{popupDate.getDate()}日のイベント
            </h3>
            {selectedEvents.length ? (
              <ul className="mt-3 space-y-3">
                {selectedEvents.map((event) => (
                  <li key={event.id} className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-sm font-medium leading-6">
                      {event.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs leading-6 text-emerald-900/80">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {event.location ?? "開催地は確認中"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-7 text-emerald-900/75">
                この日に登録されたイベントはありません。
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
