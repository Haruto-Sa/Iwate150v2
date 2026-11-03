export type CameraRect = { x: number; y: number; width: number; height: number };
export type CameraModelPlacement = CameraRect & { scale: number };

/**
 * 空き矩形から使用領域を除く。重なる候補を残し、幅広・縦長の空間を維持する。
 * @param free - 空き領域
 * @param occupied - 顔または配置済みモデルの領域
 * @returns 使用領域に重ならない矩形候補
 * @example subtract({x:0,y:0,width:1,height:1}, face);
 */
function subtract(free: CameraRect, occupied: CameraRect): CameraRect[] {
  const left = Math.max(free.x, occupied.x);
  const top = Math.max(free.y, occupied.y);
  const right = Math.min(free.x + free.width, occupied.x + occupied.width);
  const bottom = Math.min(free.y + free.height, occupied.y + occupied.height);
  if (left >= right || top >= bottom) return [free];
  return [
    { x: free.x, y: free.y, width: left - free.x, height: free.height },
    { x: right, y: free.y, width: free.x + free.width - right, height: free.height },
    { x: free.x, y: free.y, width: free.width, height: top - free.y },
    { x: free.x, y: bottom, width: free.width, height: free.y + free.height - bottom },
  ].filter((rect) => rect.width > 0 && rect.height > 0);
}

/**
 * 顔と他のモデルを避け、描画前に画面内の位置・倍率を決める。最大5体。
 * @param face - 表示領域での顔矩形（0〜1、クロップ外も可）
 * @param sizes - 各モデルの透視投影を含む最大外形（0〜1）
 * @returns 選択順の配置。余白がなければnull
 * @example const slots = layoutCameraModels(face, [{width:0.2,height:0.3}]);
 */
export function layoutCameraModels(
  face: CameraRect,
  sizes: ReadonlyArray<{ width: number; height: number }>,
): Array<CameraModelPlacement | null> {
  const gap = 0.02;
  let free = subtract(
    { x: gap, y: gap, width: 1 - 2 * gap, height: 1 - 2 * gap },
    { x: face.x - gap, y: face.y - gap, width: face.width + 2 * gap, height: face.height + 2 * gap },
  );
  return sizes.slice(0, 5).map((size, index) => {
    const angle = ((sizes.length === 2 ? 0 : -90) + index * 360 / sizes.length) * Math.PI / 180;
    const preferredX = face.x + face.width / 2 + Math.cos(angle) * (face.width / 2 + size.width / 2 + gap);
    const preferredY = face.y + face.height / 2 + Math.sin(angle) * (face.height / 2 + size.height / 2 + gap);
    let best: CameraModelPlacement | null = null;
    let bestScore = -Infinity;
    for (const rect of free) {
      const scale = Math.min(1, rect.width / size.width, rect.height / size.height);
      const width = size.width * scale;
      const height = size.height * scale;
      const x = Math.max(rect.x, Math.min(rect.x + rect.width - width, preferredX - width / 2));
      const y = Math.max(rect.y, Math.min(rect.y + rect.height - height, preferredY - height / 2));
      // 大きさを優先しつつ、同程度なら元の周囲配置に近い空間を選ぶ。
      const score = scale - Math.hypot(x + width / 2 - preferredX, y + height / 2 - preferredY) / 4;
      if (score > bestScore + 1e-9) { best = { x, y, width, height, scale }; bestScore = score; }
    }
    if (!best) return null;
    const occupied = { x: best.x - gap, y: best.y - gap, width: best.width + 2 * gap, height: best.height + 2 * gap };
    const remaining = free.flatMap((rect) => subtract(rect, occupied));
    // 他の候補に含まれる矩形を除き、最大5体の探索候補を小さく保つ。
    free = remaining.filter((rect, i) => !remaining.some((other, j) => j !== i &&
      other.x <= rect.x && other.y <= rect.y && other.x + other.width >= rect.x + rect.width &&
      other.y + other.height >= rect.y + rect.height &&
      (j < i || other.width > rect.width || other.height > rect.height)));
    return best;
  });
}
