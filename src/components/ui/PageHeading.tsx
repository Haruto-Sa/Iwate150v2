import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/**
 * 旅の各画面に共通する見出しと補助導線。
 * @param props - 分類、主見出し、説明、操作
 * @returns ページの見出し
 * @example <PageHeading eyebrow="EXPLORE" title="岩手を探す" />
 */
export function PageHeading({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-emerald-900/15 pb-6 sm:pb-8">
      <div className="max-w-2xl">
        <p className="mb-3 flex items-center gap-2 text-[11px] font-medium tracking-[.2em] text-emerald-700">
          <span aria-hidden="true" className="h-1.5 w-1.5 bg-[#a14432]" />
          {eyebrow}
        </p>
        <h1 className="text-balance font-display text-[1.65rem] leading-relaxed tracking-wide text-emerald-950 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm leading-7 text-emerald-900/80">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
