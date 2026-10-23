import { afterEach, expect, it, vi } from "vitest";
import { addFavorite, fetchUserFavorites, mergeFavorites } from "./privateUserClient";

afterEach(() => vi.unstubAllGlobals());

it("本人APIのページを順に取得し、同一オリジン・セッション情報を維持する", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ items: [{ spot_id: 1 }], nextOffset: 100 }))
    .mockResolvedValueOnce(Response.json({ items: [{ spot_id: 2 }], nextOffset: null }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await fetchUserFavorites("session-A")).toEqual([{ spot_id: 1 }, { spot_id: 2 }]);
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(["/api/me/favorites?offset=0", "/api/me/favorites?offset=100"]);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "same-origin", cache: "no-store", headers: { "X-Session-User": "session-A" } });
});

it("取得途中の失敗を部分一覧に変換しない", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ items: [{ spot_id: 1 }], nextOffset: 100 }))
    .mockResolvedValueOnce(new Response(null, { status: 500 })));
  await expect(fetchUserFavorites("session-A")).rejects.toThrow("保存サービスに接続できません");
});

it("保存確認済みIDだけを返し、空の同期は送信しない", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ items: [{ spot_id: 4 }] }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await mergeFavorites("session-A", [])).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await addFavorite("session-A", 3)).toBeNull();
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ spotId: 3 }) });
});
