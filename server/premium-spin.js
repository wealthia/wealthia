const economy = require("./economy");

const GLOBAL_COUNTER_KEY = "global_premium_spins";
const CASH_50_LAST_SPIN_KEY = "premium_cash_50_last_spin";
const CASH_1_LAST_SPIN_KEY = "premium_cash_1_last_spin";
const PREMIUM_SPIN_STARS = 50;
const CASH_50_BLOCK_SPINS = 500;
const CASH_1_BLOCK_SPINS = 15;

const PRIZE_SEGMENTS = [
  { id: "cash_50", label: "💰 $50 CASH", segmentIndex: 0, type: "cash", amount: 50 },
  { id: "cash_1", label: "💵 $1 CASH", segmentIndex: 1, type: "cash", amount: 1 },
  { id: "tickets_10", label: "🎟️ 10 TICKETS", segmentIndex: 2, type: "tickets", amount: 10 },
  { id: "no_luck", label: "❌ NO LUCK", segmentIndex: 3, type: "none" },
  { id: "boost_2x", label: "⚡ 2x BOOST", segmentIndex: 4, type: "boost" },
  { id: "tickets_10", label: "🎟️ 10 TICKETS", segmentIndex: 5, type: "tickets", amount: 10 }
];

const PRIZE_BY_ID = new Map(
  PRIZE_SEGMENTS.filter((prize, index, list) =>
    list.findIndex((item) => item.id === prize.id) === index
  ).map((prize) => [prize.id, prize])
);

const FILLER_WEIGHTS = [
  { id: "tickets_10", weight: 0.45 },
  { id: "no_luck", weight: 0.30 },
  { id: "boost_2x", weight: 0.25 }
];

function number(value) {
  return Number(value || 0);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentBlockStart(globalSpins, blockSize) {
  return Math.floor((globalSpins - 1) / blockSize) * blockSize;
}

function canAwardCashInBlock(globalSpins, lastAwardSpin, blockSize) {
  if (!lastAwardSpin) return true;
  const blockStart = currentBlockStart(globalSpins, blockSize);
  return lastAwardSpin <= blockStart;
}

function getProbabilities(globalSpins, options = {}) {
  const adminTest = Boolean(options.adminTest);
  const cash50Open = canAwardCashInBlock(globalSpins, 0, CASH_50_BLOCK_SPINS);
  const cash1Open = canAwardCashInBlock(globalSpins, 0, CASH_1_BLOCK_SPINS);

  const cash50 = adminTest ? 0.01 : (cash50Open ? 1 / CASH_50_BLOCK_SPINS : 0);
  const cash1 = adminTest ? 0.05 : (cash1Open && globalSpins % CASH_1_BLOCK_SPINS === 0 ? 1 : 0);
  const tickets = 0.45;
  const noLuck = 0.30;
  const boost = 0.25;
  const fillerScale = Math.max(0, 1 - cash50 - cash1);

  return [
    { id: "cash_50", weight: cash50 },
    { id: "cash_1", weight: cash1 },
    { id: "tickets_10", weight: tickets * fillerScale },
    { id: "no_luck", weight: noLuck * fillerScale },
    { id: "boost_2x", weight: boost * fillerScale }
  ];
}

function pickFillerPrize() {
  let roll = Math.random();
  let picked = FILLER_WEIGHTS[0].id;

  for (const entry of FILLER_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) {
      picked = entry.id;
      break;
    }
  }

  const prize = { ...PRIZE_BY_ID.get(picked) };
  if (picked === "tickets_10") {
    prize.segmentIndex = Math.random() < 0.5 ? 2 : 5;
  }
  return prize;
}

async function getCounterValue(supabase, key) {
  const { data, error } = await supabase
    .from("global_counters")
    .select("counter_value")
    .eq("counter_key", key)
    .maybeSingle();

  if (error) {
    console.warn(`COUNTER_READ_FAILED:${key}`, error.message);
    return 0;
  }

  return number(data?.counter_value);
}

async function setCounterValue(supabase, key, value) {
  const { error } = await supabase
    .from("global_counters")
    .upsert({
      counter_key: key,
      counter_value: value,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

async function rollPremiumPrize(supabase, globalSpins, options = {}) {
  if (options.adminTest) {
    return pickFillerPrize();
  }

  const lastCash50 = await getCounterValue(supabase, CASH_50_LAST_SPIN_KEY);
  const lastCash1 = await getCounterValue(supabase, CASH_1_LAST_SPIN_KEY);
  const cash50Open = canAwardCashInBlock(globalSpins, lastCash50, CASH_50_BLOCK_SPINS);
  const cash1Open = canAwardCashInBlock(globalSpins, lastCash1, CASH_1_BLOCK_SPINS);

  if (cash50Open) {
    const forceOnBoundary = globalSpins % CASH_50_BLOCK_SPINS === 0;
    const rareRoll = Math.random() < (1 / CASH_50_BLOCK_SPINS);

    if (forceOnBoundary || rareRoll) {
      await setCounterValue(supabase, CASH_50_LAST_SPIN_KEY, globalSpins);
      return { ...PRIZE_BY_ID.get("cash_50") };
    }
  }

  if (cash1Open && globalSpins % CASH_1_BLOCK_SPINS === 0) {
    await setCounterValue(supabase, CASH_1_LAST_SPIN_KEY, globalSpins);
    return { ...PRIZE_BY_ID.get("cash_1") };
  }

  return pickFillerPrize();
}

async function getGlobalPremiumSpins(supabase) {
  const { data, error } = await supabase
    .from("global_counters")
    .select("counter_value")
    .eq("counter_key", GLOBAL_COUNTER_KEY)
    .maybeSingle();

  if (error) {
    console.warn("GLOBAL_PREMIUM_SPINS_READ_FAILED:", error.message);
    return 0;
  }

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
    .select("id, charge_id, stars_amount, telegram_settled, created_at")
    .eq("user_id", userId)
    .eq("product_id", "premium_spin")
    .eq("stars_amount", PREMIUM_SPIN_STARS)
    .eq("telegram_settled", true)
    .is("consumed_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
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

function buildPremiumSpinUpdate(row, prize, extendBoostUntil, today = todayKey()) {
  const updated = {
    updated_at: new Date().toISOString()
  };

  if (prize.type === "tickets") {
    const ticketCount = Math.max(1, number(prize.amount) || 10);
    const bonusScore = ticketCount * economy.TICKETS_PER_SCORE;
    let score = number(row.daily_contest_score);
    let contestDate = String(row.contest_date || "");
    let baseline = number(row.contest_baseline_city);

    if (contestDate !== today) {
      score = 0;
      baseline = number(row.coins) + number(row.spent);
      contestDate = today;
    }

    updated.daily_contest_score = score + bonusScore;
    updated.contest_date = contestDate;
    updated.contest_baseline_city = baseline;
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
  CASH_50_BLOCK_SPINS,
  CASH_1_BLOCK_SPINS,
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
