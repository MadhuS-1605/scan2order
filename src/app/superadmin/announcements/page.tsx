import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  requireSuperAdmin,
  createAnnouncementAction,
  toggleAnnouncementAction,
  deleteAnnouncementAction,
} from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";

export default async function AnnouncementsPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "platform.manage")) redirect("/superadmin");
  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Announcements</h1>
        <p className="text-sm text-ink/45">Active announcements show as a banner in every tenant&apos;s admin.</p>
      </div>

      {/* Create */}
      <form action={createAnnouncementAction} className="space-y-3 rounded-2xl border border-sand-200 bg-surface p-5">
        <div className="flex flex-wrap gap-3">
          <input name="title" required placeholder="Title (e.g. Scheduled maintenance Sunday 2am)" className="flex-1 min-w-[220px] rounded-md border border-sand-300 bg-surface px-3 py-2 text-sm" />
          <select name="level" defaultValue="INFO" className="rounded-md border border-sand-300 bg-surface px-2 py-2 text-sm">
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
          </select>
        </div>
        <textarea name="body" rows={2} placeholder="Optional detail…" className="w-full rounded-md border border-sand-300 bg-surface px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Post announcement</button>
      </form>

      {/* List */}
      <div className="space-y-2">
        {announcements.length === 0 ? (
          <p className="text-sm text-ink/45">No announcements yet.</p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 ${a.active ? (a.level === "WARNING" ? "border-amber-300 bg-amber-50" : "border-brand-200 bg-brand-50") : "border-sand-200 bg-surface opacity-70"}`}>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  {a.title}
                  <span className={`rounded px-1.5 py-0.5 text-xs ${a.level === "WARNING" ? "bg-amber-200 text-amber-800" : "bg-brand-100 text-brand-700"}`}>{a.level}</span>
                  {!a.active && <span className="rounded bg-sand-200 px-1.5 py-0.5 text-xs text-ink/55">Inactive</span>}
                </p>
                {a.body && <p className="mt-0.5 text-sm text-ink/60">{a.body}</p>}
                <p className="mt-0.5 text-xs text-ink/40">
                  {a.createdByName ?? "—"} · {a.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={toggleAnnouncementAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="active" value={(!a.active).toString()} />
                  <button type="submit" className="rounded-md border border-sand-300 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-sand-100">
                    {a.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <form action={deleteAnnouncementAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
