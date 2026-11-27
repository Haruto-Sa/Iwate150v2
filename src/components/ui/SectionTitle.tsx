import { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  icon?: LucideIcon;
};

/**
 * セクションの見出しを表示する。
 * @param props - 見出し、任意のアイコン
 * @returns h2を含む見出し
 * @example <SectionTitle label="旅先のヒント" />
 */
export function SectionTitle({ label, icon: Icon }: Props) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-app-surface-tint text-app-ink ring-1 ring-app-line-soft/60">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      )}
      <div>
        <h2 className="font-display text-2xl leading-relaxed text-app-ink-strong">{label}</h2>
      </div>
    </div>
  );
}
