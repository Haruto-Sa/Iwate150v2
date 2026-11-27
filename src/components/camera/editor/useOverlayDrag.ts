import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { EditMode, StickerItem, TextItem } from "./types";

type Options = {
  stageRef: RefObject<HTMLDivElement | null>;
  stickers: StickerItem[];
  texts: TextItem[];
  editMode: EditMode;
  setStickers: Dispatch<SetStateAction<StickerItem[]>>;
  setTexts: Dispatch<SetStateAction<TextItem[]>>;
  setActiveItemId: Dispatch<SetStateAction<string | null>>;
  setActiveItemType: Dispatch<SetStateAction<"sticker" | "text" | null>>;
};

/**
 * 写真上の装飾の移動・拡大縮小とpointerup時の終了を管理する。
 * @param options - 表示領域、装飾、操作モードと画面側の更新関数
 * @returns 対象選択とポインター移動のハンドラー
 * @example const drag = useOverlayDrag({ stageRef, stickers, texts, editMode, setStickers, setTexts, setActiveItemId, setActiveItemType });
 */
export function useOverlayDrag(options: Options) {
  const { stageRef, stickers, texts, editMode, setStickers, setTexts, setActiveItemId, setActiveItemType } = options;
  const draggingRef = useRef<{ type: "sticker" | "text"; id: string; startX: number; startY: number; startSize: number } | null>(null);

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
  }, [stickers, texts, stageRef, setActiveItemId, setActiveItemType]);

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
  }, [editMode, stageRef, setStickers, setTexts]);

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

  return { handlePointerDown, handlePointerMove };
}
