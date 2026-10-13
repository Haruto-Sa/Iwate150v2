import { afterEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ config: null as null | {
  runtimeCaching: Array<{ matcher: (context: { request: Request; url: URL }) => boolean; handler: unknown }>;
} }));
vi.mock("@serwist/next/worker", () => ({ defaultCache: [] }));
vi.mock("serwist", () => ({
  Serwist: class {
    constructor(config: typeof captured.config) { captured.config = config; }
    addEventListeners() {}
  },
  NetworkOnly: class {}, NetworkFirst: class {}, CacheFirst: class {}, ExpirationPlugin: class {},
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("private API service worker policy", () => {
  it("APIとAuthorization付き通信は画像キャッシュより前にNetworkOnlyへ入る", async () => {
    await import("./sw");
    const first = captured.config!.runtimeCaching[0];
    const { NetworkOnly } = await import("serwist");
    expect(first.handler).toBeInstanceOf(NetworkOnly);
    const api = new URL("/api/me/favorites", window.location.origin);
    expect(first.matcher({ url: api, request: new Request(api) })).toBe(true);
    const rest = new URL("https://storage.example/rest/v1/favorites");
    expect(first.matcher({ url: rest, request: new Request(rest, { headers: { authorization: "Bearer test" } }) })).toBe(true);
  });
  it("activateで旧RESTキャッシュと同一originのAPI応答を消去する", async () => {
    let activate!: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void;
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (String(type) === "activate") activate = listener as unknown as typeof activate;
    });
    const apiRequest = new Request(new URL("/api/auth/session", window.location.origin));
    const staticRequest = new Request(new URL("/logo.png", window.location.origin));
    const cache = { keys: vi.fn().mockResolvedValue([apiRequest, staticRequest]), delete: vi.fn().mockResolvedValue(true) };
    const storage = { keys: vi.fn().mockResolvedValue(["other-runtime"]), open: vi.fn().mockResolvedValue(cache), delete: vi.fn().mockResolvedValue(true) };
    vi.stubGlobal("caches", storage);
    await import("./sw");
    let work!: Promise<unknown>;
    activate({ waitUntil: (promise) => { work = promise; } });
    await work;
    expect(storage.delete).toHaveBeenCalledWith("voja-network-data");
    expect(cache.delete).toHaveBeenCalledExactlyOnceWith(apiRequest);
  });
});
