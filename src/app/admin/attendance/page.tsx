import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatDuration } from "@/lib/utils";
import { LiveStream } from "@/components/live-stream";
import { Card } from "@/components/ui";
import { Clock } from "lucide-react";
import { setClockOutAction } from "@/lib/attendance/actions";
import { MarkAttendanceForm } from "./mark-form";

export default async function AttendancePage() {
  const { restaurant } = await getCurrentRestaurant("attendance");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [staff, punches] = await Promise.all([
    prisma.adminUser.findMany({
      where: { restaurantId: restaurant.id, disabled: false },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true },
    }),
    prisma.staffAttendance.findMany({
      where: { restaurantId: restaurant.id, clockInAt: { gte: startOfToday } },
      orderBy: { clockInAt: "desc" },
      include: { adminUser: { select: { name: true, role: true } } },
    }),
  ]);

  const onShift = punches.filter((p) => !p.clockOutAt);
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <LiveStream />
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "attendance.title")}</h1>
        <p className="text-sm text-ink/45">
          {t(d, "attendance.subtitle")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <MarkAttendanceForm staff={staff} />

        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 font-semibold text-ink">
              {`${t(d, "attendance.onShiftNow")} (${onShift.length})`}
            </h2>
            {onShift.length === 0 ? (
              <p className="text-sm text-ink/45">{t(d, "attendance.noOneClockedIn")}</p>
            ) : (
              <ul className="space-y-2">
                {onShift.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-olive-200 bg-olive-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Clock className="h-4 w-4 text-olive-600" />
                      {p.adminUser.name}
                      <span className="text-xs font-normal text-ink/45">
                        {t(d, "attendance.inAt")} {timeFmt(p.clockInAt)} ·{" "}
                        {formatDuration((now.getTime() - p.clockInAt.getTime()) / 60_000)}
                      </span>
                    </span>
                    <form action={setClockOutAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-sand-300 bg-surface px-3 py-1 text-xs font-medium text-ink/70 hover:border-brand-300 hover:bg-sand-100"
                      >
                        {t(d, "attendance.clockOut")}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-ink">{t(d, "attendance.todaysShifts")}</h2>
            {punches.length === 0 ? (
              <p className="text-sm text-ink/45">{t(d, "attendance.noAttendanceToday")}</p>
            ) : (
              <ul className="divide-y divide-sand-100">
                {punches.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {p.adminUser.name}
                        <span className="ml-2 rounded bg-sand-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink/45">
                          {p.source === "MANAGER" ? t(d, "attendance.marked") : t(d, "attendance.self")}
                        </span>
                      </p>
                      <p className="text-xs text-ink/50">
                        {timeFmt(p.clockInAt)} —{" "}
                        {p.clockOutAt ? timeFmt(p.clockOutAt) : t(d, "attendance.onShift")}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-ink/70">
                      {formatDuration(
                        ((p.clockOutAt ?? now).getTime() - p.clockInAt.getTime()) /
                          60_000,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
