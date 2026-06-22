import { redirect } from "next/navigation";
import { requireSuperAdmin, setFlagAction } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { allFlags } from "@/lib/platform/flags";

export default async function FlagsPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "platform.manage")) redirect("/superadmin");
  const flags = await allFlags();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Feature flags</h1>
        <p className="text-sm text-ink/45">Platform kill switches. Changes take effect within ~30 seconds.</p>
      </div>

      <div className="space-y-2">
        {flags.map((f) => (
          <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand-200 bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                {f.label}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.enabled ? "bg-olive-100 text-olive-700" : "bg-red-100 text-red-700"}`}>
                  {f.enabled ? "On" : "Off"}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-ink/55">{f.description}</p>
            </div>
            <form action={setFlagAction}>
              <input type="hidden" name="key" value={f.key} />
              <input type="hidden" name="enabled" value={(!f.enabled).toString()} />
              <button
                type="submit"
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${f.enabled ? "border border-red-200 text-red-600 hover:bg-red-50" : "bg-olive-600 text-white hover:bg-olive-700"}`}
              >
                {f.enabled ? "Turn off" : "Turn on"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
