import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import {
  INSTALL_PROMPT_DISMISS_UNTIL_KEY,
  INSTALL_PROMPT_VISIT_KEY,
} from "@/lib/config";

type BeforeInstallPromptEventLike = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function installPromptEvent(
  outcome: "accepted" | "dismissed" = "accepted"
): BeforeInstallPromptEventLike {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as BeforeInstallPromptEventLike;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  return event;
}

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

describe("useInstallPrompt", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
    );
    Object.defineProperty(window.navigator, "standalone", {
      value: false,
      configurable: true,
    });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
  });

  it("初回訪問でインストール促進を表示する", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      window.dispatchEvent(installPromptEvent());
    });

    await waitFor(() => {
      expect(result.current.visitCount).toBe(1);
      expect(result.current.shouldShow).toBe(true);
    });
  });

  it("2回目は非表示で3回目に再表示する", async () => {
    const first = renderHook(() => useInstallPrompt());
    await act(async () => {
      window.dispatchEvent(installPromptEvent());
    });
    await waitFor(() => {
      expect(first.result.current.visitCount).toBe(1);
    });
    first.unmount();

    const second = renderHook(() => useInstallPrompt());
    await act(async () => {
      window.dispatchEvent(installPromptEvent());
    });
    await waitFor(() => {
      expect(second.result.current.visitCount).toBe(2);
      expect(second.result.current.shouldShow).toBe(false);
    });
    second.unmount();

    const third = renderHook(() => useInstallPrompt());
    await act(async () => {
      window.dispatchEvent(installPromptEvent());
    });
    await waitFor(() => {
      expect(third.result.current.visitCount).toBe(3);
      expect(third.result.current.shouldShow).toBe(true);
    });
  });

  it("あとでを押すと7日間は非表示になる", async () => {
    const { result, unmount } = renderHook(() => useInstallPrompt());
    await act(async () => {
      window.dispatchEvent(installPromptEvent());
    });

    await waitFor(() => {
      expect(result.current.shouldShow).toBe(true);
    });

    act(() => {
      result.current.dismissForDays(7);
    });
    expect(Number(window.localStorage.getItem(INSTALL_PROMPT_DISMISS_UNTIL_KEY))).toBeGreaterThan(
      Date.now()
    );

    unmount();

    const nextVisit = renderHook(() => useInstallPrompt());
    await act(async () => {
      window.dispatchEvent(installPromptEvent());
    });
    await waitFor(() => {
      expect(nextVisit.result.current.visitCount).toBe(2);
      expect(nextVisit.result.current.shouldShow).toBe(false);
    });
  });

  it("standalone では表示しない", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      window.dispatchEvent(installPromptEvent());
    });

    await waitFor(() => {
      expect(result.current.visitCount).toBe(1);
      expect(result.current.isStandalone).toBe(true);
      expect(result.current.shouldShow).toBe(false);
    });
  });

  it("iOS Safari では beforeinstallprompt がなくても案内対象になる", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    );

    const { result } = renderHook(() => useInstallPrompt());

    await waitFor(() => {
      expect(result.current.visitCount).toBe(1);
      expect(result.current.isIosSafari).toBe(true);
      expect(result.current.shouldShow).toBe(true);
    });
    expect(window.localStorage.getItem(INSTALL_PROMPT_VISIT_KEY)).toBe("1");
  });
});
