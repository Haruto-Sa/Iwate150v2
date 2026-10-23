import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type Props = {
  title?: string;
  icon?: LucideIcon;
  badge?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * 情報をまとめる紙色のカード。既存のGlassCard APIを維持する。
 * @param props - 見出し、アイコン、補足、内容と追加スタイル
 * @returns 情報セクション
 * @example <GlassCard title="旅の予定">予定一覧</GlassCard>
 */
export function GlassCard({
  title,
  icon: Icon,
  badge,
  actions,
  className = "",
  children,
}: Props) {
  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-2xl border border-app-line/15 bg-app-surface p-5 text-app-ink-strong sm:p-6 ${className}`}
    >
      {(title || Icon || badge || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-app-surface-soft text-app-accent-ink">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
            )}
            <div>
              {badge && (
                <span className="inline-flex items-center rounded-full bg-app-surface-soft px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-app-ink ring-1 ring-app-line-soft/60">
                  {badge}
                </span>
              )}
              {title && (
                <h2 className="text-balance font-display text-xl leading-relaxed text-app-ink-strong sm:text-2xl">
                  {title}
                </h2>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div
        className={`${title || Icon || badge || actions ? "mt-4" : ""} text-sm leading-7 text-app-ink/85`}
      >
        {children}
      </div>
    </section>
  );
}
