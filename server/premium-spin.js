const economy = require("./economy");

const GLOBAL_COUNTER_KEY = "global_premium_spins";
const PREMIUM_SPIN_STARS = 50;

const PRIZE_SEGMENTS = [
  { id: "jackpot_1000", label: "💰 1000$ JACKPOT", segmentIndex: 0, type: "cash", amount: 1000 },
  { id: "cash_15", label: "💵 15$", segmentIndex: 1, type: "cash", amount: 15 },
  { id: "cash_5", label: "💵 5$", segmentIndex: 2, type: "cash", amount: 5 },
  { id: "spin_again", label: "🔄 SPIN AGAIN", segmentIndex: 3, type: "refund" },
  { id: "boost_2x", label: "⚡ 2x BOOST", segmentIndex: 4, type: "boost" },
  { id: "coins_500", label: "🪙 500 COINS", segmentIndex: 5, type: "coins", amount: 500 }
];

const PRIZE_BY_ID = new Map(PRIZE_SEGMENTS.map((prize) => [prize.id, prize]));

function number(value) {
  return Number(value || 0);
}

function getProbabilities(globalSpins) {
  const spinAgain = 0.25;
  const boost = 0.12;
  const cash5 = globalSpins > 50 ? 0.06 : 0;
  const cash15 = globalSpins > 80 ? 0.0125 : 0;
  const jackpot = globalSpins >= 100000 ? 0.0000000001 : 0;
  const coins = 1 - spinAgain - boost - cash5 - cash15 - jackpot;

  return [
    { id: "jackpot_1000", weight: jackpot },
    { id: "cash_15", weight: cash15 },
    { id: "cash_5", weight: cash5 },
    { id: "spin_again", weight: spinAgain },
    { id: "boost_2x", weight: boost },
    { id: "coins_500", weight: coins }
  ];
}

function rollPremiumPrize(globalSpins) {
  const weights = getProbabilities(globalSpins);
  const roll = Math.random();
  let cursor = 0;

  for (const entry of weights) {
    cursor += entry.weight;
    if (roll < cursor) {
      return PRIZE_BY_ID.get(entry.id);
    }
  }

  return PRIZE_BY_ID.get("coins_500");
}

async function getGlobalPremiumSpins(supabase) {
  const { data, error } = await supabase
    .from("global_counters")
    .select("counter_value")
    .eq("counter_key", GLOBAL_COUNTER_KEY)
    .maybeSingle();

  if (error) throw error;
  return number(data?.counter_value);
}

async function incrementGlobalPremiumSpins(supabase) {
  const current = await getGlobalPremiumSpins(supabase);
  const next = current + 1;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("global_counters")
    .upsert({
      counter_key: GLOBAL_COUNTER_KEY,
      counter_value: next,
      updated_at: now
    });

  if (error) throw error;
  return next;
}

async function findPendingPremiumPayment(supabase, userId) {
  const { data, error } = await supabase
    .from("star_payments")
    .select("id, charge_id, stars_amount, created_at")
    .eq("user_id", userId)
    .eq("product_id", "premium_spin")
    .is("consumed_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function hasPendingPremiumPayment(supabase, userId) {
  const payment = await findPendingPremiumPayment(supabase, userId);
  return Boolean(payment);
}

async function createPendingPayout(supabase, {
  userId,
  username,
  displayName,
  amountUsd,
  prizeId,
  spinPaymentId
}) {
  const { error } = await supabase.from("pending_payouts").insert({
    user_id: userId,
    username: String(username || ""),
    display_name: String(displayName || ""),
    amount_usd: amountUsd,
    wallet_address: "",
    status: "pending",
    prize_id: prizeId,
    spin_payment_id: spinPaymentId
  });

  if (error) throw error;
}

function buildPremiumSpinUpdate(row, prize, extendBoostUntil) {
  const updated = {
    updated_at: new Date().toISOString()
  };

  if (prize.type === "coins") {
    const coins = number(row.coins) + number(prize.amount);
    updated.coins = coins;
    updated.city_value = coins + number(row.spent);
    return updated;
  }

  if (prize.type === "boost") {
    updated.income_boost_until = extendBoostUntil(row.income_boost_until);
    return updated;
  }

  return updated;
}

function formatPrizeResult(prize, extra = {}) {
  return {
    id: prize.id,
    label: prize.label,
    segmentIndex: prize.segmentIndex,
    type: prize.type,
    amount: prize.amount || 0,
    ...extra
  };
}

module.exports = {
  PREMIUM_SPIN_STARS,
  PRIZE_SEGMENTS,
  PRIZE_BY_ID,
  getProbabilities,
  rollPremiumPrize,
  getGlobalPremiumSpins,
  incrementGlobalPremiumSpins,
  findPendingPremiumPayment,
  hasPendingPremiumPayment,
  createPendingPayout,
  buildPremiumSpinUpdate,
  formatPrizeResult
};
