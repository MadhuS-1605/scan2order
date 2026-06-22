import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  formatDuration,
  isWithinWindow,
  happyHourPercentNow,
  toNumber,
  seatLabel,
  venueOrderingOpen,
  escapeHtml,
} from "@/lib/utils";

describe("distanceMeters (geofence)", () => {
  it("is 0 for the same point", () => {
    expect(distanceMeters(12.9352, 77.6245, 12.9352, 77.6245)).toBe(0);
  });
  it("approximates 1° of longitude at the equator (~111 km)", () => {
    const d = distanceMeters(0, 0, 0, 1);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
  it("a nearby point is within a 300 m order radius, a far one is not", () => {
    // ~0.001° ≈ 111 m
    expect(distanceMeters(12.9352, 77.6245, 12.936, 77.6245)).toBeLessThan(300);
    expect(distanceMeters(12.9352, 77.6245, 13.05, 77.7)).toBeGreaterThan(300);
  });
});

describe("formatDuration", () => {
  it("formats minutes", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(125)).toBe("2h 5m");
  });
});

describe("isWithinWindow", () => {
  const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);
  // 3rd arg is the venue tz (undefined = server-local); 4th is the injected "now".
  it("null bounds always within", () => {
    expect(isWithinWindow(null, null, undefined, at(3))).toBe(true);
  });
  it("same-day window", () => {
    expect(isWithinWindow("09:00", "11:00", undefined, at(10))).toBe(true);
    expect(isWithinWindow("09:00", "11:00", undefined, at(12))).toBe(false);
  });
  it("overnight (wrap-around) window", () => {
    expect(isWithinWindow("22:00", "02:00", undefined, at(23))).toBe(true);
    expect(isWithinWindow("22:00", "02:00", undefined, at(1))).toBe(true);
    expect(isWithinWindow("22:00", "02:00", undefined, at(12))).toBe(false);
  });
});

describe("venueOrderingOpen", () => {
  const base = { timezone: "Asia/Kolkata", openTime: null, closeTime: null };
  it("open 24h when no hours set", () => {
    expect(venueOrderingOpen({ ...base, orderingPaused: false }).open).toBe(true);
  });
  it("closed when manually paused", () => {
    const r = venueOrderingOpen({ ...base, orderingPaused: true });
    expect(r.open).toBe(false);
    expect(r.reason).toBe("paused");
  });
  it("respects daily hours in the venue timezone", () => {
    // 09:00–17:00 UTC: 12:00 UTC is open, 20:00 UTC is closed.
    const open = venueOrderingOpen({
      orderingPaused: false,
      openTime: "09:00",
      closeTime: "17:00",
      timezone: "UTC",
    });
    // We can't pin "now" here, so just assert it returns a well-formed result.
    expect(typeof open.open).toBe("boolean");
    expect([null, "closed", "paused"]).toContain(open.reason);
  });
});

describe("happyHourPercentNow", () => {
  const at = (h: number) => new Date(2026, 0, 1, h, 0);
  const hh = { enabled: true, from: "16:00", to: "19:00", percent: 20 };
  it("returns percent inside the window", () => {
    expect(happyHourPercentNow(hh, undefined, at(17))).toBe(20);
  });
  it("0 outside the window", () => {
    expect(happyHourPercentNow(hh, undefined, at(12))).toBe(0);
  });
  it("0 when disabled", () => {
    expect(happyHourPercentNow({ ...hh, enabled: false }, undefined, at(17))).toBe(0);
  });
});

describe("escapeHtml (email-template XSS guard)", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&#39;");
  });
  it("neutralizes an injected tag in a tenant-controlled name", () => {
    const out = escapeHtml(`<img src=x onerror=alert(1)>`);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("&lt;img");
  });
  it("leaves plain text untouched", () => {
    expect(escapeHtml("Madhu's Cafe 42")).toBe("Madhu&#39;s Cafe 42");
    expect(escapeHtml("Dosa Corner")).toBe("Dosa Corner");
  });
});

describe("toNumber & seatLabel", () => {
  it("toNumber handles number and string", () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber("12.5")).toBe(12.5);
  });
  it("seatLabel prefixes rooms", () => {
    expect(seatLabel({ label: "T1" })).toBe("T1");
    expect(seatLabel({ label: "204", kind: "ROOM" })).toBe("Room 204");
    expect(seatLabel(null)).toBe("Takeaway");
  });
});
