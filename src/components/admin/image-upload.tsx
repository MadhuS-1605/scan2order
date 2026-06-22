"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui";

// Image field: paste a URL OR upload a file (to the tenant's R2 folder). The
// resolved URL is kept in a same-named input so server actions are unchanged.
export function ImageUpload({
  name,
  defaultValue,
  kind = "misc",
  placeholder = "https://… or upload",
}: {
  name: string;
  defaultValue?: string | null;
  kind?: "menu" | "logo" | "misc";
  placeholder?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = `upload-${name}`;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) setError(data.error ?? "Upload failed.");
      else setUrl(data.url);
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Input
        type="url"
        name={name}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={placeholder}
      />
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPick}
          className="hidden"
        />
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-md border border-sand-300 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-sand-100"
        >
          {busy ? "Uploading…" : "Upload image"}
        </label>
        {url && (
          <span
            className="h-9 w-9 rounded border border-sand-200 bg-sand-100 bg-cover bg-center"
            style={{ backgroundImage: `url("${url}")` }}
            aria-hidden
          />
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
