const PREMIUM_SPIN_MIN_INTERVAL_MS = 1000;
const premiumSpinRateBuckets = new Map();

function nowMs() {
  return Date.now();
}

function premiumSpinRateLimit(req, res, next) {
  const userId = String(req.playerId || "");
  if (!userId) {
    res.status(401).json({ error: "SESSION_EXPIRED" });
    return;
  }

  const now = nowMs();
  const last = premiumSpinRateBuckets.get(userId) || 0;

  if (now - last < PREMIUM_SPIN_MIN_INTERVAL_MS) {
    res.status(429).json({ error: "SPIN_RATE_LIMITED" });
    return;
  }

  premiumSpinRateBuckets.set(userId, now);
  next();
}

async function logFraudEvent(supabase, {
  userId,
  eventType,
  detail = ""
}) {
  const row = {
    user_id: String(userId || ""),
    event_type: String(eventType || "UNKNOWN"),
    detail: String(detail || "").slice(0, 500),
    created_at: new Date().toISOString()
  };

  try {
    await supabase.from("fraud_events").insert(row);
  } catch (error) {
    console.warn("FRAUD_EVENT_LOG_FAILED:", error.message, row);
  }
}

function sanitizePremiumSpinPrize(prize) {
  if (!prize) return null;

  const winnerSliceId = Number(prize.segmentIndex ?? 0);

  return {
    winnerSliceId,
    segmentIndex: winnerSliceId,
    id: String(prize.id || ""),
    label: String(prize.label || ""),
    type: String(prize.type || "none"),
    amount: Number(prize.amount || 0)
  };
}

module.exports = {
  PREMIUM_SPIN_MIN_INTERVAL_MS,
  premiumSpinRateLimit,
  logFraudEvent,
  sanitizePremiumSpinPrize
};
