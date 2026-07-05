const premiumSpinSecurity = require("./premium-spin-security");

const MACRO_ACTION_THRESHOLD = Number(process.env.MACRO_ACTION_THRESHOLD || 40);
const actionBuckets = new Map();

function currentSecond() {
  return Math.floor(Date.now() / 1000);
}

function recordMacroAction(userId, action = "action") {
  const key = `${String(userId || "")}:${action}`;
  const second = currentSecond();
  const existing = actionBuckets.get(key);

  if (!existing || existing.second !== second) {
    actionBuckets.set(key, { second, count: 1 });
    return { exceeded: false, count: 1, threshold: MACRO_ACTION_THRESHOLD };
  }

  existing.count += 1;
  actionBuckets.set(key, existing);

  return {
    exceeded: existing.count > MACRO_ACTION_THRESHOLD,
    count: existing.count,
    threshold: MACRO_ACTION_THRESHOLD
  };
}

async function autoBanMacroUser(supabase, userId, detail) {
  const normalizedId = String(userId || "").trim();
  if (!normalizedId) return false;

  try {
    const { data, error } = await supabase
      .from("users")
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        ban_reason: "Automatic macro / clicker detection"
      })
      .eq("id", normalizedId)
      .eq("is_banned", false)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("MACRO_AUTO_BAN_FAILED:", error.message);
      return false;
    }

    if (!data) return false;

    await premiumSpinSecurity.logFraudEvent(supabase, {
      userId: normalizedId,
      eventType: "MACRO_AUTO_BAN",
      detail: String(detail || "").slice(0, 500)
    });

    console.warn("MACRO_AUTO_BAN:", normalizedId, detail);
    return true;
  } catch (error) {
    console.error("MACRO_AUTO_BAN_EXCEPTION:", error.message);
    return false;
  }
}

async function enforceMacroGuard(supabase, userId, action) {
  const result = recordMacroAction(userId, action);
  if (!result.exceeded) {
    return { blocked: false, ...result };
  }

  const detail = `${action} rate=${result.count}/s threshold=${result.threshold}`;
  const banned = await autoBanMacroUser(supabase, userId, detail);
  return {
    blocked: true,
    banned,
    ...result,
    detail
  };
}

module.exports = {
  MACRO_ACTION_THRESHOLD,
  recordMacroAction,
  autoBanMacroUser,
  enforceMacroGuard
};
