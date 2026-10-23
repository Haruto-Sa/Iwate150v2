/**
 * Studio一覧のページURLを構築する。
 * @param basePath - 管理一覧のパス
 * @param page - 現在ページ
 * @param editId - 編集対象ID
 * @returns ページと編集対象を含むURL
 * @example buildStudioPageHref("/studio/spots", 2, 15);
 */
export function buildStudioPageHref(basePath: string, page: number, editId?: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (editId) params.set("edit", String(editId));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * APIエラーレスポンスから表示用メッセージを取得する。
 * @param response - fetchのレスポンス
 * @returns APIのerror文字列。取得できない場合はステータス付きの既定文
 * @example const message = await readStudioErrorMessage(response);
 */
export async function readStudioErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    return `Request failed with status ${response.status}.`;
  }
  return `Request failed with status ${response.status}.`;
}

