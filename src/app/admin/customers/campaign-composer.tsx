"use client";

import { useActionState } from "react";
import { sendCampaignAction } from "@/lib/campaigns/actions";
import { Button, Textarea, Select, Field, Alert } from "@/components/ui";
import { useT } from "@/components/admin/i18n-provider";
import type { ActionState } from "@/lib/validation";

export function CampaignComposer({
  counts,
}: {
  counts: { all: number; repeat: number; recent: number };
}) {
  const tr = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(sendCampaignAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
      <Field label={tr("campaign.audience")} htmlFor="segment">
        <Select id="segment" name="segment" defaultValue="all">
          <option value="all">{tr("campaign.segAll")} ({counts.all})</option>
          <option value="repeat">{tr("campaign.segRepeat")} ({counts.repeat})</option>
          <option value="recent">{tr("campaign.segRecent")} ({counts.recent})</option>
        </Select>
      </Field>
      <Field label={tr("campaign.message")} htmlFor="message" hint={tr("campaign.messageHint")}>
        <Textarea
          id="message"
          name="message"
          rows={4}
          maxLength={600}
          placeholder="Hi! This weekend enjoy 20% off all desserts 🍰"
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? tr("campaign.sending") : tr("campaign.send")}
      </Button>
    </form>
  );
}
