import { Suspense, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
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
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
