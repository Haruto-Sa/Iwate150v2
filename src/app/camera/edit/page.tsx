"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { 
  Sticker, Undo2, Save, Type, Palette, 
  Move, Maximize2, ChevronDown, ChevronUp, X,
  Download, Share2, Image as ImageIcon
} from "lucide-react";
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
type SocialPlatform = "x" | "line" | "facebook" | "instagram";

const stickerPalette = ["🌊", "🌲", "✨", "🏔️", "🥢", "🚌", "🧭", "🍜", "🐟", "🦌", "🍎", "🌸"];
const fontOptions = [
  { label: "Noto Sans JP", value: "\"Noto Sans JP\", 'Helvetica Neue', sans-serif" },
  { label: "Shippori Mincho", value: "\"Shippori Mincho\", serif" },
  { label: "Kosugi Maru", value: "\"Kosugi Maru\", sans-serif" },
  { label: "Bebas Neue", value: "\"Bebas Neue\", 'Segoe UI', sans-serif" },
];

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
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ type: "sticker" | "text"; id: string; startX: number; startY: number; startSize: number } | null>(null);
  // 編集中の最新の合成画像（File）。タップ時に await を挟まず即 navigator.share に渡すため事前生成しておく
  const composedFileRef = useRef<File | null>(null);

  // Load captured photo + detection
  useEffect(() => {
    const stored = sessionStorage.getItem("capturedPhoto");
    if (stored) setPhoto(stored);
    const det = sessionStorage.getItem("capturedDetection");
    if (det) {
      try {
        setDetPos(JSON.parse(det));
      } catch {
        setDetPos(null);
      }
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
    setStickers(base);
  }, [detPos]);

  // Track stage size for scaling fonts
  useEffect(() => {
    const updateSize = () => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      setStageSize({ w: rect.width, h: rect.height });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const activeText = useMemo(
    () => activeItemType === "text" && activeItemId ? texts.find((t) => t.id === activeItemId) : null,
    [texts, activeItemId, activeItemType]
  );

  const activeSticker = useMemo(
    () => activeItemType === "sticker" && activeItemId ? stickers.find((s) => s.id === activeItemId) : null,
    [stickers, activeItemId, activeItemType]
  );

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

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / rect.width;
    const currentY = (e.clientY - rect.top) / rect.height;
    
    const { type, id, startX, startY, startSize } = draggingRef.current;

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

  const stopDrag = useCallback(() => {
    draggingRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointerup", stopDrag);
    return () => window.removeEventListener("pointerup", stopDrag);
  }, [stopDrag]);

  const addSticker = (char: string) => {
    const newId = `s-${Date.now()}`;
    setStickers((prev) => [
      ...prev,
      { id: newId, char, x: 0.5, y: 0.5, size: 0.08 },
    ]);
    setActiveItemId(newId);
    setActiveItemType("sticker");
    setActiveToolPanel(null);
  };

  const addText = () => {
    const newId = `t-${Date.now()}`;
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

  // 画像生成
  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!photo) return null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photo;
    await img.decode();

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

  // 編集内容が変わるたびに合成画像を事前生成して ref に保持する（iOS の共有失敗対策）。
  // これにより共有ハンドラはタップ時に await を挟まず即 navigator.share を呼べる。
  useEffect(() => {
    if (!photo) {
      composedFileRef.current = null;
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const blob = await generateImage();
      if (cancelled || !blob) return;
      composedFileRef.current = new File([blob], "iwate-memory.png", { type: "image/png" });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [photo, stickers, texts, generateImage]);

  const saveBlobAsFile = useCallback((blob: Blob, fileName = "iwate-memory.png") => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canShareFiles = canShare && typeof navigator.canShare === "function";

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
  const baseShareText = "岩手旅の思い出をシェア！ #岩手旅 #Iwate150 #VOJAIWATE";

  // 共有失敗時に握りつぶしてよいエラーか（ユーザーがキャンセルした等）
  const isIgnorableShareError = (err: unknown) => {
    const name = (err as Error)?.name;
    return name === "AbortError" || name === "InvalidStateError";
  };

  // 事前生成済み File を使い、await を挟まず即 navigator.share を呼ぶ（iOS の user activation 失効対策）。
  // 共有シートが開けたら true を返す。
  const shareFileImmediately = (text?: string): boolean => {
    const file = composedFileRef.current;
    if (!canShareFiles || !file || !navigator.canShare?.({ files: [file] })) {
      return false;
    }
    navigator
      .share({ files: [file], title: "岩手の思い出", ...(text ? { text } : {}) })
      .catch((err) => {
        if (!isIgnorableShareError(err)) console.error("Share failed:", err);
      });
    return true;
  };

  // Web Share API（汎用「共有...」ボタン）
  const handleShare = async () => {
    setShareMessage(null);
    if (shareFileImmediately(baseShareText)) {
      setShowSaveMenu(false);
      return;
    }
    // file共有非対応端末
    setShowSaveMenu(false);
    const blob = await generateImage();
    if (!blob) return;
    if (canShare) {
      try {
        await navigator.share({ title: "岩手の思い出", text: baseShareText });
      } catch (err) {
        if (!isIgnorableShareError(err)) console.error("Share failed:", err);
      }
    } else {
      saveBlobAsFile(blob);
      setShareMessage("共有API非対応のため、画像を保存しました。");
    }
  };

  // ファイルに保存（ダウンロード）。iOSでは保存先に「ファイルに保存」が選べる。
  const handleDownload = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setShareMessage(null);
    try {
      const blob = await generateImage();
      if (!blob) return;
      saveBlobAsFile(blob);
      setShareMessage("画像をファイルとして保存しました。");
    } finally {
      setIsSaving(false);
      setShowSaveMenu(false);
    }
  };

  // 写真（カメラロール）に保存。iOSは共有シートの「写真に保存」、非対応端末はダウンロードにフォールバック。
  const handleSaveToPhotos = async () => {
    setShareMessage(null);
    // 共有シート経由（iOSで「写真に保存」が出る）。await無しで即起動。
    if (shareFileImmediately()) {
      setShowSaveMenu(false);
      return;
    }
    setShowSaveMenu(false);
    const blob = await generateImage();
    if (!blob) return;
    saveBlobAsFile(blob);
    setShareMessage("写真共有に非対応のため、画像を保存しました。");
  };

  const openSocialIntent = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // SNSボタン: モバイルは写真添付の共有シートを即起動（→投稿画面に写真が乗る）。
  // PC等のfile共有非対応端末は、画像を保存して各SNSの投稿画面（テキスト/URL）を開く。
  const shareToSocial = async (platform: SocialPlatform) => {
    setShareMessage(null);

    // モバイル主経路: 写真添付の共有シートを即起動
    if (shareFileImmediately(baseShareText)) {
      setShareMessage("共有メニューから投稿先アプリを選ぶと、写真付きで投稿画面が開きます。");
      return;
    }

    // file共有非対応（PC等）: 画像を保存＋Web Intent
    if (isSaving) return;
    setIsSaving(true);
    try {
      const blob = await generateImage();
      if (!blob) return;
      saveBlobAsFile(blob);

      if (platform === "instagram") {
        setShareMessage("画像を保存しました。Instagramアプリで画像を選択して投稿してください。");
        return;
      }
      if (platform === "x") {
        openSocialIntent(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(baseShareText)}&url=${encodeURIComponent(shareUrl)}`
        );
      } else if (platform === "line") {
        openSocialIntent(
          `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`
        );
      } else if (platform === "facebook") {
        openSocialIntent(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(baseShareText)}`
        );
      }
      setShareMessage("画像を保存しました。開いた投稿画面で画像を添付して投稿してください。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-20">
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
        style={{ minHeight: 300 }}
      >
        <div className="relative flex aspect-[4/3] w-full items-center justify-center sm:aspect-[16/10]">
          {photo ? (
            <div className="relative h-full w-full">
              <img src={photo} alt="capture" className="h-full w-full object-cover" />
              
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
                    textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                  }}
                >
                  {t.text}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50">
              <p className="text-sm text-emerald-900/50">写真がありません</p>
            </div>
          )}
        </div>
      </div>

      {/* 保存ボタン（プレビュー直下） */}
      <div className="relative">
        <Button
          onClick={() => setShowSaveMenu(!showSaveMenu)}
          className="w-full justify-center gap-2 py-3"
          disabled={isSaving}
        >
          <Save className="h-5 w-5" />
          {isSaving ? "保存中..." : "保存する"}
          {showSaveMenu ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        
        {/* 保存メニュー */}
        {showSaveMenu && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-emerald-900/10 bg-white shadow-lg">
            {canShare && (
              <Button
                variant="ghost"
                onClick={handleSaveToPhotos}
                className="flex w-full items-center gap-3 !rounded-none px-4 py-3 text-left !text-emerald-900"
              >
                <ImageIcon className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-medium">写真に保存</div>
                  <div className="text-xs text-emerald-700/70">カメラロールに保存</div>
                </div>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleDownload}
              className="flex w-full items-center gap-3 !rounded-none px-4 py-3 text-left !text-emerald-900"
            >
              <Download className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="font-medium">ファイルに保存</div>
                <div className="text-xs text-emerald-700/70">ファイルアプリ／ダウンロードに保存</div>
              </div>
            </Button>
            {canShare && (
              <Button
                variant="ghost"
                onClick={handleShare}
                className="flex w-full items-center gap-3 !rounded-none px-4 py-3 text-left !text-emerald-900"
              >
                <Share2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-medium">共有...</div>
                  <div className="text-xs text-emerald-700/70">他のアプリで開く・SNSシェア</div>
                </div>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-emerald-900/10 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <Share2 className="h-4 w-4 text-emerald-700" />
          SNS連携
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => shareToSocial("x")}
            disabled={isSaving}
          >
            Xに投稿
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shareToSocial("line")}
            disabled={isSaving}
          >
            LINEで送信
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shareToSocial("facebook")}
            disabled={isSaving}
          >
            Facebook
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shareToSocial("instagram")}
            disabled={isSaving}
          >
            Instagram
          </Button>
        </div>
        <p className="mt-2 text-xs text-emerald-900/65">
          スマホでは共有メニューが開くので投稿先アプリを選ぶと、写真付きで投稿画面に進めます。PCでは画像を保存後に各SNSの投稿画面を開きます（画像は手動で添付）。
        </p>
        {shareMessage && (
          <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {shareMessage}
          </p>
        )}
      </div>

      {/* 編集モード切り替え */}
      <div className="flex items-center gap-2 rounded-xl border border-emerald-900/10 bg-white p-2 shadow-sm">
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
                placeholder="テキストを入力..."
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-emerald-700" />
                  <input
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
    </div>
  );
}
