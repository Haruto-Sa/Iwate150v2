import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCaptureTimer } from "./useCaptureTimer";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it.each([0, 3, 10] as const)("%i秒後に一度だけ撮影し、連打を受け付けない", (delay) => {
  const capture = vi.fn(() => true);
  const { result } = renderHook(() => useCaptureTimer(true, capture));
  act(() => { result.current.start(delay); result.current.start(delay); });
  if (delay) {
    expect(capture).not.toHaveBeenCalled();
    expect(result.current.remaining).toBe(delay);
    act(() => vi.advanceTimersByTime((delay - 1) * 1000));
    expect(result.current.remaining).toBe(1);
    expect(capture).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
  }
  expect(capture).toHaveBeenCalledTimes(1);
  act(() => { result.current.start(delay); vi.advanceTimersByTime(15000); });
  expect(capture).toHaveBeenCalledTimes(1);
});

it("取消後に古い予約が発火せず、新しい予約だけ実行する", () => {
  const capture = vi.fn(() => true);
  const { result } = renderHook(() => useCaptureTimer(true, capture));
  act(() => result.current.start(3));
  act(() => { vi.advanceTimersByTime(2000); result.current.cancel(); result.current.start(10); });
  act(() => vi.advanceTimersByTime(1000));
  expect(capture).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(9000));
  expect(capture).toHaveBeenCalledTimes(1);
});

it("カメラやモデルが準備未完了になった予約は復帰後も実行しない", () => {
  const capture = vi.fn(() => true);
  const { result, rerender } = renderHook(({ ready }) => useCaptureTimer(ready, capture), { initialProps: { ready: true } });
  act(() => result.current.start(3));
  rerender({ ready: false });
  act(() => result.current.start(0));
  rerender({ ready: true });
  act(() => vi.advanceTimersByTime(10000));
  expect(capture).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
});

it.each(["visibilitychange", "pagehide", "unmount"])("%sで撮影を取り消す", (event) => {
  const capture = vi.fn(() => true);
  const { result, unmount } = renderHook(() => useCaptureTimer(true, capture));
  act(() => result.current.start(3));
  act(() => {
    if (event === "unmount") unmount();
    else if (event === "pagehide") window.dispatchEvent(new Event(event));
    else {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      document.dispatchEvent(new Event(event));
    }
    vi.advanceTimersByTime(10000);
  });
  expect(capture).not.toHaveBeenCalled();
});

it("保存失敗後は再撮影できる", () => {
  const capture = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
  const { result } = renderHook(() => useCaptureTimer(true, capture));
  act(() => result.current.start(0));
  expect(result.current.busy).toBe(false);
  act(() => result.current.start(0));
  expect(capture).toHaveBeenCalledTimes(2);
});

it.each(["link", "popstate"])("%sの遷移開始で、画面が残っていても撮影を取り消す", (event) => {
  const capture = vi.fn(() => true);
  const { result } = renderHook(() => useCaptureTimer(true, capture));
  act(() => result.current.start(10));
  act(() => {
    if (event === "popstate") window.dispatchEvent(new PopStateEvent("popstate"));
    else {
      const link = document.createElement("a");
      link.href = "/character";
      link.addEventListener("click", (e) => e.preventDefault());
      document.body.append(link);
      link.click();
      link.remove();
    }
    vi.advanceTimersByTime(11000);
  });
  expect(capture).not.toHaveBeenCalled();
});
