import { Suspense, type ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LeafletMap } from "./LeafletMap";
import { mockStampCatalog } from "@/lib/mockData";

const resolveImages = vi.hoisted(() => vi.fn<(paths: (string | null)[], kind: string) => Map<string, string>>(() => new Map()));
vi.mock("@/lib/storageSignedClient", () => ({ useResolvedStorageUrls: resolveImages }));
vi.mock("@/lib/storage", () => ({ getImageUrl: (path: string) => `https://images.example/${path}` }));
vi.mock("next/dynamic", async () => {
  const { lazy } = await import("react");
  return { default: (loader: () => Promise<React.ComponentType>) => lazy(async () => ({ default: await loader() })) };
});
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: ({ children, position }: { children: ReactNode; position: number[] }) => <div data-testid="marker" data-position={position.join(",")}>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn(), getMaxZoom: () => 18 }),
}));

const spot = { ...mockStampCatalog.spots[0], image_path: "spots/photo.jpg", image_thumb_path: "spots/thumb.jpg" };
beforeEach(() => { resolveImages.mockClear(); });

it("画像無効時は画像URLを解決せず、サンプルでは詳細リンクも表示しない", async () => {
  render(
    <Suspense>
      <LeafletMap center={spot} spots={[spot]} showUser={false} showImages={false} showDetailLinks={false} />
    </Suspense>,
  );
  expect(await screen.findByText(spot.name)).toBeVisible();
  expect(screen.queryByRole("img", { name: spot.name })).toBeNull();
  expect(screen.queryByRole("link", { name: "詳細を見る" })).toBeNull();
  expect(resolveImages).toHaveBeenCalled();
  expect(resolveImages.mock.calls.every(([paths]) => Array.isArray(paths) && paths.length === 0)).toBe(true);
});

it("通常の地図では従来どおり画像と詳細リンクを表示する", async () => {
  render(
    <Suspense>
      <LeafletMap center={spot} spots={[spot]} showUser={false} />
    </Suspense>,
  );
  expect(await screen.findByRole("link", { name: "詳細を見る" })).toHaveAttribute("href", expect.stringContaining("/spots/"));
  expect(screen.getByRole("img", { name: spot.name })).toHaveAttribute("src", "https://images.example/spots/thumb.jpg");
  expect(resolveImages).toHaveBeenCalledWith(["spots/thumb.jpg"], "image");
});

afterEach(() => { vi.unstubAllGlobals(); });

it("親の現在地を優先し、取り下げ後に古い位置取得結果を表示しない", async () => {
  const getCurrentPosition = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  const { rerender } = render(<Suspense><LeafletMap center={spot} spots={[]} /></Suspense>);
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  const staleCallback = getCurrentPosition.mock.calls[0][0];
  rerender(<Suspense><LeafletMap center={spot} spots={[]} userPosition={{ lat: 40, lng: 142 }} /></Suspense>);
  expect(await screen.findByTestId("marker")).toHaveAttribute("data-position", "40,142");
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  act(() => staleCallback({ coords: { latitude: 30, longitude: 130 } }));
  expect(screen.getByTestId("marker")).toHaveAttribute("data-position", "40,142");
  rerender(<Suspense><LeafletMap center={spot} spots={[]} showUser={false} userPosition={null} /></Suspense>);
  expect(screen.queryByTestId("marker")).toBeNull();
});
