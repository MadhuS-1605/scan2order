import { ChevronDown, Check, IndianRupee } from "lucide-react";
import type { PlanDetails } from "@/lib/plans";

// "Show more" disclosure for a pricing card: reveals the full plan explanation
// and the usage-based costs that can apply. Shared by the marketing landing
// page and the in-app billing screen so the copy stays in one place.
export function PlanDetailsDisclosure({ details }: { details: PlanDetails }) {
  return (
    <details className="group mt-4 border-t border-sand-200 pt-3">
      <summary className="flex w-full cursor-pointer list-none items-center justify-between text-sm font-medium text-brand-700 hover:text-brand-800 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show more</span>
        <span className="hidden group-open:inline">Show less</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 space-y-4 text-sm">
        <p className="leading-relaxed text-ink/65">{details.blurb}</p>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">
            What&apos;s included
          </p>
          <ul className="space-y-1.5">
            {details.included.map((line) => (
              <li key={line} className="flex items-start gap-2 text-ink/70">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/45">
            Usage &amp; extra costs
          </p>
          <ul className="space-y-1.5">
            {details.usageCosts.map((line) => (
              <li key={line} className="flex items-start gap-2 text-ink/60">
                <IndianRupee className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/35" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
