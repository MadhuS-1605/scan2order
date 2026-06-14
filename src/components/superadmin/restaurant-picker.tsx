"use client";

import { useRouter } from "next/navigation";

// Dropdown that switches which restaurant the super-admin analytics view is
// scoped to. Navigates on change, preserving the current range query param.
export function RestaurantPicker({
  restaurants,
  currentId,
  range,
}: {
  restaurants: { id: string; name: string }[];
  currentId: string;
  range: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink/55">Restaurant</span>
      <select
        value={currentId}
        onChange={(e) =>
          router.push(`/superadmin/analytics?restaurant=${e.target.value}&range=${range}`)
        }
        className="max-w-[60vw] rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm font-medium text-ink"
      >
        {restaurants.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}
