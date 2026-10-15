import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreparedPhoto } from "./usePreparedPhoto";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("usePreparedPhoto", () => {
  it("hides the old file immediately and ignores late completion from old edits", async () => {
    let finishOld!: (blob: Blob) => void;
    const oldBuild = () => new Promise<Blob>((resolve) => { finishOld = resolve; });
    const first = vi.fn(async () => new Blob(["first"]));
    const { result, rerender } = renderHook(({ build }) => usePreparedPhoto(build, true), { initialProps: { build: first as () => Promise<Blob> } });
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(result.current.file?.size).toBe(5);
    rerender({ build: oldBuild });
    expect(result.current.file).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(150));
    rerender({ build: async () => new Blob(["latest-photo"]) });
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(result.current.file?.size).toBe(12);
    await act(async () => finishOld(new Blob(["old"])));
    expect(result.current.file?.size).toBe(12);
  });

  it("reports a stalled export after ten seconds and supports retry", async () => {
    const build = vi.fn<() => Promise<Blob | null>>().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(new Blob(["photo"]));
    const { result } = renderHook(() => usePreparedPhoto(build, true));
    await act(() => vi.advanceTimersByTimeAsync(10_150));
    expect(result.current.error).toContain("準備できません");
    act(() => result.current.retry());
    expect(result.current.preparing).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(result.current.file?.name).toBe("iwate-memory.png");
  });

  it.each([null, new Error("decode failed")])("reports a failed or empty export: %s", async (value) => {
    const build = async () => { if (value instanceof Error) throw value; return value; };
    const { result } = renderHook(() => usePreparedPhoto(build, true));
    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(result.current.error).toBeTruthy();
    expect(result.current.file).toBeNull();
  });

  it("does not generate an absent photo", async () => {
    const build = vi.fn();
    const { result } = renderHook(() => usePreparedPhoto(build, false));
    await act(() => vi.advanceTimersByTimeAsync(12_000));
    expect(build).not.toHaveBeenCalled();
    expect(result.current.preparing).toBe(false);
  });
});
