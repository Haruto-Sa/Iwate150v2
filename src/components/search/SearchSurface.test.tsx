import type { ImgHTMLAttributes } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchSurface } from "@/components/search/SearchSurface";
import type { City, Event, Genre, Spot } from "@/lib/types";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("@/lib/storageSignedClient", () => ({
  useResolvedStorageUrls: () => new Map<string, string>(),
}));

const cities: City[] = [
  { id: 1, name: "盛岡市" },
  { id: 2, name: "平泉町" },
];

const genres: Genre[] = [
  { id: 1, name: "歴史" },
  { id: 2, name: "自然" },
];

const defaultSpots: Spot[] = [
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

const defaultEvents: Event[] = [
  {
    id: 11,
    title: "盛岡週末ナイトマーケット",
    location: "盛岡市",
    start_date: "2026-03-20",
    end_date: "2026-03-21",
    city_id: 1,
  },
];

/**
 * 検索 API のレスポンスを生成する。
 *
 * @param body - JSON ボディ
 * @returns Response
 * @example
 * createJsonResponse({ items: [], total: 0, page: 1, pageSize: 50, hasNext: false });
 */
function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 直近の fetch 呼び出し URL を返す。
 *
 * @param mockFetch - fetch モック
 * @returns URL
 * @example
 * const url = getLastRequestUrl(mockFetch);
 */
function getLastRequestUrl(mockFetch: ReturnType<typeof vi.fn>): URL {
  const lastCall = mockFetch.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("fetch has not been called yet");
  }
  return new URL(String(lastCall[0]), "https://example.com");
}

describe("SearchSurface", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows default sections without calling the search API in idle state", () => {
    render(
      <SearchSurface
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={defaultEvents}
      />
    );

    expect(screen.getByText("人気のスポット")).toBeInTheDocument();
    expect(screen.getByText("新着イベント")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute("href", "/spots/1");
    expect(screen.getByText("盛岡週末ナイトマーケット")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("debounces keyword search for 300ms and updates spot filters in the request", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        createJsonResponse({
          items: [
            {
              id: 5,
              name: "中尊寺",
              description: "世界遺産の寺院です。",
              city_id: 2,
              genre_id: 1,
              lat: 39.0,
              lng: 141.1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 50,
          hasNext: false,
        })
      )
    );
    vi.stubGlobal("fetch", mockFetch);

    render(
      <SearchSurface
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={defaultEvents}
      />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("スポット名、キーワードで検索..."), "城");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const url = getLastRequestUrl(mockFetch);
    expect(url.pathname).toBe("/api/search");
    expect(url.searchParams.get("tab")).toBe("spot");
    expect(url.searchParams.get("keyword")).toBe("城");
    expect(await screen.findByText("中尊寺")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("市区町村"), "2");
    await user.selectOptions(screen.getByLabelText("ジャンル"), "1");

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    const filteredUrl = getLastRequestUrl(mockFetch);
    expect(filteredUrl.searchParams.get("keyword")).toBe("城");
    expect(filteredUrl.searchParams.get("cityId")).toBe("2");
    expect(filteredUrl.searchParams.get("genreId")).toBe("1");
  });

  it("shows the keyword in the empty spot result message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse({
          items: [],
          total: 0,
          page: 1,
          pageSize: 50,
          hasNext: false,
        })
      )
    );

    render(
      <SearchSurface
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={defaultEvents}
      />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("スポット名、キーワードで検索..."), "存在しない");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
    });

    expect(
      await screen.findByText('"存在しない" に一致するスポットは見つかりませんでした')
    ).toBeInTheDocument();
  });

  it("groups event results into upcoming and past sections and clears genre filters", async () => {
    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), "https://example.com");
      if (url.searchParams.get("tab") === "spot") {
        return createJsonResponse({
          items: [
            {
              id: 99,
              name: "早池峰山",
              description: "イベント切替前のスポット結果です。",
              city_id: 1,
              genre_id: 2,
              lat: 39.5,
              lng: 141.4,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 50,
          hasNext: false,
        });
      }
      return createJsonResponse({
        items: [
          {
            id: 21,
            title: "春イベント",
            location: "盛岡市",
            start_date: "2099-03-20",
            end_date: "2099-03-21",
            city_id: 1,
          },
          {
            id: 22,
            title: "昨年イベント",
            location: "平泉町",
            start_date: "2024-11-01",
            end_date: "2024-11-02",
            city_id: 2,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
        hasNext: false,
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <SearchSurface
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={defaultEvents}
      />
    );

    const user = userEvent.setup();
    const genreSelect = screen.getByLabelText("ジャンル");
    await user.selectOptions(genreSelect, "2");
    await user.click(screen.getByRole("button", { name: "Events" }));
    expect(genreSelect).toBeDisabled();
    expect(genreSelect).toHaveValue("all");

    await user.type(screen.getByPlaceholderText("スポット名、キーワードで検索..."), "イベント");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
    });

    const url = getLastRequestUrl(mockFetch);
    expect(url.searchParams.get("tab")).toBe("event");
    expect(url.searchParams.get("keyword")).toBe("イベント");
    expect(url.searchParams.get("genreId")).toBeNull();
    expect(await screen.findByText("開催予定")).toBeInTheDocument();
    expect(screen.getByText("過去のイベント")).toBeInTheDocument();
    expect(screen.getByText("春イベント")).toBeInTheDocument();
    expect(screen.getByText("昨年イベント")).toBeInTheDocument();
  });

  it("loads the next page when the user taps the pagination control", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: 31,
              name: "小岩井農場",
              description: "1 ページ目の結果です。",
              city_id: 1,
              genre_id: 2,
              lat: 39.7,
              lng: 141.0,
            },
          ],
          total: 60,
          page: 1,
          pageSize: 50,
          hasNext: true,
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: 32,
              name: "龍泉洞",
              description: "2 ページ目の結果です。",
              city_id: 2,
              genre_id: 2,
              lat: 39.8,
              lng: 141.8,
            },
          ],
          total: 60,
          page: 2,
          pageSize: 50,
          hasNext: false,
        })
      );
    vi.stubGlobal("fetch", mockFetch);

    render(
      <SearchSurface
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={defaultEvents}
      />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("スポット名、キーワードで検索..."), "洞窟");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
    });

    expect(await screen.findByText("小岩井農場")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "次へ" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("龍泉洞")).toBeInTheDocument();
    expect(getLastRequestUrl(mockFetch).searchParams.get("page")).toBe("2");
  });

  it("shows a retry message when the search request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    render(
      <SearchSurface
        cities={cities}
        genres={genres}
        defaultSpots={defaultSpots}
        defaultEvents={defaultEvents}
      />
    );

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("スポット名、キーワードで検索..."), "祭り");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
    });

    expect(
      await screen.findByText("検索結果の取得に失敗しました。時間をおいて再試行してください。")
    ).toBeInTheDocument();
  });
});
