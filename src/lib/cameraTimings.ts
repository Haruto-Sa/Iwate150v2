const PREFIX = "iwate-camera:";
const recorded = new Set<string>();

/**
 * カメラ開始ごとに前回の計測を捨てる。画像や顔座標は記録しない。
 * @returns なし
 * @example resetCameraTimings();
 */
export function resetCameraTimings() {
  for (const name of recorded) performance.clearMarks(PREFIX + name);
  recorded.clear();
}

/**
 * 各段階の最初の到達時刻を記録する。描画ループから呼んでも記録は最大64件。
 * @param stage - 固定の段階名とカタログ内のモデルID
 * @returns なし
 * @example markCameraTiming("face:first-result");
 */
export function markCameraTiming(stage: string) {
  if (recorded.has(stage) || recorded.size >= 64) return;
  recorded.add(stage);
  performance.mark(PREFIX + stage);
}

/**
 * 同期の解析処理を計測する。例外は呼び出し元へそのまま返す。
 * @param stage - 解析段階
 * @param work - 既存の解析処理
 * @returns 解析結果
 * @example measureCameraWork("sobacchi:parse", () => loader.parse(text));
 */
export function measureCameraWork<T>(stage: string, work: () => T): T {
  markCameraTiming(`${stage}:start`);
  try {
    return work();
  } finally {
    markCameraTiming(`${stage}:end`);
  }
}
