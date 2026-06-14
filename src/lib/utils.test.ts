import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  formatDuration,
  isWithinWindow,
  happyHourPercentNow,
  toNumber,
  seatLabel,
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
  it("null bounds always within", () => {
    expect(isWithinWindow(null, null, at(3))).toBe(true);
  });
  it("same-day window", () => {
    expect(isWithinWindow("09:00", "11:00", at(10))).toBe(true);
    expect(isWithinWindow("09:00", "11:00", at(12))).toBe(false);
  });
  it("overnight (wrap-around) window", () => {
    expect(isWithinWindow("22:00", "02:00", at(23))).toBe(true);
    expect(isWithinWindow("22:00", "02:00", at(1))).toBe(true);
    expect(isWithinWindow("22:00", "02:00", at(12))).toBe(false);
  });
});

describe("happyHourPercentNow", () => {
  const at = (h: number) => new Date(2026, 0, 1, h, 0);
  const hh = { enabled: true, from: "16:00", to: "19:00", percent: 20 };
  it("returns percent inside the window", () => {
    expect(happyHourPercentNow(hh, at(17))).toBe(20);
  });
  it("0 outside the window", () => {
    expect(happyHourPercentNow(hh, at(12))).toBe(0);
  });
  it("0 when disabled", () => {
    expect(happyHourPercentNow({ ...hh, enabled: false }, at(17))).toBe(0);
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
