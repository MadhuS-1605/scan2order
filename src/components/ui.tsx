import { cn } from "@/lib/utils";

// This is the UI kit for the product itself (admin/kitchen/billing/superadmin
// — every dense, functional screen). src/components/ui/* (shadcn) is scoped
// to the marketing site, where its compound primitives (Card/Badge/etc. with
// Radix-grade accessibility) earn their keep. Deliberately not merging the
// two: migrating the whole product surface for its own sake isn't worth the
// risk against a kit that's already themed, proven, and used everywhere.

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary:
      "bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 active:translate-y-px disabled:bg-brand-300 disabled:shadow-none",
    secondary:
      "border border-sand-300 bg-surface text-ink hover:border-brand-300 hover:bg-sand-100",
    ghost: "text-ink/70 hover:bg-sand-100 hover:text-ink",
    danger: "bg-red-700 text-white hover:bg-red-800 active:translate-y-px",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-2.5 text-[0.95rem]",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/60 disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

const fieldBase =
  "w-full rounded-lg border border-sand-300 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/50";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "pr-8", className)} {...props} />;
}

function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/55",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink/45">{hint}</p>}
    </div>
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-sand-200 bg-surface p-6 shadow-[0_1px_2px_rgba(93,58,24,0.04),0_10px_28px_-18px_rgba(93,58,24,0.16)]",
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  children,
  variant = "error",
}: {
  children: React.ReactNode;
  variant?: "error" | "success" | "info";
}) {
  const styles = {
    error: "bg-red-50 text-red-800 border-red-200",
    success: "bg-olive-500/10 text-olive-600 border-olive-500/30",
    info: "bg-brand-50 text-brand-800 border-brand-200",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", styles[variant])}>
      {children}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  PLACED: "bg-sand-200 text-ink/70",
  CONFIRMED: "bg-brand-50 text-brand-700",
  PREPARING: "bg-brand-100 text-brand-800",
  READY: "bg-olive-500/15 text-olive-600",
  SERVED: "bg-olive-700/15 text-olive-700",
  COMPLETED: "bg-sand-200 text-ink/55",
  CANCELLED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        badgeStyles[status] ?? "bg-sand-200 text-ink/70",
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// Veg / non-veg marker — a real Indian-menu convention, kept intentionally.
export function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border",
        isVeg ? "border-olive-600" : "border-red-700",
      )}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span
        className={cn(
          "block h-1.5 w-1.5 rounded-full",
          isVeg ? "bg-olive-600" : "bg-red-700",
        )}
      />
    </span>
  );
}
