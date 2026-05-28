import { describe, expect, it } from "vitest";
import {
  getEventComparisonDate,
  getUpcomingEvents,
  isUpcomingOrOngoingEvent,
  sortEventsForTimeline,
  splitEventsByTimeline,
} from "@/lib/eventFilters";
import type { Event } from "@/lib/types";

const baseEvents: Event[] = [
  {
    id: 1,
    title: "過去イベント",
    location: "盛岡市",
    start_date: "2026-03-10",
    end_date: "2026-03-11",
    city_id: 1,
  },
  {
    id: 2,
    title: "当日終了イベント",
    location: "平泉町",
    start_date: "2026-03-17",
    end_date: "2026-03-18",
    city_id: 2,
  },
  {
    id: 3,
    title: "未来イベント",
    location: "岩泉町",
    start_date: "2026-03-20",
    end_date: "2026-03-21",
    city_id: 3,
  },
  {
    id: 4,
    title: "終了日なしイベント",
    location: "宮古市",
    start_date: "2026-03-19",
    end_date: null,
    city_id: 4,
  },
];

describe("event timeline helpers", () => {
  it("uses end_date first and falls back to start_date", () => {
    expect(getEventComparisonDate(baseEvents[0])).toBe("2026-03-11");
    expect(getEventComparisonDate(baseEvents[3])).toBe("2026-03-19");
  });

  it("treats future, ongoing, and same-day end events as upcoming", () => {
    expect(isUpcomingOrOngoingEvent(baseEvents[1], "2026-03-18")).toBe(true);
    expect(isUpcomingOrOngoingEvent(baseEvents[2], "2026-03-18")).toBe(true);
    expect(isUpcomingOrOngoingEvent(baseEvents[3], "2026-03-18")).toBe(true);
    expect(isUpcomingOrOngoingEvent(baseEvents[0], "2026-03-18")).toBe(false);
  });

  it("sorts upcoming events first and recent past events last", () => {
    const sorted = sortEventsForTimeline(baseEvents, "2026-03-18");
    expect(sorted.map((event) => event.id)).toEqual([2, 4, 3, 1]);
  });

  it("returns only upcoming events with an optional limit", () => {
    expect(getUpcomingEvents(baseEvents, "2026-03-18").map((event) => event.id)).toEqual([2, 4, 3]);
    expect(getUpcomingEvents(baseEvents, "2026-03-18", 2).map((event) => event.id)).toEqual([2, 4]);
  });

  it("splits events into upcoming and past groups", () => {
    const grouped = splitEventsByTimeline(baseEvents, "2026-03-18");
    expect(grouped.upcoming.map((event) => event.id)).toEqual([2, 4, 3]);
    expect(grouped.past.map((event) => event.id)).toEqual([1]);
  });
});
