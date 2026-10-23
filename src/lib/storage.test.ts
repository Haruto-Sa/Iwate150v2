import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signing = vi.hoisted(() => ({ from: vi.fn(), sign: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ storage: { from: signing.from } }) }));

/**
 * 設定を分離し、読み込み時に環境変数を評価する実装を検証する。
 * @param env - 上書きする設定
 * @returns 再読み込みしたStorageモジュール
 * @example await loadStorage({ NEXT_PUBLIC_SUPABASE_URL: "https://storage.example" });
 */
async function loadStorage(env: Record<string, string | undefined> = {}) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", "SUPABASE_STORAGE_BUCKET", "NEXT_PUBLIC_SUPABASE_STORAGE_MODE", "NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  return import("./storage");
}

beforeEach(() => {
  signing.from.mockReset().mockReturnValue({ createSignedUrl: signing.sign });
  signing.sign.mockReset().mockResolvedValue({ data: { signedUrl: "https://signed.example/asset" }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("既存のStorage URL互換", () => {
  it("画像・モデルの先頭スラッシュを正規化し、対象外を区別する", async () => {
    const storage = await loadStorage();
    for (const input of ["/images/a.jpg", "images/a.jpg", "/models/x.obj", "models/x.obj"]) expect(storage.normalizeStoragePath(input)).toBe(input.replace(/^\//, ""));
    expect(storage.normalizeStoragePath("/foo.png")).toBeNull();
  });
  it("ASCIIを維持し、UTF-8の日本語をhexへ変換する", async () => {
    const storage = await loadStorage();
    expect(storage.toAsciiSafeStorageSegment("abc.jpg")).toBe("abc.jpg");
    expect(storage.toAsciiSafeStorageSegment("盛岡.jpg")).toBe("ue79b9be5b2a12e6a7067");
    expect(storage.encodeStoragePath("images//spots/盛岡.jpg")).toBe("images/spots/ue79b9be5b2a12e6a7067");
    expect(storage.encodeStoragePath("images/%E7%9B%9B%E5%B2%A1.jpg")).toBe("images/ue79b9be5b2a12e6a7067");
    expect(storage.decodeURIComponentSafe("%broken")).toBe("%broken");
  });
  it("設定なしではローカルパス、空はnull、外部URLはそのまま返す", async () => {
    const storage = await loadStorage();
    expect(storage.getPublicUrl("images/a.jpg")).toBe("/images/a.jpg");
    expect(storage.getPublicUrl("/assets/icon.png")).toBe("/assets/icon.png");
    expect(storage.getPublicUrl("other.jpg")).toBe("/other.jpg");
    expect(storage.getPublicUrl("")).toBeNull();
    expect(storage.getPublicUrl(null)).toBeNull();
    expect(storage.getPublicUrl("https://other.example/a.jpg")).toBe("https://other.example/a.jpg");
    expect(storage.isStorageUrl("https://storage.example/images/a.jpg")).toBe(false);
  });
  it.each([
    [undefined, undefined, "iwate150data"], ["public-bucket", "server-bucket", "public-bucket"],
    [undefined, "server-bucket", "server-bucket"], ["", "server-bucket", ""],
  ])("バケット設定の優先順位と空文字を維持する (%s, %s)", async (publicBucket, serverBucket, expected) => {
    const storage = await loadStorage({ NEXT_PUBLIC_SUPABASE_URL: "https://storage.example", NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET: publicBucket, SUPABASE_STORAGE_BUCKET: serverBucket });
    expect(storage.getPublicUrl("/images/a.jpg")).toBe(`https://storage.example/storage/v1/object/public/${expected}/images/a.jpg`);
  });
  it("object keyの抽出と既存URL判定を維持する", async () => {
    const storage = await loadStorage({ NEXT_PUBLIC_SUPABASE_URL: "https://storage.example" });
    expect(storage.toStorageObjectPath("https://storage.example/storage/v1/object/public/iwate150data/images/a.jpg")).toBe("images/a.jpg");
    expect(storage.toStorageObjectPath("https://other.example/a.jpg")).toBeNull();
    // 現行はホストではなくpublic bucket markerで抽出する。今回は仕様変更しない。
    expect(storage.toStorageObjectPath("https://other.example/storage/v1/object/public/iwate150data/images/a.jpg")).toBe("images/a.jpg");
    expect(storage.toStorageObjectPath("images/a.jpg")).toBe("images/a.jpg");
    expect(storage.isStorageUrl("https://storage.example/storage/v1/object/public/iwate150data/images/a.jpg")).toBe(true);
  });
});

it.each([[undefined, 21600], ["bad", 21600], ["Infinity", 21600], ["", 3600], ["1", 3600], ["3600.9", 3600], ["43200", 43200], ["999999", 86400]])("署名APIへ現行のTTLを渡す (%s)", async (setting, expected) => {
  vi.stubGlobal("window", undefined);
  const storage = await loadStorage({ NEXT_PUBLIC_SUPABASE_URL: "https://storage.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only", NEXT_PUBLIC_SUPABASE_STORAGE_MODE: "signed", NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN: setting });
  expect(await storage.resolveServerStorageUrl("images/a.jpg")).toBe("https://signed.example/asset");
  expect(signing.from).toHaveBeenCalledWith("iwate150data");
  expect(signing.sign).toHaveBeenCalledWith("images/a.jpg", expected);
});

it("署名キャッシュの再利用・期限5分前の更新・失敗時公開URLを維持する", async () => {
  vi.stubGlobal("window", undefined);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  const storage = await loadStorage({ NEXT_PUBLIC_SUPABASE_URL: "https://storage.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only", NEXT_PUBLIC_SUPABASE_STORAGE_MODE: "signed" });
  await storage.resolveServerStorageUrl("images/a.jpg");
  await storage.resolveServerStorageUrl("images/a.jpg");
  expect(signing.sign).toHaveBeenCalledTimes(1);
  vi.setSystemTime(new Date("2026-01-01T05:55:00Z"));
  signing.sign.mockResolvedValueOnce({ data: null, error: { message: "test failure" } });
  expect(await storage.resolveServerStorageUrl("images/a.jpg")).toBe("https://storage.example/storage/v1/object/public/iwate150data/images/a.jpg");
  expect(signing.sign).toHaveBeenCalledTimes(2);
});

it("サーバーのバケットとTTLはモジュール読み込み時の設定を維持する", async () => {
  vi.stubGlobal("window", undefined);
  const storage = await loadStorage({ NEXT_PUBLIC_SUPABASE_URL: "https://storage.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only", NEXT_PUBLIC_SUPABASE_STORAGE_MODE: "signed", NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET: "initial", NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN: "43200" });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET", "changed");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_SIGNED_URL_EXPIRES_IN", "7200");
  await storage.resolveServerStorageUrl("images/a.jpg");
  expect(signing.from).toHaveBeenCalledWith("initial");
  expect(signing.sign).toHaveBeenCalledWith("images/a.jpg", 43200);
});
