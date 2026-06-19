"use client";

// Small shared controls for the diner ordering funnel, reused across the menu,
// cart and checkout screens.

export function Stepper({
  qty,
  onChange,
}: {
  qty: number;
  onChange: (q: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-sand-300">
      <button
        type="button"
        className="px-2.5 py-1 text-ink/70"
        onClick={() => onChange(qty - 1)}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-5 text-center text-sm font-medium" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="px-2.5 py-1 text-ink/70"
        onClick={() => onChange(qty + 1)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function MethodButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-sand-300 text-ink/70"
      }`}
    >
      {label}
    </button>
  );
}
