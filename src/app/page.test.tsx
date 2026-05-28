"use client";

import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import type { City, Event, Spot } from "@/lib/types";

const mockFetchCities = vi.fn();
const mockFetchEvents = vi.fn();
const mockFetchSpots = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/GlassCard", () => ({
  GlassCard: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("@/components/home/HomeCalendarSwitcher", () => ({
  HomeCalendarSwitcher: () => <div>calendar</div>,
}));

vi.mock("@/lib/storage", () => ({
  getImageUrl: (path: string) => path,
  resolveServerStorageUrls: vi.fn().mockResolvedValue(new Map<string, string>()),
}));

vi.mock("@/lib/supabaseClient", () => ({
  fetchCities: (...args: unknown[]) => mockFetchCities(...args),
  fetchEvents: (...args: unknown[]) => mockFetchEvents(...args),
  fetchSpots: (...args: unknown[]) => mockFetchSpots(...args),
}));

const cities: City[] = [{ id: 1, name: "盛岡市" }];
const spots: Spot[] = [
  {
    id: 1,
    name: "盛岡城跡公園",
    description: "歴史ある公園です。",
    city_id: 1,
    genre_id: 1,
    lat: 39.7,
    lng: 141.1,
  },
];
const events: Event[] = [
  {
    id: 10,
    title: "盛岡春まつり",
    location: "盛岡市",
    start_date: "2026-03-20",
    end_date: "2026-03-21",
    city_id: 1,
  },
];

describe("Home page", () => {
  beforeEach(() => {
    mockFetchCities.mockReset();
    mockFetchEvents.mockReset();
    mockFetchSpots.mockReset();
    mockFetchCities.mockResolvedValue(cities);
    mockFetchEvents.mockResolvedValue(events);
    mockFetchSpots.mockResolvedValue(spots);
  });

  it("shows upcoming picks when events exist", async () => {
    render(await Home());

    expect(mockFetchEvents).toHaveBeenCalledWith({ limit: 4 });
    expect(screen.getByText("Today's picks")).toBeInTheDocument();
    expect(screen.getByText("盛岡春まつり")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute("href", "/spots/1");
  });

  it("shows the empty fallback when there are no upcoming events", async () => {
    mockFetchEvents.mockResolvedValue([]);

    render(await Home());

    expect(screen.getByText("近日開催予定のイベントはありません")).toBeInTheDocument();
  });
});
