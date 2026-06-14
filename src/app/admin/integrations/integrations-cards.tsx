"use client";

import { useState, useTransition } from "react";
import { Plug, Check, Zap, Loader2 } from "lucide-react";
import {
  connectIntegrationAction,
  disconnectIntegrationAction,
  testWebhookAction,
} from "@/lib/integrations/actions";
import { Button, Input, Field } from "@/components/ui";
import type { IntegrationProvider } from "@/lib/integrations/catalog";

export function ProviderCard({
  provider,
  connected,
  config,
}: {
  provider: IntegrationProvider;
  connected: boolean;
  config: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [testing, startTest] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  function runTest() {
    setTestMsg(null);
    startTest(async () => {
      const r = await testWebhookAction();
      setTestMsg(
        r.ok
          ? `✓ Delivered (HTTP ${r.status})`
          : `✗ ${r.error ?? `HTTP ${r.status}`}`,
      );
    });
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium text-ink">
            {provider.name}
            {provider.live && (
              <span className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                <Zap className="h-2.5 w-2.5" /> Live
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink/55">{provider.blurb}</p>
        </div>
        {connected ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-olive-500/15 px-2 py-0.5 text-xs font-medium text-olive-700">
            <Check className="h-3 w-3" /> Connected
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-sand-100 px-2 py-0.5 text-xs text-ink/45">
            Not connected
          </span>
        )}
      </div>

      {!open && (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plug className="h-3.5 w-3.5" />
            {connected ? "Edit" : "Connect"}
          </Button>
          {connected && provider.live && (
            <Button variant="ghost" size="sm" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send test"}
            </Button>
          )}
          {connected && (
            <form action={disconnectIntegrationAction}>
              <input type="hidden" name="provider" value={provider.slug} />
              <button type="submit" className="text-xs text-ink/45 hover:text-red-600">
                Disconnect
              </button>
            </form>
          )}
          {testMsg && <span className="text-xs text-ink/60">{testMsg}</span>}
        </div>
      )}

      {open && (
        <form action={connectIntegrationAction} className="mt-3 space-y-2">
          <input type="hidden" name="provider" value={provider.slug} />
          {provider.fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`${provider.slug}-${f.key}`}>
              <Input
                id={`${provider.slug}-${f.key}`}
                name={`field_${f.key}`}
                type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"}
                placeholder={f.placeholder}
                defaultValue={config[f.key] ?? ""}
              />
            </Field>
          ))}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Save &amp; connect
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
