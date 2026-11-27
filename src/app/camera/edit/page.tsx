"use client";

import type { StickerItem, TextItem, EditMode, ToolPanel } from "@/components/camera/editor/types";
import { useOverlayDrag } from "@/components/camera/editor/useOverlayDrag";
import { renderEditedPhoto } from "@/components/camera/editor/renderEditedPhoto";
import { CAPTURED_PHOTO_KEY, CAPTURED_DETECTION_KEY } from "@/lib/config";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import Link from "next/link";
import { PhotoSharePanel } from "@/components/camera/PhotoSharePanel";
import { EditorToolPanel } from "@/components/camera/editor/EditorToolPanel";

const fontOptions = [
  { label: "Noto Sans JP", value: "\"Noto Sans JP\", 'Helvetica Neue', sans-serif" },
  { label: "Shippori Mincho", value: "\"Shippori Mincho\", serif" },
  { label: "Kosugi Maru", value: "\"Kosugi Maru\", sans-serif" },
  { label: "Bebas Neue", value: "\"Bebas Neue\", 'Segoe UI', sans-serif" },
];

/**
 * 撮影画像に文字・スタンプを重ね、最新の写真を保存・共有する。
 * @returns 写真編集画面
 * @example <CameraEditPage />
 */
export default function CameraEditPage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([
    {
      id: "caption",
      text: "Iwate Trip!",
      font: fontOptions[0].value,
      color: "#0f1c1a",
      size: 0.06,
      x: 0.5,
      y: 0.85,
    },
  ]);
  const [activeItemId, setActiveItemId] = useState<string | null>("caption");
  const [activeItemType, setActiveItemType] = useState<"sticker" | "text" | null>("text");
  const [editMode, setEditMode] = useState<EditMode>("move");
  const [activeToolPanel, setActiveToolPanel] = useState<ToolPanel>(null);
  const [detPos, setDetPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [photoAspect, setPhotoAspect] = useState(4 / 3);
  
  const nextOverlayId = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Load captured photo + detection
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CAPTURED_PHOTO_KEY);
      // ブラウザの保存領域をマウント後に読み込む。SSRと初回描画を一致させる。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setPhoto(stored);
      const det = sessionStorage.getItem(CAPTURED_DETECTION_KEY);
      if (det) setDetPos(JSON.parse(det));
    } catch {
      // 保存領域が使えない場合も空状態から撮影に戻れる。
      setDetPos(null);
    }
  }, []);

  // Default sticker placement avoiding face
  useEffect(() => {
    const base: StickerItem[] = [
      { id: "s1", char: "✨", x: 0.12, y: 0.12, size: 0.08 },
      { id: "s2", char: "🏔️", x: 0.82, y: 0.78, size: 0.09 },
    ];
    if (detPos) {
      const safeTop = Math.max(0.05, detPos.y - 0.12);
      const safeBottom = Math.min(0.9, detPos.y + detPos.height + 0.12);
      base[0].y = safeTop;
      base[1].y = safeBottom;
    }
    // 撮影時の顔位置が読み込まれたら初期装飾を一度配置する。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStickers(base);
  }, [detPos]);

  // フォントサイズは画像と同じ領域を基準にする。
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    /**
     * プレビュー幅の変化を文字・スタンプの表示サイズへ反映する。
     * @returns なし
     * @example updateSize();
     */
    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ w: rect.width, h: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [photo]);

  const activeText = useMemo(
    () => activeItemType === "text" && activeItemId ? texts.find((t) => t.id === activeItemId) : null,
    [texts, activeItemId, activeItemType]
  );

  const activeSticker = useMemo(
    () => activeItemType === "sticker" && activeItemId ? stickers.find((s) => s.id === activeItemId) : null,
    [stickers, activeItemId, activeItemType]
  );

  const { handlePointerDown, handlePointerMove } = useOverlayDrag({
    stageRef, stickers, texts, editMode,
    setStickers, setTexts, setActiveItemId, setActiveItemType,
  });

  /**
   * 編集画像にスタンプを追加する。
   * @param char - スタンプの絵文字
   * @returns なし
   * @example addSticker("🌊");
   */
  const addSticker = (char: string) => {
    const newId = `s-${++nextOverlayId.current}`;
    setStickers((prev) => [
      ...prev,
      { id: newId, char, x: 0.5, y: 0.5, size: 0.08 },
    ]);
    setActiveItemId(newId);
    setActiveItemType("sticker");
    setActiveToolPanel(null);
  };

  /**
   * 編集可能な文字を追加する。
   * @returns なし
   * @example addText();
   */
  const addText = () => {
    const newId = `t-${++nextOverlayId.current}`;
    setTexts((prev) => [
      ...prev,
      {
        id: newId,
        text: "テキスト",
        font: fontOptions[0].value,
        color: "#0f1c1a",
        size: 0.05,
        x: 0.5,
        y: 0.5,
      },
    ]);
    setActiveItemId(newId);
    setActiveItemType("text");
  };

  /**
   * 選択中の装飾を削除する。
   * @returns なし
   * @example deleteActiveItem();
   */
  const deleteActiveItem = () => {
    if (!activeItemId) return;
    if (activeItemType === "sticker") {
      setStickers((prev) => prev.filter((s) => s.id !== activeItemId));
    } else {
      setTexts((prev) => prev.filter((t) => t.id !== activeItemId));
    }
    setActiveItemId(null);
    setActiveItemType(null);
  };

  /**
   * 装飾を初期状態へ戻す。
   * @returns なし
   * @example resetOverlays();
   */
  const resetOverlays = () => {
    setStickers([]);
    setTexts([{
      id: "caption",
      text: "Iwate Trip!",
      font: fontOptions[0].value,
      color: "#0f1c1a",
      size: 0.06,
      x: 0.5,
      y: 0.85,
    }]);
    setActiveItemId("caption");
    setActiveItemType("text");
  };

  /**
   * プレビューと同じ座標・縦横比で編集内容をPNGへ合成する。
   * @returns 合成済み画像。写真またはCanvasがない場合はnull
   * @example const blob = await generateImage();
   */
  const generateImage = useCallback(async (): Promise<Blob | null> => {
    return renderEditedPhoto(photo, stickers, texts);
  }, [photo, stickers, texts]);


  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-8">
      <Link href="/camera" className="inline-flex min-h-11 items-center gap-2 text-sm text-app-ink"><ArrowLeft aria-hidden="true" className="h-4 w-4" />カメラに戻る</Link>
      <PageHeading title="写真を編集" />
      {/* プレビューエリア */}
      <div
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onClick={() => {
          setActiveItemId(null);
          setActiveItemType(null);
        }}
        className="relative overflow-hidden rounded-2xl border border-app-line/10 bg-app-surface shadow-lg"

      >
        <div className="relative flex w-full items-center justify-center" style={{ aspectRatio: photoAspect }}>
          {photo ? (
            <div className="relative h-full w-full">
              <img src={photo} alt="撮影した岩手旅の写真" className="h-full w-full object-contain" onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth && image.naturalHeight) setPhotoAspect(image.naturalWidth / image.naturalHeight);
              }} />
              
              {/* Stickers */}
              {stickers.map((s) => (
                <span
                  key={s.id}
                  onPointerDown={(e) => handlePointerDown(e, "sticker", s.id)}
                  className={`absolute cursor-grab select-none touch-none ${
                    activeItemId === s.id ? "ring-2 ring-emerald-500 ring-offset-2 rounded-lg" : ""
                  }`}
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${s.size * (stageSize.w || 300)}px`,
                    lineHeight: 1,
                  }}
                >
                  {s.char}
                </span>
              ))}
              
              {/* Texts */}
              {texts.map((t) => (
                <span
                  key={t.id}
                  onPointerDown={(e) => handlePointerDown(e, "text", t.id)}
                  className={`absolute cursor-grab select-none touch-none whitespace-nowrap rounded-md px-1 ${
                    activeItemId === t.id 
                      ? "ring-2 ring-emerald-500 ring-offset-2" 
                      : ""
                  }`}
                  style={{
                    left: `${t.x * 100}%`,
                    top: `${t.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    fontFamily: t.font,
                    fontSize: `${t.size * (stageSize.w || 300)}px`,
                    color: t.color,
                    lineHeight: 1,
                  }}
                >
                  {t.text}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-app-canvas">
              <p className="text-sm text-app-ink-muted">写真がありません</p>
              <Link href="/camera" className="inline-flex min-h-11 items-center rounded-full bg-[#173f35] px-5 text-sm text-white">写真を撮りに行く</Link>
            </div>
          )}
        </div>
      </div>

      {photo && <PhotoSharePanel build={generateImage} hasPhoto={Boolean(photo)} />}

      {photo && <>
      <EditorToolPanel
        editMode={editMode}
        setEditMode={setEditMode}
        activeItemId={activeItemId}
        deleteActiveItem={deleteActiveItem}
        resetOverlays={resetOverlays}
        activeToolPanel={activeToolPanel}
        setActiveToolPanel={setActiveToolPanel}
        addSticker={addSticker}
        addText={addText}
        activeText={activeText}
        activeSticker={activeSticker}
        setTexts={setTexts}
        fontOptions={fontOptions}
      />
      </>}
    </div>
  );
}
