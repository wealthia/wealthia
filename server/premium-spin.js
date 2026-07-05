const economy = require("./economy");
const gameSettings = require("./game-settings");

const GLOBAL_COUNTER_KEY = "global_premium_spins";

const PRIZE_SEGMENTS = [
  { id: "cash_10", label: "💰 $10 CASH", segmentIndex: 0, type: "cash", amount: 10 },
  { id: "cash_5", label: "💵 $5 CASH", segmentIndex: 1, type: "cash", amount: 5 },
  { id: "cash_2", label: "💵 $2 CASH", segmentIndex: 2, type: "cash", amount: 2 },
  { id: "tickets_10", label: "🎟️ 10 TICKETS", segmentIndex: 3, type: "tickets", amount: 10 },
  { id: "coins_500", label: "🪙 500 COINS", segmentIndex: 4, type: "coins", amount: 500 },
  { id: "no_luck", label: "❌ NO LUCK", segmentIndex: 5, type: "none" }
];

const PRIZE_BY_ID = new Map(PRIZE_SEGMENTS.map((prize) => [prize.id, prize]));

const NON_CASH_WEIGHTS = [
  { id: "tickets_10", weight: 0.55 },
  { id: "coins_500", weight: 0.25 },
  { id: "no_luck", weight: 0.20 }
];

function number(value) {
  return Number(value || 0);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getPremiumSpinStars() {
  return gameSettings.getSettingsSync().premium_spin_stars;
}

function getCashIntervals() {
  const settings = gameSettings.getSettingsSync();
  const cash10 = settings.cash_10_interval;
  return {
    cash10Min: cash10,
    cash10Block: cash10,
    cash5Block: settings.cash_5_interval,
    cash2Block: settings.cash_2_interval
  };
}

function resolveStrictCashPrize(globalSpins) {
  const spins = number(globalSpins);
  const { cash10Min, cash10Block, cash5Block, cash2Block } = getCashIntervals();

  if (spins >= cash10Min && spins % cash10Block === 0) {
    return PRIZE_BY_ID.get("cash_10");
  }

  if (spins % cash5Block === 0) {
    return PRIZE_BY_ID.get("cash_5");
  }

  if (spins % cash2Block === 0) {
    return PRIZE_BY_ID.get("cash_2");
  }

  return null;
}

function pickNonCashPrize() {
  let roll = Math.random();
  let picked = NON_CASH_WEIGHTS[0].id;

  for (const entry of NON_CASH_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) {
      picked = entry.id;
      break;
    }
  }

  return { ...PRIZE_BY_ID.get(picked) };
}

function getProbabilities(globalSpins) {
  const cash = resolveStrictCashPrize(globalSpins);
  if (cash) {
    return [{ id: cash.id, weight: 1 }];
  }

  return NON_CASH_WEIGHTS.map((entry) => ({ ...entry }));
}

async function rollPremiumPrize(supabase, globalSpins) {
  const cash = resolveStrictCashPrize(globalSpins);
  if (cash) {
    return { ...cash };
  }

  return pickNonCashPrize();
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
  const starsAmount = getPremiumSpinStars();
  const { data, error } = await supabase
    .from("star_payments")
    .select("id, charge_id, stars_amount, telegram_settled, created_at")
    .eq("user_id", userId)
    .eq("product_id", "premium_spin")
    .eq("stars_amount", starsAmount)
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

  if (prize.type === "coins") {
    const coins = number(row.coins) + number(prize.amount || 500);
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

function nextMultiple(spins, block) {
  const current = number(spins);
  const size = Math.max(1, number(block));
  if (current % size === 0) return current + size;
  return current + (size - (current % size));
}

function getSpinMilestoneInfo(globalSpins) {
  const current = number(globalSpins);
  const { cash10Min, cash10Block, cash5Block, cash2Block } = getCashIntervals();
  const nextCash10 = current < cash10Min
    ? cash10Min
    : nextMultiple(current, cash10Block);
  const nextCash5 = nextMultiple(current, cash5Block);
  const nextCash2 = nextMultiple(current, cash2Block);

  return {
    current,
    nextCash10,
    nextCash5,
    nextCash2,
    remainingCash10: Math.max(0, nextCash10 - current),
    remainingCash5: Math.max(0, nextCash5 - current),
    remainingCash2: Math.max(0, nextCash2 - current)
  };
}

module.exports = {
  GLOBAL_COUNTER_KEY,
  get PREMIUM_SPIN_STARS() { return getPremiumSpinStars(); },
  get CASH_10_MIN_SPINS() { return getCashIntervals().cash10Min; },
  get CASH_10_BLOCK_SPINS() { return getCashIntervals().cash10Block; },
  get CASH_5_BLOCK_SPINS() { return getCashIntervals().cash5Block; },
  get CASH_2_BLOCK_SPINS() { return getCashIntervals().cash2Block; },
  getPremiumSpinStars,
  getCashIntervals,
  PRIZE_SEGMENTS,
  PRIZE_BY_ID,
  getProbabilities,
  resolveStrictCashPrize,
  rollPremiumPrize,
  getGlobalPremiumSpins,
  incrementGlobalPremiumSpins,
  findPendingPremiumPayment,
  hasPendingPremiumPayment,
  createPendingPayout,
  buildPremiumSpinUpdate,
  formatPrizeResult,
  getSpinMilestoneInfo,
  nextMultiple
};
