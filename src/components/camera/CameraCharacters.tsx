import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { characters } from "@/lib/characters";

type Props = {
  ready: boolean;
  videoBusy: boolean;
  selectedModels: string[];
  canCapture: boolean;
  selectedModelErrors: string[];
  faceError: boolean;
  selectedModelsLoading: boolean;
  faceHasResult: boolean;
  hasDetection: boolean;
  onRetry: () => void;
  onClear: () => void;
  onToggle: (id: string, active: boolean) => void;
};

/**
 * キャラクターIDから表示名を解決する。
 *
 * @param id - キャラクターID
 * @returns 表示名
 * @example
 * const name = getCharacterNameById("goshodon");
 */
function getCharacterNameById(id: string): string {
  return characters.find((character) => character.id === id)?.name ?? id;
}

/**
 * キャラクターの準備状況と選択ボタンを表示する。
 * @param props - 親が管理するモデル状態と選択・再試行操作
 * @returns 準備状況とキャラクター選択欄
 * @example <CameraCharacters {...characterProps} />
 */
export function CameraCharacters({ ready, videoBusy, selectedModels, canCapture, selectedModelErrors, faceError, selectedModelsLoading, faceHasResult, hasDetection, onRetry, onClear, onToggle }: Props) {
  return (
    <>
      {ready && !videoBusy && selectedModels.length > 0 && !canCapture && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-app-line/10 bg-app-surface p-3">
          <p role={selectedModelErrors.length > 0 || faceError ? "alert" : "status"} className="mr-auto text-sm text-app-accent-ink">
            {selectedModelErrors.length > 0
              ? `${selectedModelErrors.map(getCharacterNameById).join("・")}を読み込めませんでした`
              : faceError ? "顔検出を開始できませんでした"
              : selectedModelsLoading || !faceHasResult
                ? "キャラクターを準備中…"
                : !hasDetection ? "顔をカメラに向ける" : "少し離れる"}
          </p>
          {(selectedModelErrors.length > 0 || faceError) && (
            <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>読み込み直す</Button>
          )}
          <Button variant="outline" size="sm" className="min-h-11" onClick={onClear}>
            キャラクターを外す
          </Button>
        </div>
      )}

      <div className="glass flex items-center gap-2 overflow-x-auto rounded-2xl border border-app-line/10 p-3 ring-1 ring-app-line/10 sm:flex-wrap">
        {characters.map((c) => {
          const active = selectedModels.includes(c.id);
          const isDisabled = !active && selectedModels.length >= 5;
          return (
            <Button
              key={c.id}
              variant={active ? "primary" : "ghost"}
              size="sm"
              onClick={() => onToggle(c.id, active)}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
              disabled={isDisabled || videoBusy}
              aria-pressed={active}
              className="min-h-11 shrink-0 gap-2 whitespace-nowrap"
            >
              {active ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {c.name}
            </Button>
          );
        })}
        <span className="shrink-0 text-xs text-app-ink-muted">最大5体</span>
      </div>

    </>
  );
}
