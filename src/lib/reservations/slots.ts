// Reservation slot capacity — pure so it's unit-testable without a DB.

// Buckets a Date into a fixed-width slot (e.g. 30 min), returned as the
// bucket's start time in epoch ms. Used to group reservations that fall in
// the "same" slot regardless of the exact minute booked.
export function slotBucketMs(date: Date, slotMinutes: number): number {
  const width = Math.max(1, slotMinutes) * 60_000;
  return Math.floor(date.getTime() / width) * width;
}

// Whether adding newPartySize to a slot already holding existingPartySizes
// would exceed capacityPerSlot. Null capacity = uncapped (always false).
export function capacityExceeded(
  existingPartySizes: number[],
  newPartySize: number,
  capacityPerSlot: number | null,
): boolean {
  if (capacityPerSlot === null) return false;
  const used = existingPartySizes.reduce((s, n) => s + n, 0);
  return used + newPartySize > capacityPerSlot;
}
