import { deleteOwnData } from "@/lib/privateUserApi";

export const dynamic = "force-dynamic";

/**
 * 本人の登録情報・スタンプ・お気に入りを削除する。
 * @param request - DELETEリクエスト
 * @returns 本人限定の削除結果
 * @example await DELETE(request);
 */
export async function DELETE(request: Request) {
  return deleteOwnData(request);
}
