import { describe, expect, it } from "vitest";
import { buildGoogleMapsUrl } from "./routeProviders";

const destination = { lat: 39.7036, lng: 141.1527 };

describe("Google Maps route URL", () => {
  it("現在地ありでは出発地と目的地を設定し、移動手段や自動ナビを固定しない", () => {
    const result = buildGoogleMapsUrl(destination, { lat: 39.701, lng: 141.136 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(Object.fromEntries(url.searchParams)).toEqual({ api: "1", destination: "39.7036,141.1527", origin: "39.701,141.136" });
  });

  it.each([null, undefined])("現在地なし(%s)はoriginを省略する", (origin) => {
    const result = buildGoogleMapsUrl(destination, origin);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(Object.fromEntries(new URL(result.url).searchParams)).toEqual({ api: "1", destination: "39.7036,141.1527" });
  });

  it.each([
    { lat: NaN, lng: 141 }, { lat: 39, lng: NaN },
    { lat: Infinity, lng: 141 }, { lat: 39, lng: -Infinity },
    { lat: 90.001, lng: 0 }, { lat: -90.001, lng: 0 },
    { lat: 0, lng: 180.001 }, { lat: 0, lng: -180.001 },
  ])("不正座標%jは出発地・目的地のいずれでも拒否する", (point) => {
    expect(buildGoogleMapsUrl(point)).toEqual({ ok: false, error: expect.stringContaining("目的地") });
    expect(buildGoogleMapsUrl(destination, point)).toEqual({ ok: false, error: expect.stringContaining("現在地") });
  });

  it.each([{ lat: 90, lng: 180 }, { lat: -90, lng: -180 }, { lat: 0, lng: 0 }])("有効な境界値%jを受け付ける", (point) => {
    expect(buildGoogleMapsUrl(point, point).ok).toBe(true);
  });
});
