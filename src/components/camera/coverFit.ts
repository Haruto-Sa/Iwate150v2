/**
 * object-cover映像の正規化座標を表示座標に移す補正を求める。
 * @param videoW - 映像の幅
 * @param videoH - 映像の高さ
 * @param displayW - 表示領域の幅
 * @param displayH - 表示領域の高さ
 * @returns 拡大率と正規化オフセット
 * @example const t = computeCoverTransform(1280, 720, 390, 844);
 */
export function computeCoverTransform(videoW: number, videoH: number, displayW: number, displayH: number) {
  let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
  const videoAspect = videoW / videoH;
  const displayAspect = displayW / displayH;
  if (videoAspect > displayAspect) {
    const visibleFraction = displayAspect / videoAspect;
    scaleX = 1 / visibleFraction;
    offsetX = (1 - visibleFraction) / 2;
  } else {
    const visibleFraction = videoAspect / displayAspect;
    scaleY = 1 / visibleFraction;
    offsetY = (1 - visibleFraction) / 2;
  }
  return { scaleX, scaleY, offsetX, offsetY };
}

/**
 * object-coverで見える映像範囲を整数ピクセルで求める。
 * @param sourceW - 元映像の幅
 * @param sourceH - 元映像の高さ
 * @param previewW - 出力の基準となる表示幅
 * @param previewH - 出力の基準となる表示高さ
 * @returns drawImageに渡す切り抜き位置と寸法
 * @example const { sx, sy, sw, sh } = computeCoverCrop(1280, 720, 390, 844);
 */
export function computeCoverCrop(sourceW: number, sourceH: number, previewW: number, previewH: number) {
  const previewAspect = previewW / previewH;
  const sourceAspect = sourceW / sourceH;
  let sx = 0;
  let sy = 0;
  let sw = sourceW;
  let sh = sourceH;
  if (sourceAspect > previewAspect) {
    sw = Math.round(sourceH * previewAspect);
    sx = Math.round((sourceW - sw) / 2);
  } else if (sourceAspect < previewAspect) {
    sh = Math.round(sourceW / previewAspect);
    sy = Math.round((sourceH - sh) / 2);
  }
  return { sx, sy, sw, sh };
}
