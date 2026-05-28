import type { Event } from "@/lib/types";

type EventDateFields = Pick<Event, "id" | "start_date" | "end_date">;
type SplitEventsResult = {
  upcoming: Event[];
  past: Event[];
};

/**
 * 基準日の `YYYY-MM-DD` 文字列を返す。
 *
 * @param now - 基準日時
 * @param timeZone - 判定に使うタイムゾーン
 * @returns 日付キー
 * @example
 * getCurrentDateKey(new Date("2026-03-18T10:00:00Z"), "Asia/Tokyo");
 */
export function getCurrentDateKey(
  now: Date = new Date(),
  timeZone = "Asia/Tokyo"
): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * イベントの終了判定に使う日付を返す。
 *
 * `end_date` があればそれを優先し、無い場合は `start_date` を使用する。
 *
 * @param event - イベント
 * @returns 比較用日付。日付が無い場合は null
 * @example
 * getEventComparisonDate({ id: 1, start_date: "2026-03-18", end_date: null });
 */
export function getEventComparisonDate(event: EventDateFields): string | null {
  return event.end_date ?? event.start_date ?? null;
}

/**
 * イベントが開催予定または開催中か判定する。
 *
 * @param event - イベント
 * @param referenceDate - 比較基準日
 * @returns 今後のイベントであれば true
 * @example
 * isUpcomingOrOngoingEvent({ id: 1, start_date: "2026-03-20", end_date: "2026-03-21" }, "2026-03-18");
 */
export function isUpcomingOrOngoingEvent(
  event: EventDateFields,
  referenceDate: string = getCurrentDateKey()
): boolean {
  const comparisonDate = getEventComparisonDate(event);
  if (!comparisonDate) return false;
  return comparisonDate >= referenceDate;
}

/**
 * 検索結果向けにイベントを「今後を先、過去を後」で並べ替える。
 *
 * 今後/開催中イベントは開始日に近い順、過去イベントは終了日に近い順で返す。
 *
 * @param events - 元イベント配列
 * @param referenceDate - 比較基準日
 * @returns ソート済みイベント配列
 * @example
 * sortEventsForTimeline(events, "2026-03-18");
 */
export function sortEventsForTimeline(
  events: Event[],
  referenceDate: string = getCurrentDateKey()
): Event[] {
  return [...events].sort((left, right) => {
    const leftUpcoming = isUpcomingOrOngoingEvent(left, referenceDate);
    const rightUpcoming = isUpcomingOrOngoingEvent(right, referenceDate);

    if (leftUpcoming !== rightUpcoming) {
      return leftUpcoming ? -1 : 1;
    }

    if (leftUpcoming && rightUpcoming) {
      const leftStart = left.start_date ?? left.end_date ?? "9999-12-31";
      const rightStart = right.start_date ?? right.end_date ?? "9999-12-31";
      if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
      return left.id - right.id;
    }

    const leftPast = getEventComparisonDate(left) ?? "0000-00-00";
    const rightPast = getEventComparisonDate(right) ?? "0000-00-00";
    if (leftPast !== rightPast) return rightPast.localeCompare(leftPast);
    return right.id - left.id;
  });
}

/**
 * 今後/開催中イベントだけを返す。
 *
 * @param events - 元イベント配列
 * @param referenceDate - 比較基準日
 * @param limit - 最大件数
 * @returns 今後イベント配列
 * @example
 * getUpcomingEvents(events, "2026-03-18", 4);
 */
export function getUpcomingEvents(
  events: Event[],
  referenceDate: string = getCurrentDateKey(),
  limit?: number
): Event[] {
  const filtered = sortEventsForTimeline(events, referenceDate).filter((event) =>
    isUpcomingOrOngoingEvent(event, referenceDate)
  );
  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
}

/**
 * イベントを今後/過去に分割する。
 *
 * @param events - 元イベント配列
 * @param referenceDate - 比較基準日
 * @returns 分割結果
 * @example
 * splitEventsByTimeline(events, "2026-03-18");
 */
export function splitEventsByTimeline(
  events: Event[],
  referenceDate: string = getCurrentDateKey()
): SplitEventsResult {
  const sorted = sortEventsForTimeline(events, referenceDate);
  return sorted.reduce<SplitEventsResult>(
    (result, event) => {
      if (isUpcomingOrOngoingEvent(event, referenceDate)) {
        result.upcoming.push(event);
      } else {
        result.past.push(event);
      }
      return result;
    },
    { upcoming: [], past: [] }
  );
}
