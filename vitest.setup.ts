import "@testing-library/jest-dom/vitest";

type LegacyMatchMediaListener = (this: MediaQueryList, ev: MediaQueryListEvent) => any;
type MatchMediaListener = EventListenerOrEventListenerObject | LegacyMatchMediaListener;

/**
 * 現在のビューポート幅とクエリから一致判定を返す。
 *
 * @param query - media query
 * @returns 一致する場合 true
 * @example
 * evaluateMediaQuery("(max-width: 767px)");
 */
function evaluateMediaQuery(query: string): boolean {
  const maxWidthMatch = query.match(/\(max-width:\s*(\d+)px\)/);
  if (maxWidthMatch) {
    return window.innerWidth <= Number(maxWidthMatch[1]);
  }

  if (query.includes("(display-mode: standalone)")) {
    return false;
  }

  return false;
}

/**
 * MediaQueryList のリスナーを呼び出す。
 *
 * @param listener - 登録済みリスナー
 * @param event - 発火するイベント
 * @returns なし
 * @example
 * notifyMatchMediaListener(() => {}, new Event("change"));
 */
function notifyMatchMediaListener(
  listener: MatchMediaListener,
  event: Event,
  mediaQueryList: MediaQueryList
): void {
  if (typeof listener === "function") {
    listener.call(mediaQueryList, event as MediaQueryListEvent);
    return;
  }

  listener.handleEvent(event);
}

Object.defineProperty(window, "resizeTo", {
  writable: true,
  value: (width: number, height: number) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: height });
    window.dispatchEvent(new Event("resize"));
  },
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList => {
    const listeners = new Set<MatchMediaListener>();
    const mediaQueryListEvent = {
      matches: evaluateMediaQuery(query),
      media: query,
    } as MediaQueryListEvent;
    const mediaQueryList = {
      matches: mediaQueryListEvent.matches,
      media: query,
      onchange: null,
      addListener: (listener: LegacyMatchMediaListener | null) => {
        if (!listener) {
          return;
        }
        listeners.add(listener);
      },
      removeListener: (listener: LegacyMatchMediaListener | null) => {
        if (!listener) {
          return;
        }
        listeners.delete(listener);
      },
      addEventListener: (_type: string, listener: MatchMediaListener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: MatchMediaListener) => {
        listeners.delete(listener);
      },
      dispatchEvent: (event: Event) => {
        const nextEvent = event.type === "change" ? mediaQueryListEvent : event;
        listeners.forEach((listener) => notifyMatchMediaListener(listener, nextEvent, mediaQueryList));
        return true;
      },
    } as MediaQueryList;

    return mediaQueryList;
  },
});
