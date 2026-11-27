import type { StickerItem, TextItem } from "./types";

/**
 * 写真の元の縦横比と正規化した装飾位置を使ってPNGを生成する。
 * @param photo - 元写真のURL。写真がない場合はnull
 * @param stickers - 重ねるスタンプ
 * @param texts - 重ねる文字
 * @returns 合成済みPNG。写真またはCanvasがない場合はnull
 * @example const blob = await renderEditedPhoto(photo, stickers, texts);
 */
export async function renderEditedPhoto(photo: string | null, stickers: StickerItem[], texts: TextItem[]): Promise<Blob | null> {
  if (!photo) return null;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = photo;
  await img.decode();
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 1280;
  canvas.height = img.naturalHeight || 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Stickers
  stickers.forEach((s) => {
    const fontSize = s.size * canvas.width;
    ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.char, s.x * canvas.width, s.y * canvas.height);
  });

  // Texts
  texts.forEach((t) => {
    const fontSize = t.size * canvas.width;
    ctx.font = `${fontSize}px ${t.font}`;
    ctx.fillStyle = t.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.text, t.x * canvas.width, t.y * canvas.height);
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
