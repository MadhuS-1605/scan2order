import { Skeleton, SkeletonList } from "@/components/skeleton";

// Shown for any admin page while it streams in (covers all /admin/* children).
export default function AdminLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <SkeletonList rows={4} />
    </div>
  );
}
