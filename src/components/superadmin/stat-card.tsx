import type { LucideIcon } from "lucide-react";

// Shared metric tile for the superadmin console pages. `icon` is optional —
// omit it for a plain metric (larger value text, no icon slot).
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: LucideIcon;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-surface p-4 ${alert ? "border-amber-300" : "border-sand-200"}`}>
      {Icon && (
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            alert ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-600"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      )}
      <p className={`${Icon ? "mt-3 text-xs" : "text-xs"} font-medium uppercase tracking-wide text-ink/45`}>
        {label}
      </p>
      <p className={`${Icon ? "mt-0.5 text-xl" : "mt-1 text-2xl"} font-semibold text-ink`}>{value}</p>
      <p className="text-xs text-ink/40">{sub}</p>
    </div>
  );
}
