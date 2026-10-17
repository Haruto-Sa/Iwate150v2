"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { 
  Sticker, Undo2, Type, Palette,
  Move, Maximize2, ChevronDown, ChevronUp, X, ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { PhotoSharePanel } from "@/components/camera/PhotoSharePanel";
import { Button } from "@/components/ui/Button";

type StickerItem = { id: string; char: string; x: number; y: number; size: number };
type TextItem = { 
  id: string; 
  text: string; 
  font: string; 
  color: string; 
  size: number; 
  x: number; 
  y: number;
};

type EditMode = "move" | "resize";
type ToolPanel = "sticker" | "text" | null;

const stickerPalette = ["🌊", "🌲", "✨", "🏔️", "🥢", "🚌", "🧭", "🍜", "🐟", "🦌", "🍎", "🌸"];
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
  const draggingRef = useRef<{ type: "sticker" | "text"; id: string; startX: number; startY: number; startSize: number } | null>(null);

  // Load captured photo + detection
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("capturedPhoto");
      // ブラウザの保存領域をマウント後に読み込む。SSRと初回描画を一致させる。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setPhoto(stored);
      const det = sessionStorage.getItem("capturedDetection");
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

  /**
   * ドラッグ対象と開始座標を記録する。
   * @param e - ポインター操作
   * @param type - 文字またはスタンプ
   * @param id - 対象ID
   * @returns なし
   * @example handlePointerDown(event, "text", "caption");
   */
  const handlePointerDown = useCallback((e: React.PointerEvent, type: "sticker" | "text", id: string) => {
    e.stopPropagation();
    setActiveItemId(id);
    setActiveItemType(type);
    
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    
    const item = type === "sticker" 
      ? stickers.find(s => s.id === id)
      : texts.find(t => t.id === id);
    
    draggingRef.current = { 
      type, 
      id, 
      startX: (e.clientX - rect.left) / rect.width,
      startY: (e.clientY - rect.top) / rect.height,
      startSize: item?.size || 0.06
    };
  }, [stickers, texts]);

  /**
   * 選択要素の移動または拡大縮小を反映する。
   * @param e - ポインター操作
   * @returns なし
   * @example onPointerMove={handlePointerMove}
   */
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;
    
    const { type, id, startY, startSize } = draggingRef.current;

    if (editMode === "move") {
      // 移動モード
      const clamped = { 
        x: Math.min(0.95, Math.max(0.05, currentX)), 
        y: Math.min(0.95, Math.max(0.05, currentY)) 
      };

      if (type === "sticker") {
        setStickers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...clamped } : s))
        );
      } else {
        setTexts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...clamped } : t))
        );
      }
    } else {
      // リサイズモード - 垂直方向のドラッグでサイズ変更
      const deltaY = startY - currentY;
      const newSize = Math.min(0.2, Math.max(0.03, startSize + deltaY * 0.3));
      
      if (type === "sticker") {
        setStickers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, size: newSize } : s))
        );
      } else {
        setTexts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, size: newSize } : t))
        );
      }
    }
  }, [editMode]);

  /**
   * ドラッグ状態を解除する。
   * @returns なし
   * @example stopDrag();
   */
  const stopDrag = useCallback(() => {
    draggingRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointerup", stopDrag);
    return () => window.removeEventListener("pointerup", stopDrag);
  }, [stopDrag]);

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
  }, [photo, stickers, texts]);


  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-8">
      <header className="space-y-3">
        <Link href="/camera" className="inline-flex min-h-11 items-center gap-2 text-sm text-emerald-900"><ArrowLeft aria-hidden="true" className="h-4 w-4" />カメラに戻る</Link>
        <p className="text-[10px] font-semibold tracking-[0.22em] text-emerald-900/70">IWATE / PHOTO STUDIO</p>
        <h1 className="text-2xl font-semibold text-[#173f35] sm:text-3xl">この旅を、一枚に。</h1>
        <p className="text-sm text-emerald-900/75">文字やスタンプを添えて、岩手の思い出を残しましょう。</p>
      </header>
      {/* ヘッダー説明 */}
      <div className="rounded-xl border border-emerald-900/10 bg-white px-3 py-2 text-xs text-emerald-900/80 shadow-sm">
        ドラッグで移動、モード切替でサイズ変更。タップで選択後、削除や編集ができます。
      </div>

      {/* プレビューエリア */}
      <div
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onClick={() => {
          setActiveItemId(null);
          setActiveItemType(null);
        }}
        className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-lg"

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
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#f6f5ee]">
              <p className="text-sm text-emerald-900/70">写真がありません</p>
              <Link href="/camera" className="inline-flex min-h-11 items-center rounded-full bg-[#173f35] px-5 text-sm text-white">写真を撮りに行く</Link>
            </div>
          )}
        </div>
      </div>

      {photo && <PhotoSharePanel build={generateImage} hasPhoto={Boolean(photo)} />}

      {photo && <>
      {/* 編集モード切り替え */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-900/10 bg-white p-2 shadow-sm">
        <span className="px-2 text-xs text-emerald-900/70">モード:</span>
        <Button
          variant={editMode === "move" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setEditMode("move")}
          className="gap-1.5"
        >
          <Move className="h-3.5 w-3.5" />
          移動
        </Button>
        <Button
          variant={editMode === "resize" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setEditMode("resize")}
          className="gap-1.5"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          サイズ
        </Button>
        <div className="flex-1" />
        {activeItemId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteActiveItem}
            className="gap-1.5 !text-red-700 hover:!bg-red-50"
          >
            <X className="h-3.5 w-3.5" />
            削除
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={resetOverlays}
          className="gap-1.5"
        >
          <Undo2 className="h-3.5 w-3.5" />
          リセット
        </Button>
      </div>

      {/* コンパクトツールバー */}
      <div className="flex gap-2">
        {/* スタンプボタン */}
        <Button
          variant={activeToolPanel === "sticker" ? "primary" : "outline"}
          size="sm"
          onClick={() => setActiveToolPanel(activeToolPanel === "sticker" ? null : "sticker")}
          className="flex-1 justify-center gap-2"
        >
          <Sticker className="h-4 w-4" />
          スタンプ
          {activeToolPanel === "sticker" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        
        {/* テキストボタン */}
        <Button
          variant={activeToolPanel === "text" ? "primary" : "outline"}
          size="sm"
          onClick={() => setActiveToolPanel(activeToolPanel === "text" ? null : "text")}
          className="flex-1 justify-center gap-2"
        >
          <Type className="h-4 w-4" />
          テキスト
          {activeToolPanel === "text" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* 展開パネル：スタンプ */}
      {activeToolPanel === "sticker" && (
        <div className="rounded-xl border border-emerald-900/10 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-6 gap-2">
            {stickerPalette.map((s) => (
              <button
                key={s}
                onClick={() => addSticker(s)}
                className="flex aspect-square items-center justify-center rounded-lg border border-emerald-900/10 bg-white text-xl transition hover:border-emerald-300 hover:bg-emerald-50 active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 展開パネル：テキスト */}
      {activeToolPanel === "text" && (
        <div className="space-y-3 rounded-xl border border-emerald-900/10 bg-white p-3 shadow-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={addText}
            className="w-full justify-center gap-2"
          >
            <Type className="h-4 w-4" />
            新しいテキストを追加
          </Button>
          
          {activeText && (
            <div className="space-y-2 border-t border-emerald-100 pt-3">
              <input
                className="w-full rounded-lg border border-emerald-900/15 bg-white px-3 py-2 text-sm text-emerald-900 outline-none ring-emerald-200 focus:ring-2"
                value={activeText.text}
                onChange={(e) =>
                  setTexts((prev) =>
                    prev.map((t) => (t.id === activeText.id ? { ...t, text: e.target.value } : t))
                  )
                }
                aria-label="写真に添える文字"
                placeholder="テキストを入力..."
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-emerald-700" />
                  <input
                    aria-label="文字の色"
                    type="color"
                    value={activeText.color}
                    onChange={(e) =>
                      setTexts((prev) =>
                        prev.map((t) =>
                          t.id === activeText.id ? { ...t, color: e.target.value } : t
                        )
                      )
                    }
                    className="h-8 w-8 cursor-pointer rounded border border-emerald-200"
                  />
                </div>
                <select
                  className="flex-1 rounded-lg border border-emerald-900/15 bg-white px-2 py-1.5 text-xs text-emerald-900"
                  aria-label="文字の書体"
                  value={activeText.font}
                  onChange={(e) =>
                    setTexts((prev) =>
                      prev.map((t) =>
                        t.id === activeText.id ? { ...t, font: e.target.value } : t
                      )
                    )
                  }
                >
                  {fontOptions.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          
          {activeSticker && (
            <div className="border-t border-emerald-100 pt-3">
              <p className="text-xs text-emerald-700">
                選択中のスタンプ: {activeSticker.char}
              </p>
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
