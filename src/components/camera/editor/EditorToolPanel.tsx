import type { Dispatch, SetStateAction } from "react";
import { Sticker, Undo2, Type, Palette, Move, Maximize2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { EditMode, StickerItem, TextItem, ToolPanel } from "./types";

type Props = {
  editMode: EditMode;
  setEditMode: Dispatch<SetStateAction<EditMode>>;
  activeItemId: string | null;
  deleteActiveItem: () => void;
  resetOverlays: () => void;
  activeToolPanel: ToolPanel;
  setActiveToolPanel: Dispatch<SetStateAction<ToolPanel>>;
  addSticker: (char: string) => void;
  addText: () => void;
  activeText: TextItem | null | undefined;
  activeSticker: StickerItem | null | undefined;
  setTexts: Dispatch<SetStateAction<TextItem[]>>;
  fontOptions: { label: string; value: string }[];
};

const stickerPalette = ["🌊", "🌲", "✨", "🏔️", "🥢", "🚌", "🧭", "🍜", "🐟", "🦌", "🍎", "🌸"];

/**
 * 写真の装飾を編集する操作ボタンとスタンプ・文字のパネルを表示する。
 * @param props - ページが保持する選択状態、装飾と更新操作
 * @returns 移動・サイズ変更・削除・追加・文字設定の操作欄
 * @example <EditorToolPanel {...editorControls} />
 */
export function EditorToolPanel({ editMode, setEditMode, activeItemId, deleteActiveItem, resetOverlays, activeToolPanel, setActiveToolPanel, addSticker, addText, activeText, activeSticker, setTexts, fontOptions }: Props) {
  return (<>
      {/* 編集モード切り替え */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-line/10 bg-app-surface p-2">
        <Button
          variant={editMode === "move" ? "primary" : "ghost"}
          aria-pressed={editMode === "move"}
          size="sm"
          onClick={() => setEditMode("move")}
          className="shrink-0 gap-1.5"
        >
          <Move className="h-3.5 w-3.5" />
          移動
        </Button>
        <Button
          variant={editMode === "resize" ? "primary" : "ghost"}
          aria-pressed={editMode === "resize"}
          size="sm"
          onClick={() => setEditMode("resize")}
          className="shrink-0 gap-1.5"
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
            className="gap-1.5 !text-app-danger hover:!bg-app-danger-surface"
          >
            <X className="h-3.5 w-3.5" />
            削除
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={resetOverlays}
          className="shrink-0 gap-1.5"
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
          aria-expanded={activeToolPanel === "sticker"}
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
          aria-expanded={activeToolPanel === "text"}
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
        <div className="rounded-xl border border-app-line/10 bg-app-surface p-3 shadow-sm">
          <div className="grid grid-cols-6 gap-2">
            {stickerPalette.map((s) => (
              <button
                key={s}
                onClick={() => addSticker(s)}
                className="flex aspect-square items-center justify-center rounded-lg border border-app-line/10 bg-app-surface text-xl transition hover:border-app-line-soft hover:bg-app-surface-soft active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 展開パネル：テキスト */}
      {activeToolPanel === "text" && (
        <div className="space-y-3 rounded-xl border border-app-line/10 bg-app-surface p-3 shadow-sm">
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
            <div className="space-y-2 border-t border-app-line-soft pt-3">
              <input
                className="w-full rounded-lg border border-app-line/15 bg-app-surface px-3 py-2 text-sm text-app-ink outline-none ring-app-line-soft focus:ring-2"
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
                  <Palette className="h-4 w-4 text-app-accent-ink" />
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
                    className="h-8 w-8 cursor-pointer rounded border border-app-line-soft"
                  />
                </div>
                <select
                  className="flex-1 rounded-lg border border-app-line/15 bg-app-surface px-2 py-1.5 text-xs text-app-ink"
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
            <div className="border-t border-app-line-soft pt-3">
              <p className="text-xs text-app-accent-ink">
                選択中のスタンプ: {activeSticker.char}
              </p>
            </div>
          )}
        </div>
      )}
  </>);
}
