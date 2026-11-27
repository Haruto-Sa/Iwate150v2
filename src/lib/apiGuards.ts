import "server-only";

/**
 * APIの既知の失敗。
 */
export class ApiError extends Error {
  /**
   * @param status - HTTP status
   * @param message - 公開可能な説明
   * @example new ApiError(400, "Invalid input");
   */
  constructor(readonly status: number, message: string) { super(message); }
}

/**
 * 信頼するアプリURLと送信元を比較する。AUTH_URL未設定時は既存のrequest URL基準を維持する。
 * @param request - HTTP request
 * @returns なし
 * @example assertSameOrigin(request);
 */
export function assertSameOrigin(request: Request): void {
  const expectedOrigin = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) throw new ApiError(403, "送信元を確認できません。");
}

/**
 * 本文をサイズ・時間制限付きで読み、許可済みフィールドのみ受け付ける。
 * @param request - HTTP request
 * @param fields - 許可するキー
 * @returns JSON object
 * @param maxBytes - UTF-8本文の上限バイト数
 * @example await readLimitedJson(request, ["spotId"]);
 */
export async function readLimitedJson(request: Request, fields: readonly string[], maxBytes = 8192): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new ApiError(415, "JSONが必要です。");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "本文が必要です。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // cancelを先に呼ぶと保留中のreadがdoneになり、408より先に本文解析へ進む。取消しはfinallyで行う。
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new ApiError(408, "送信がタイムアウトしました。")); }, 5000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new ApiError(413, "本文が大きすぎます。");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new ApiError(400, "JSONが不正です。"); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !fields.includes(key))) {
      throw new ApiError(400, "入力項目が不正です。");
    }
    return body as Record<string, unknown>;
  } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}

