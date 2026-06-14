import { Skeleton } from "@/components/skeleton";

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-grain pb-36">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-surface/95 px-4 py-3">
        <Skeleton className="h-5 w-40" />
      </header>
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    </div>
  );
}
