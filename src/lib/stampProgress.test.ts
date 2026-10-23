import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStampProgress, locateForStamp } from "./stampProgress";
import type { Spot, Stamp } from "./types";
const base: Spot = {
  id: 1,
  name: "対象",
  description: "説明",
  city_id: 1,
  genre_id: 1,
  lat: 39.7,
  lng: 141.1,
};
afterEach(() => vi.useRealTimers());
describe("スタンプ進捗", () => {
  it("重複記録・対象外・不正座標を達成率に含めず、市町村の対象未登録を区別する", () => {
    const result = buildStampProgress(
      [
        base,
        base,
        { ...base, id: 2, city_id: 2 },
        { ...base, id: 3, lat: NaN },
      ],
      [
        { id: 1, name: "盛岡市" },
        { id: 2, name: "他市" },
        { id: 3, name: "未登録市" },
      ],
      [1, 1, 3, 999].map((spot_id) => ({ spot_id }) as Stamp),
    );
    expect(result.total).toBe(2);
    expect(result.earned).toBe(1);
    expect(result.visitedCities).toBe(1);
    expect(result.targetCities).toBe(2);
    expect(result.unavailableCount).toBe(2);
    expect(result.groups.map(({ earned, total }) => [earned, total])).toEqual([
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
  });
  it("ブラウザが応答しなくても取得処理を12秒で終了する", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    });
    const result = expect(locateForStamp()).rejects.toThrow("タイムアウト");
    await vi.advanceTimersByTimeAsync(12000);
    await result;
  });
});
