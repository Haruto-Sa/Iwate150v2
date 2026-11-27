import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useStampCollection } from "./useStampCollection";
import type { Stamp } from "@/lib/types";

const session = vi.fn();
const api = vi.hoisted(() => ({ createStamp: vi.fn(), fetchStampCatalog: vi.fn(), fetchUserStamps: vi.fn() }));
vi.mock("@/components/auth/SessionProvider", () => ({ useAuthSession: () => session() }));
vi.mock("@/lib/privateUserClient", () => api);
const stamp: Stamp = { id: 1, user_id: 1, spot_id: 1, created_at: "2026-01-01" };
beforeEach(() => {
  vi.clearAllMocks();
  session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
  api.fetchStampCatalog.mockResolvedValue({ spots: [{ id: 1, city_id: 1, lat: 39.7, lng: 141.1 }], cities: [{ id: 1, name: "盛岡市" }], isSample: false });
  api.fetchUserStamps.mockResolvedValue([stamp]);
});

it("認証確認中は進捗を隠し、再認証でも読込完了まで前の記録を戻さない", async () => {
  const { result, rerender } = renderHook(() => useStampCollection());
  await waitFor(() => expect(result.current.progress.earned).toBe(1));
  session.mockReturnValue({ user: { id: "A" }, status: "loading" });
  rerender();
  expect(result.current.personalReady).toBe(false);
  expect(result.current.progress.earned).toBe(0);
  let resolveRecords!: (records: Stamp[]) => void;
  api.fetchUserStamps.mockImplementationOnce(() => new Promise<Stamp[]>((resolve) => { resolveRecords = resolve; }));
  session.mockReturnValue({ user: { id: "A" }, status: "authenticated" });
  rerender();
  expect(result.current.personalReady).toBe(false);
  expect(result.current.progress.earned).toBe(0);
  await act(async () => resolveRecords([]));
  expect(result.current.personalReady).toBe(true);
  expect(result.current.progress.earned).toBe(0);
});

it("切替前の遅い応答を無視し、再読込では公開情報と本人記録の待機状態を戻す", async () => {
  let resolveOld!: (records: Stamp[]) => void;
  api.fetchUserStamps.mockImplementationOnce(() => new Promise<Stamp[]>((resolve) => { resolveOld = resolve; }));
  const { result, rerender } = renderHook(() => useStampCollection());
  api.fetchUserStamps.mockResolvedValue([]);
  session.mockReturnValue({ user: { id: "B" }, status: "authenticated" });
  rerender();
  await waitFor(() => expect(result.current.personalReady).toBe(true));
  await act(async () => resolveOld([stamp]));
  expect(result.current.progress.earned).toBe(0);
  api.fetchStampCatalog.mockImplementationOnce(() => new Promise(() => {}));
  api.fetchUserStamps.mockImplementationOnce(() => new Promise(() => {}));
  act(() => result.current.reload());
  expect(result.current.publicLoading).toBe(true);
  expect(result.current.personalReady).toBe(false);
  expect(result.current.progress.earned).toBe(0);
});
