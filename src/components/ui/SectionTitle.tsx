import { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  description?: string;
  icon?: LucideIcon;
};

export function SectionTitle({ label, description, icon: Icon }: Props) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/60">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      )}
      <div>
        <p className="font-display text-xl text-emerald-950">{label}</p>
        {description && <p className="text-sm text-emerald-900/70">{description}</p>}
      </div>
    </div>
  );
}
