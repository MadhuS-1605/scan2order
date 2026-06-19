// Pure timing rules for the stale-order sweep, isolated so the thresholds are
// testable and shared. Generous windows so we never touch an order a diner is
// actively paying for.

export const PENDING_RECOVER_MIN = 30; // online intent abandoned -> back to UNPAID (retryable)
export const PREPAID_ABANDON_MIN = 90; // pay-first order never paid -> cancel (frees the queue)

// Orders whose state hasn't changed since before this instant are "stale".
export function pendingRecoverCutoff(now: Date): Date {
  return new Date(now.getTime() - PENDING_RECOVER_MIN * 60_000);
}
export function prepaidAbandonCutoff(now: Date): Date {
  return new Date(now.getTime() - PREPAID_ABANDON_MIN * 60_000);
}
