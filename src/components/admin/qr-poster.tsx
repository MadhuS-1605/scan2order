"use client";

import { useEffect, useRef } from "react";

// Composites the raw QR PNG with restaurant name / table label / footer onto
// one canvas, so what's on screen and what gets downloaded are pixel-identical
// (a plain <img download> of the raw QR would lose the surrounding text).
const CANVAS_W = 480;
const CANVAS_H = 600;
const QR_SIZE = 300;
// Draw at 2x the display size so exported/printed stickers stay crisp
// (a 1:1 canvas downscaled for on-screen display looks soft once zoomed,
// printed, or viewed on a low-DPI export).
const RENDER_SCALE = 2;

export function QrPoster({
  qr,
  restaurantName,
  tableLabel,
  downloadFileName,
  downloadLabel,
  className,
}: {
  qr: string;
  restaurantName: string;
  tableLabel?: string;
  downloadFileName: string;
  downloadLabel: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      // Match the app's own fonts (Fraunces display serif / Geist sans body)
      // by reading the resolved font-family off real elements — next/font
      // generates hashed family names, so there's nothing to hardcode.
      const probe = document.createElement("span");
      probe.className = "font-display";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const headingFont = getComputedStyle(probe).fontFamily;
      probe.remove();
      const bodyFont = getComputedStyle(document.body).fontFamily;

      await document.fonts.ready;
      if (cancelled) return;

      const qrImg = new window.Image();
      qrImg.onload = () => {
        if (cancelled) return;
        canvas.width = CANVAS_W * RENDER_SCALE;
        canvas.height = CANVAS_H * RENDER_SCALE;
        ctx.scale(RENDER_SCALE, RENDER_SCALE);
        ctx.textAlign = "center";

        // Rounded "sticker" card with a hairline border.
        const r = 28;
        ctx.beginPath();
        ctx.roundRect(1, 1, CANVAS_W - 2, CANVAS_H - 2, r);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#dbc9a9"; // sand-300
        ctx.stroke();

        ctx.fillStyle = "#221e18"; // ink
        ctx.font = `600 34px ${headingFont}`;
        ctx.fillText(restaurantName, CANVAS_W / 2, 60, CANVAS_W - 48);

        if (tableLabel) {
          ctx.fillStyle = "#57534e";
          ctx.font = `500 24px ${bodyFont}`;
          ctx.fillText(tableLabel, CANVAS_W / 2, 96, CANVAS_W - 48);
        }

        // Framed QR — quiet zone + a soft rounded border reads better as a
        // sticker than the raw QR floating on the card.
        const qrX = (CANVAS_W - QR_SIZE) / 2;
        const qrY = 120;
        const pad = 16;
        ctx.beginPath();
        ctx.roundRect(qrX - pad, qrY - pad, QR_SIZE + pad * 2, QR_SIZE + pad * 2, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#57534e"; // stone-600, more contrast than sand
        ctx.stroke();
        ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);

        ctx.fillStyle = "#9a9490";
        ctx.font = `600 17px ${headingFont}`;
        ctx.fillText("Powered by Scan2Order", CANVAS_W / 2, CANVAS_H - 30);
      };
      qrImg.src = qr;
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [qr, restaurantName, tableLabel]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = downloadFileName;
    a.click();
  }

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="mx-auto h-auto w-full max-w-[240px] rounded-3xl"
      />
      <button
        type="button"
        onClick={download}
        className="mt-2 text-sm font-medium text-brand-600 print:hidden"
      >
        {downloadLabel}
      </button>
    </div>
  );
}
