import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const remotePatterns: Exclude<NonNullable<NextConfig["images"]>["remotePatterns"], undefined> = [];
const remotePatternKeys = new Set<string>();

/**
 * `next/image` の remote pattern を重複なく追加する。
 *
 * @param pattern - 追加対象パターン
 * @returns なし
 * @example
 * pushRemotePattern({
 *   protocol: "https",
 *   hostname: "**.supabase.co",
 *   pathname: "/storage/v1/object/**",
 * });
 */
function pushRemotePattern(
  pattern: Exclude<NonNullable<NextConfig["images"]>["remotePatterns"], undefined>[number]
): void {
  const key = `${pattern.protocol}://${pattern.hostname}${pattern.pathname}`;
  if (remotePatternKeys.has(key)) return;
  remotePatternKeys.add(key);
  remotePatterns.push(pattern);
}

// Supabase Storage の signed/public URL（/sign, /public 含む）を許可
pushRemotePattern({
  protocol: "https",
  hostname: "**.supabase.co",
  pathname: "/storage/v1/object/**",
});

if (supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    pushRemotePattern({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      pathname: "/storage/v1/object/**",
    });
  } catch {
    // 環境変数が不正なURL形式でもビルドを継続する
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns,
  },
};

export default nextConfig;
