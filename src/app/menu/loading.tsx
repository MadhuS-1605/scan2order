import { Skeleton, SkeletonList } from "@/components/skeleton";

export default function MenuLoading() {
  return (
    <div className="min-h-screen bg-grain pb-36">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-surface px-4 py-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-24" />
      </header>
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <SkeletonList rows={6} />
      </div>
    </div>
  );
}
