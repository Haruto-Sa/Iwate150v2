/**
 * 公開アセットURLからHTTP(S)のオリジンだけを取り出す。
 * @param value - 公開環境変数のURL（相対パスはselfで扱う）
 * @returns オリジン。不正・相対URLは空文字
 * @example publicAssetOrigin("https://cdn.example/assets");
 */
function publicAssetOrigin(value?: string): string {
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:"].includes(url.protocol) ? url.origin : "";
  } catch {
    return "";
  }
}

/**
 * 適用前の配信ポリシー候補をブラウザー内で観測するためのヘッダー値を作る。
 * @param options - 公開アセットの設定
 * @returns Report-Only用のCSP。報告の外部送信先は設定しない
 * @example buildObservedHeaderPolicy({ supabaseUrl: "https://example.supabase.co" });
 */
export function buildObservedHeaderPolicy(options: { supabaseUrl?: string; faceMeshAssetBase?: string }): string {
  const supabase = publicAssetOrigin(options.supabaseUrl);
  const faceMesh = publicAssetOrigin(options.faceMeshAssetBase);
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://va.vercel-scripts.com ${faceMesh}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${faceMesh}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-to iwate-header-observation",
  ].map((directive) => directive.trim()).join("; ");
}
