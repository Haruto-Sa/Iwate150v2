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

export function GlassCard({ title, icon: Icon, badge, actions, className = "", children }: Props) {
  return (
    <section
      className={`glass relative overflow-hidden rounded-2xl bg-white/90 p-4 text-[#0f1c1a] shadow-xl ring-1 ring-emerald-900/8 sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-[#0f3a3a] ring-1 ring-emerald-200/70">
              <Icon className="h-5 w-5" strokeWidth={1.8} />
            </span>
          )}
          <div>
            {badge && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/60">
                {badge}
              </span>
            )}
            {title && (
              <h2 className="font-display text-xl text-[#0f1c1a] sm:text-2xl">{title}</h2>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="mt-4 text-sm text-emerald-900/85">{children}</div>
    </section>
  );
}
