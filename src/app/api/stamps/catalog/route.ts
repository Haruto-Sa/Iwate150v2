import { loadStampCatalog } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * 本人データを含まない公開スタンプ対象と出所を返す。
 * @returns 公開スポット・市町村・サンプル判定
 * @example await GET();
 */
export async function GET() {
  return Response.json(await loadStampCatalog(), {
    headers: { "Cache-Control": "no-store" },
  });
}
