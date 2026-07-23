"use client";

import { useRef, useState } from "react";
import { saveFloorLayoutAction } from "@/lib/tables/layout-actions";
import { Button } from "@/components/ui";

type Table = { id: string; label: string; kind: string; posX: number | null; posY: number | null };

// Spreads unplaced tables in a simple grid so nothing starts stacked at 0,0.
function fallbackPosition(index: number): { x: number; y: number } {
  const cols = 5;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: 10 + col * 20, y: 15 + row * 20 };
}

export function FloorLayoutEditor({ tables }: { tables: Table[] }) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(
      tables.map((t, i) => [
        t.id,
        t.posX !== null && t.posY !== null ? { x: t.posX, y: t.posY } : fallbackPosition(i),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);

  function moveTo(id: string, clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setPositions((prev) => ({ ...prev, [id]: { x, y } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await saveFloorLayoutAction(Object.entries(positions).map(([id, p]) => ({ id, ...p })));
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/55">Drag tables to match your venue&apos;s real layout.</p>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save layout"}
        </Button>
      </div>
      <div
        ref={canvasRef}
        className="relative aspect-[4/3] w-full touch-none rounded-2xl border border-sand-200 bg-sand-100/40"
      >
        {tables.map((t) => {
          const pos = positions[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onPointerDown={(e) => {
                draggingId.current = t.id;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (draggingId.current === t.id) moveTo(t.id, e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                draggingId.current = null;
              }}
              className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-lg border border-brand-300 bg-surface text-xs font-medium text-ink shadow-sm active:cursor-grabbing"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
