import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpotSurface } from "./SpotSurface";
import type { Spot } from "@/lib/types";
import type { ComponentProps } from "react";
import type { LeafletMap } from "@/components/map/LeafletMap";

// Leafletの描画のみ置き換え、実際の共通確認hookと両導線のcallbackを検証する。
vi.mock("@/components/map/LeafletMap", () => ({
  LeafletMap: ({ spots, onRouteRequest }: ComponentProps<typeof LeafletMap>) => (
    <div aria-label="マーカー操作">
      {spots?.map((spot) => <button key={spot.id} onClick={(event) => onRouteRequest?.({ lat: spot.lat, lng: spot.lng }, event.currentTarget)}>マーカーのルート検索</button>)}
    </div>
  ),
}));

const spot: Spot = { id: 1, name: "盛岡城跡公園", description: "公園", city_id: 1, genre_id: 1, lat: 39.7036, lng: 141.1527 };
let location: { lat: number; lng: number } | null;

beforeEach(() => {
  location = null;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
      if (location) success({ coords: { latitude: location.lat, longitude: location.lng } } as GeolocationPosition);
      else error?.({ code: 1 } as GeolocationPositionError);
    }),
    watchPosition: vi.fn(() => 1), clearWatch: vi.fn(),
  } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Mapのルート検索", () => {
  it.each([true, false])("現在地あり=%s: 一覧とマーカーが同じGoogle Maps目的地を確認する", async (hasLocation) => {
    if (hasLocation) location = { lat: 39.7, lng: 141.14 };
    render(<SpotSurface spots={[spot]} focusSpotId={spot.id} />);
    const user = userEvent.setup();
    const urls: string[] = [];
    for (const label of ["ルート検索", "マーカーのルート検索"]) {
      const trigger = screen.getByRole("button", { name: label });
      await user.click(trigger);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Google Mapsでルート検索を開きます")).toBeInTheDocument();
      const link = within(dialog).getByRole("link", { name: "外部サイトを開く" });
      const url = new URL(link.getAttribute("href")!);
      expect(url.hostname).toBe("www.google.com");
      expect(url.searchParams.get("destination")).toBe("39.7036,141.1527");
      expect(url.searchParams.get("origin")).toBe(hasLocation ? "39.7,141.14" : null);
      urls.push(url.href);
      await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "外部サイトを開く" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    }
    expect(urls[0]).toBe(urls[1]);
  });

  it("不正な目的地では確認リンクを生成せずエラーを表示する", async () => {
    render(<SpotSurface spots={[{ ...spot, lat: 91 }]} focusSpotId={spot.id} />);
    await userEvent.click(screen.getByRole("button", { name: "ルート検索" }));
    expect(screen.getByRole("alert")).toHaveTextContent("目的地の座標が不正");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("不正な出発地でもGoogle Mapsへ遷移せずエラーを表示する", async () => {
    location = { lat: 91, lng: 141 };
    render(<SpotSurface spots={[spot]} focusSpotId={spot.id} />);
    await userEvent.click(screen.getByRole("button", { name: "マーカーのルート検索" }));
    expect(screen.getByRole("alert")).toHaveTextContent("現在地の座標が不正");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
