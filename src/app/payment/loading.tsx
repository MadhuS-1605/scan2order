import { Skeleton } from "@/components/skeleton";

export default function PaymentLoading() {
  return (
    <div className="min-h-screen bg-grain">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-surface/95 px-4 py-3">
        <Skeleton className="h-5 w-40" />
      </header>
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    </div>
  );
}
