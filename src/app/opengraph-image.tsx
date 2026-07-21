import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Scan2Order — QR ordering for restaurants, cafés & hotels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social/link-preview card (WhatsApp, X, LinkedIn, search). Uses the
// default system font so the build never depends on fetching a web font.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f3ec",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#d93d0b",
              display: "flex",
            }}
          />
          <div style={{ fontSize: "30px", color: "#221e18", fontWeight: 600 }}>
            Scan2Order
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "68px",
              lineHeight: 1.05,
              color: "#221e18",
              fontWeight: 700,
              maxWidth: "900px",
            }}
          >
            QR ordering for restaurants, cafés &amp; hotels
          </div>
          <div
            style={{
              fontSize: "30px",
              color: "#221e18",
              opacity: 0.62,
              maxWidth: "820px",
            }}
          >
            Guests scan, order and pay from the table. No app to install.
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {["Scan", "Order", "Cook", "Pay"].map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                fontSize: "22px",
                color: "#8c3d25",
                background: "#f5ddd2",
                padding: "8px 18px",
                borderRadius: "999px",
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
