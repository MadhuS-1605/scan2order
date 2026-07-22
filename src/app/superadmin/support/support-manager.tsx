"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createSupportTicketAction,
  resolveSupportTicketAction,
  reopenSupportTicketAction,
  deleteSupportTicketAction,
} from "@/lib/platform/support";
import { Button, Input, Textarea, Select, Field, Alert, Card } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

type Ticket = {
  id: string;
  restaurantId: string | null;
  restaurantName: string | null;
  subject: string;
  description: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

export function SupportManager({
  tickets,
  restaurants,
}: {
  tickets: Ticket[];
  restaurants: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <AddTicketForm restaurants={restaurants} />

      <Card className="p-0">
        <ul className="divide-y divide-sand-100">
          {tickets.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink/45">Nothing logged.</li>
          ) : (
            tickets.map((t) => (
              <li key={t.id} className={`flex flex-wrap items-start justify-between gap-3 p-4 ${t.status === "RESOLVED" ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {t.subject}
                    {t.status === "RESOLVED" && (
                      <span className="ml-2 rounded-full bg-olive-100 px-2 py-0.5 text-[10px] font-medium text-olive-700">Resolved</span>
                    )}
                  </p>
                  {t.description && <p className="mt-1 text-xs text-ink/55">{t.description}</p>}
                  <p className="mt-1 text-xs text-ink/40">
                    {t.restaurantName ?? "General"} · logged {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  {t.status === "OPEN" ? (
                    <form action={resolveSupportTicketAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <Button size="sm" variant="secondary" type="submit">Resolve</Button>
                    </form>
                  ) : (
                    <form action={reopenSupportTicketAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <Button size="sm" variant="ghost" type="submit">Reopen</Button>
                    </form>
                  )}
                  <form action={deleteSupportTicketAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button size="sm" variant="ghost" type="submit">Delete</Button>
                  </form>
                </div>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}

function AddTicketForm({ restaurants }: { restaurants: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSupportTicketAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <h2 className="mb-4 font-semibold text-ink">Log an issue</h2>
      <form ref={ref} action={action} className="space-y-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
        <Field label="Subject" htmlFor="st-subject">
          <Input id="st-subject" name="subject" placeholder="Can't upload menu photos" required />
        </Field>
        <Field label="Restaurant" htmlFor="st-restaurant" hint="Optional — leave blank for a general/platform issue">
          <Select id="st-restaurant" name="restaurantId" defaultValue="">
            <option value="">General / Platform</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Details" htmlFor="st-desc" hint="Optional">
          <Textarea id="st-desc" name="description" rows={3} />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Logging…" : "Log issue"}
        </Button>
      </form>
    </Card>
  );
}
