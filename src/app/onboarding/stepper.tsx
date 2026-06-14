import { cn } from "@/lib/utils";

const LABELS = ["Profile", "Menu", "Settings", "Tables"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center">
      {LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  done && "bg-brand-600 text-white",
                  active && "border-2 border-brand-600 text-brand-700",
                  !done && !active && "bg-sand-200 text-ink/55",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:block",
                  active ? "font-semibold text-ink" : "text-ink/55",
                )}
              >
                {label}
              </span>
            </div>
            {i < LABELS.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-0.5 flex-1",
                  i < current ? "bg-brand-600" : "bg-sand-200",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
