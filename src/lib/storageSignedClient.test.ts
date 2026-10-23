import { afterEach, beforeEach, expect, it, vi } from "vitest";

const signing = vi.hoisted(() => ({ from: vi.fn(), sign: vi.fn() }));
vi.mock("./supabaseClient", () => ({ getSupabaseClient: () => ({ storage: { from: signing.from } }) }));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_MODE", "signed");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", "browser-bucket");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "server-bucket");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN", "43200.9");
  signing.from.mockReset().mockReturnValue({ createSignedUrl: signing.sign });
  signing.sign.mockReset().mockResolvedValue({ data: { signedUrl: "https://signed.example/asset" }, error: null });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); localStorage.clear(); });

it("公開バケット設定と丸めたTTLで署名し、同じ画像をキャッシュから返す", async () => {
  const { resolveClientSignedStorageUrl } = await import("./storageSignedClient");
  expect(await resolveClientSignedStorageUrl("images/a.jpg", "image")).toBe("https://signed.example/asset");
  expect(await resolveClientSignedStorageUrl("/images/a.jpg", "image")).toBe("https://signed.example/asset");
  expect(signing.from).toHaveBeenCalledWith("browser-bucket");
  expect(signing.sign).toHaveBeenCalledExactlyOnceWith("images/a.jpg", 43200);
});

it("公開設定が未指定ならサーバー側バケット名へフォールバックする", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN", "invalid");
  const { resolveClientSignedStorageUrl } = await import("./storageSignedClient");
  await resolveClientSignedStorageUrl("models/a.obj", "model");
  expect(signing.from).toHaveBeenCalledWith("server-bucket");
  expect(signing.sign).toHaveBeenCalledWith("models/a.obj", 21600);
});

it("publicモードでは署名せず、signedモードの失敗はnullで返す", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_MODE", "public");
  const { resolveClientSignedStorageUrl } = await import("./storageSignedClient");
  expect(await resolveClientSignedStorageUrl("images/a.jpg")).toBeNull();
  expect(signing.sign).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_MODE", "signed");
  signing.sign.mockResolvedValueOnce({ data: null, error: { message: "test failure" } });
  expect(await resolveClientSignedStorageUrl("images/a.jpg")).toBeNull();
});

it("ブラウザーの新しい署名要求では呼び出し時の設定を読む", async () => {
  const { resolveClientSignedStorageUrl } = await import("./storageSignedClient");
  await resolveClientSignedStorageUrl("images/a.jpg");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", "changed");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN", "7200");
  await resolveClientSignedStorageUrl("images/b.jpg");
  expect(signing.from).toHaveBeenLastCalledWith("changed");
  expect(signing.sign).toHaveBeenLastCalledWith("images/b.jpg", 7200);
});
