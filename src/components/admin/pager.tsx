import Link from "next/link";

// Simple offset pager (prev/next). `basePath` is the page route; it links with
// ?page=N. Renders nothing when there's only one page.
export function Pager({
  basePath,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const cls =
    "rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100";
  const disabled = "rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-ink/30";

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink/45">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={`${basePath}?page=${page - 1}`} className={cls}>
            ← Prev
          </Link>
        ) : (
          <span className={disabled}>← Prev</span>
        )}
        {page < pages ? (
          <Link href={`${basePath}?page=${page + 1}`} className={cls}>
            Next →
          </Link>
        ) : (
          <span className={disabled}>Next →</span>
        )}
      </div>
    </div>
  );
}
