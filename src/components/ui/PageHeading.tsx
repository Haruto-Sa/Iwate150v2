import type { ReactNode } from "react";

type Props = {
  title: string;
  actions?: ReactNode;
};

/**
 * 旅の各画面に共通する見出しと補助導線。
 * @param props - 主見出し、操作
 * @returns ページの見出し
 * @example <PageHeading title="検索" />
 */
export function PageHeading({ title, actions }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-900/15 pb-4">
      <div className="min-w-0">
        <h1 className="text-balance font-display text-[1.65rem] leading-relaxed tracking-wide text-emerald-950 sm:text-4xl">
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
