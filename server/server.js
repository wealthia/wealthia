const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const {
  authFailureReason,
  bearerTokenFromRequest,
  createSessionToken,
  requireVerifiedTelegramPlayer,
  resolveTelegramUser,
  verifyToken
} = require("./auth");
const {
  contestSeedGameRows,
  contestSeedProfile,
  isContestSeedUserId
} = require("./contest-seeds");
const systemBots = require("./system-bots");
const premiumSpin = require("./premium-spin");
const premiumSpinSecurity = require("./premium-spin-security");
const telegramStars = require("./telegram-stars");
const economy = require("./economy");

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors());
app.use(express.json());
app.use(ipRateLimit);

const MAX_ENERGY = economy.DEFAULT_MAX_ENERGY;
const TASK_REFRESH_MS = 12 * 60 * 60 * 1000;
const TASKS_PER_CYCLE = 4;

function normalizeChannelUsername(value) {
  const raw = String(value || "").trim();
  if (!raw) return "@weathia_official";
  return raw.startsWith("@") ? raw : `@${raw}`;
}

const SOCIAL_JOIN_TELEGRAM_URL =
  process.env.SOCIAL_JOIN_TELEGRAM_URL || "https://t.me/weathia_official";
const OFFICIAL_CHANNEL_USERNAME = normalizeChannelUsername(
  process.env.OFFICIAL_CHANNEL_USERNAME || "@weathia_official"
);
const OFFICIAL_CHANNEL_FALLBACK_USERNAMES = [
  OFFICIAL_CHANNEL_USERNAME,
  normalizeChannelUsername(process.env.OFFICIAL_CHANNEL_FALLBACK_USERNAME || "@official_wealthia")
].filter((value, index, list) => list.indexOf(value) === index);
const OFFICIAL_CHANNEL_ID = String(process.env.OFFICIAL_CHANNEL_ID || "").trim();
const OFFICIAL_CHANNEL_URL =
  process.env.OFFICIAL_CHANNEL_URL || `https://t.me/${OFFICIAL_CHANNEL_USERNAME.replace(/^@/, "")}`;
const CONNECTION_ERROR_MESSAGE =
  "Connection error. Please try again or restart the bot.";
let resolvedOfficialChannelChatId = "";
let resolvedOfficialChannelUrl = "";
const BOOST_DURATION_MS = 30 * 60 * 1000;
const REFERRAL_BONUS = 500;
const NEW_PLAYER_BONUS = 100;
const ADMIN_TELEGRAM_ID = "1988089728";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const AD_REWARD_COOLDOWN_MS = 5 * 60 * 1000;
const BONUS_AD_REWARD_COOLDOWN_MS = 15 * 60 * 1000;
const GOLD_RUSH_DURATION_MS = 15 * 60 * 1000;
const GOLD_RUSH_MULTIPLIER = 2;
const CRON_SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET || "";
const DAILY_PUSH_HOUR_UTC = Math.max(0, Math.min(23, Number(process.env.DAILY_PUSH_HOUR_UTC) || 10));
const DAILY_PRIZE_MIN_REFERRALS = Math.max(0, Number(process.env.DAILY_PRIZE_MIN_REFERRALS) || 3);
const REFERRAL_STATUS_QUALIFIED = "qualified";
const REFERRAL_STATUS_PENDING_CHANNEL = "pending_channel";
const REFERRAL_STATUS_REJECTED_BOT = "rejected_bot";
const CHANNEL_MEMBER_STATUSES = new Set([
  "creator",
  "administrator",
  "member",
  "restricted"
]);
const TAP_RATE_WINDOW_MS = 1000;
const MAX_TAPS_PER_WINDOW = 10;
const TAP_VIOLATION_ALERT_THRESHOLD = 25;
const IP_RATE_WINDOW_MS = 60 * 1000;
const IP_MAX_HITS = 240;
const ipRateBuckets = new Map();

const EARN_TASKS = {
  sponsor: { reward: 750, field: "sponsor_done" },
  ad: { reward: 300, cooldown: true },
  bonus_ad: { reward: 150, cooldown: true, field: "bonus_ad_last_claimed_at" },
  channel: { reward: 500, field: "channel_done" }
};

const BOOST_OPTIONS = {
  fullEnergy: { cost: 100, type: "energy" },
  tapBoost: { cost: 150, type: "tap" },
  incomeBoost: { cost: 200, type: "income" }
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const OWNER_TELEGRAM_ID = String(process.env.OWNER_TELEGRAM_ID || "").trim();

const STAR_PRODUCTS = {
  refill_energy: {
    stars: 5,
    title: "Full Energy Refill",
    description: "Instantly refill your energy to 100%",
    successMessage: "Energy refilled to 100%!"
  },
  tap_boost_30: {
    stars: 10,
    title: "2x Tap Boost",
    description: "Double tap income for 30 minutes",
    successMessage: "2x Tap boost active for 30 minutes!"
  },
  endless_energy_30: {
    stars: 15,
    title: "Endless Energy",
    description: "Tapping costs no energy for 30 minutes",
    successMessage: "Endless Energy active for 30 minutes!"
  },
  income_boost_30: {
    stars: 15,
    title: "2x Income Boost",
    description: "Double offline income for 30 minutes",
    successMessage: "2x Income boost active for 30 minutes!"
  },
  premium_spin: {
    stars: premiumSpin.PREMIUM_SPIN_STARS,
    title: "Premium Lucky Spin",
    description: "Spin the premium wheel for cash and coin prizes",
    successMessage: "Premium spin ready!"
  }
};

const TELEGRAM_WEBHOOK_SECRET =
  String(process.env.TELEGRAM_WEBHOOK_SECRET || process.env.ADMIN_SECRET || "").trim();
const WEBHOOK_BASE_URL = String(
  process.env.WEBHOOK_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  process.env.BACKEND_URL ||
  ""
).trim();

async function notifyOwnerStarsSale(details) {
  if (!OWNER_TELEGRAM_ID || !TELEGRAM_BOT_TOKEN) return;

  const lines = [
    "💰 Wealthia — Stars satışı!",
    "",
    `Oyunçu: ${details.playerName}`,
    `Məhsul: ${details.productTitle}`,
    `Ödənilib: ${details.stars} ⭐`,
    "",
    "Gəlir gəlir — əla! 🎉"
  ];

  try {
    await telegramApi("sendMessage", {
      chat_id: OWNER_TELEGRAM_ID,
      text: lines.join("\n")
    });
  } catch (error) {
    console.warn("OWNER_STARS_NOTIFY_FAILED:", error.message);
  }
}

async function telegramApi(method, body) {
  const safe = await telegramApiSafe(method, body);
  if (!safe.ok) {
    throw new Error(safe.error || "Telegram API error");
  }
  return safe.result;
}

async function telegramApiSafe(method, body) {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN_MISSING", result: null };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!data.ok) {
      return {
        ok: false,
        error: data.description || "Telegram API error",
        result: null
      };
    }

    return { ok: true, error: "", result: data.result };
  } catch (error) {
    return {
      ok: false,
      error: error.message || "Telegram API request failed",
      result: null
    };
  }
}

async function getOfficialChannelChatId() {
  if (OFFICIAL_CHANNEL_ID) return OFFICIAL_CHANNEL_ID;
  if (resolvedOfficialChannelChatId) return resolvedOfficialChannelChatId;

  for (const username of OFFICIAL_CHANNEL_FALLBACK_USERNAMES) {
    const lookup = await telegramApiSafe("getChat", { chat_id: username });
    if (!lookup.ok || !lookup.result?.id) continue;

    resolvedOfficialChannelChatId = String(lookup.result.id);
    if (lookup.result.username) {
      resolvedOfficialChannelUrl = `https://t.me/${lookup.result.username}`;
    }
    return resolvedOfficialChannelChatId;
  }

  console.warn("OFFICIAL_CHANNEL_RESOLVE_FAILED:", OFFICIAL_CHANNEL_FALLBACK_USERNAMES.join(", "));
  return "";
}

function getOfficialChannelUrl() {
  return resolvedOfficialChannelUrl || OFFICIAL_CHANNEL_URL;
}

function isChannelMembershipLookupError(errorText) {
  const text = String(errorText || "").toLowerCase();
  return (
    text.includes("user not found") ||
    text.includes("user_not_participant") ||
    text.includes("not a member") ||
    text.includes("user_id_invalid") ||
    text.includes("participant_id_invalid")
  );
}

function isChannelConfigurationError(errorText) {
  const text = String(errorText || "").toLowerCase();
  return (
    text.includes("chat not found") ||
    text.includes("bot is not a member") ||
    text.includes("have no rights") ||
    text.includes("not enough rights") ||
    text.includes("channel_private")
  );
}

async function checkOfficialChannelMembership(telegramId) {
  const result = {
    isMember: false,
    error: "",
    skipped: false
  };

  if (!TELEGRAM_BOT_TOKEN || !telegramId) {
    result.error = "BOT_OR_USER_MISSING";
    result.skipped = true;
    result.isMember = true;
    return result;
  }

  const chatId = await getOfficialChannelChatId();
  if (!chatId) {
    result.error = "CHANNEL_NOT_RESOLVED";
    result.skipped = true;
    result.isMember = true;
    return result;
  }

  const lookup = await telegramApiSafe("getChatMember", {
    chat_id: chatId,
    user_id: Number(telegramId)
  });

  if (!lookup.ok) {
    result.error = lookup.error || "CHANNEL_LOOKUP_FAILED";

    if (isChannelMembershipLookupError(result.error)) {
      return result;
    }

    if (isChannelConfigurationError(result.error)) {
      result.skipped = true;
      result.isMember = true;
      return result;
    }

    result.skipped = true;
    result.isMember = true;
    return result;
  }

  result.isMember = CHANNEL_MEMBER_STATUSES.has(String(lookup.result?.status || ""));
  return result;
}

async function hasPendingChannelReferral(userId) {
  try {
    const { data, error } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", String(userId))
      .eq("status", REFERRAL_STATUS_PENDING_CHANNEL)
      .maybeSingle();

    if (error) {
      console.warn("PENDING_REFERRAL_LOOKUP_FAILED:", error.message);
      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.warn("PENDING_REFERRAL_LOOKUP_FAILED:", error.message);
    return false;
  }
}

async function inspectOfficialChannelAccess() {
  const chatId = await getOfficialChannelChatId();
  const chat = await telegramApiSafe("getChat", { chat_id: chatId });

  if (!chat.ok) {
    return {
      ok: false,
      chatId,
      username: OFFICIAL_CHANNEL_USERNAME,
      error: chat.error || "CHANNEL_NOT_FOUND"
    };
  }

  const botInfo = await telegramApiSafe("getMe");
  let botIsAdmin = false;

  if (botInfo.ok && botInfo.result?.id) {
    const membership = await telegramApiSafe("getChatMember", {
      chat_id: chatId,
      user_id: Number(botInfo.result.id)
    });

    if (membership.ok) {
      const status = String(membership.result?.status || "");
      botIsAdmin = status === "administrator" || status === "creator";
    }
  }

  return {
    ok: true,
    chatId: String(chat.result?.id || chatId),
    username: chat.result?.username
      ? `@${chat.result.username}`
      : OFFICIAL_CHANNEL_USERNAME,
    title: chat.result?.title || "",
    botIsAdmin
  };
}

function extendBoostUntil(currentUntil) {
  return Math.max(nowMs(), number(currentUntil)) + BOOST_DURATION_MS;
}

function hasEndlessEnergy(row) {
  return number(row.endless_energy_until) > nowMs();
}

function adRewardNextAt(row) {
  const last = number(row.ad_last_claimed_at);
  if (!last) return 0;
  return last + AD_REWARD_COOLDOWN_MS;
}

function adRewardOnCooldown(row) {
  return adRewardNextAt(row) > nowMs();
}

function bonusAdRewardNextAt(row) {
  const last = number(row.bonus_ad_last_claimed_at);
  if (!last) return 0;
  return last + BONUS_AD_REWARD_COOLDOWN_MS;
}

function bonusAdRewardOnCooldown(row) {
  return bonusAdRewardNextAt(row) > nowMs();
}

function applyStarProduct(row, productId) {
  const updated = {
    updated_at: new Date().toISOString()
  };

  if (productId === "refill_energy") {
    updated.energy = economy.maxEnergy(row);
    return updated;
  }

  if (productId === "tap_boost_30") {
    updated.tap_boost_until = extendBoostUntil(row.tap_boost_until);
    return updated;
  }

  if (productId === "endless_energy_30") {
    updated.endless_energy_until = extendBoostUntil(row.endless_energy_until);
    updated.energy = economy.maxEnergy(row);
    return updated;
  }

  if (productId === "income_boost_30") {
    updated.income_boost_until = extendBoostUntil(row.income_boost_until);
    return updated;
  }

  if (productId === "premium_spin") {
    return { updated_at: new Date().toISOString() };
  }

  return null;
}

function starPayload(userId, productId) {
  return `w|${userId}|${productId}`;
}

function parseStarPayload(payload) {
  const parts = String(payload || "").split("|");
  if (parts.length !== 3 || parts[0] !== "w") return null;
  return { userId: parts[1], productId: parts[2] };
}

function getTelegramStarsOptions() {
  return {
    telegramApiSafe,
    starProducts: STAR_PRODUCTS,
    parseStarPayload,
    fulfillPayment: fulfillStarPaymentRecord,
    sendBotMessage: async (chatId, text) => {
      await telegramApiSafe("sendMessage", { chat_id: chatId, text });
    }
  };
}

async function fulfillStarPaymentRecord({
  userId,
  productId,
  chargeId,
  stars,
  invoicePayload
}) {
  const starsAmount = number(stars);
  const payload = parseStarPayload(invoicePayload);

  if (!userId || !productId || !chargeId || !STAR_PRODUCTS[productId]) {
    const error = new Error("BAD_REQUEST");
    error.code = "BAD_REQUEST";
    throw error;
  }

  if (!payload || payload.userId !== userId || payload.productId !== productId) {
    const error = new Error("INVALID_PAYLOAD");
    error.code = "INVALID_PAYLOAD";
    throw error;
  }

  const expectedStars = number(STAR_PRODUCTS[productId].stars);
  if (!expectedStars || starsAmount !== expectedStars) {
    const error = new Error("INVALID_STARS_AMOUNT");
    error.code = "INVALID_STARS_AMOUNT";
    throw error;
  }

  if (!chargeId || chargeId.length < 8) {
    const error = new Error("INVALID_CHARGE_ID");
    error.code = "INVALID_CHARGE_ID";
    throw error;
  }

  const { data: existing } = await supabase
    .from("star_payments")
    .select("id")
    .eq("charge_id", chargeId)
    .maybeSingle();

  if (existing) {
    if (productId === "premium_spin") {
      await premiumSpinSecurity.logFraudEvent(supabase, {
        userId,
        eventType: "REPLAY_CHARGE_ID",
        detail: `charge_id=${chargeId}`
      });
      const error = new Error("FRAUD_REPLAY");
      error.code = "FRAUD_REPLAY";
      throw error;
    }
    return { duplicate: true, user: await loadGame(userId) };
  }

  const row = await loadGame(userId);
  const productUpdate = applyStarProduct(row, productId);

  if (!productUpdate) {
    const error = new Error("BAD_PRODUCT");
    error.code = "BAD_PRODUCT";
    throw error;
  }

  const { error: paymentError } = await supabase.from("star_payments").insert({
    user_id: userId,
    product_id: productId,
    stars_amount: expectedStars,
    charge_id: chargeId
  });

  if (paymentError) throw paymentError;

  const { data, error } = await supabase
    .from("game_states")
    .update(productUpdate)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;

  const { data: buyer } = await supabase
    .from("users")
    .select("first_name, username")
    .eq("id", userId)
    .maybeSingle();

  await notifyOwnerStarsSale({
    playerName: buyer?.first_name || buyer?.username || `Player ${userId.slice(-4)}`,
    productTitle: STAR_PRODUCTS[productId].title,
    stars: expectedStars
  });

  return {
    duplicate: false,
    user: data,
    productId,
    premiumSpinReady: productId === "premium_spin"
  };
}

function nowMs() {
  return Date.now();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function taskCycleKey(ms = nowMs()) {
  return String(Math.floor(ms / TASK_REFRESH_MS));
}

function nextTaskRefreshMs(ms = nowMs()) {
  const cycle = Math.floor(ms / TASK_REFRESH_MS);
  return (cycle + 1) * TASK_REFRESH_MS;
}

function yesterdayKey() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dailyRewardAmount(row) {
  const streak = nextDailyStreak(row);
  return 100 + Math.max(0, streak - 1) * 50;
}

function nextDailyStreak(row) {
  const today = todayKey();
  const yesterday = yesterdayKey();

  if (row.daily_date === today) {
    return Math.max(1, number(row.daily_streak));
  }

  if (row.daily_date === yesterday) {
    return Math.max(1, number(row.daily_streak)) + 1;
  }

  return 1;
}

function dailyRewardClaimedToday(row) {
  return row.daily_date === todayKey();
}

function parseReferrerId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("ref_")) {
    return raw.slice(4);
  }

  return raw;
}

function number(value) {
  return Number(value || 0);
}

function upgradeCost(building, level) {
  const base = { shop: 50, bank: 120, factory: 200, casino: 300 }[building];
  return Math.floor(base * Math.pow(1.75, Math.max(0, level - 1)));
}

function empireLevel(row) {
  return (
    number(row.shop_level) +
    number(row.bank_level) +
    number(row.factory_level) +
    number(row.casino_level)
  );
}

function casinoSpinReward(level) {
  const lv = Math.max(1, number(level));
  const roll = Math.random();

  if (roll < 0.05) {
    return { reward: 2000 + lv * 500, tier: "jackpot" };
  }
  if (roll < 0.25) {
    return { reward: 500 + lv * 150, tier: "big" };
  }
  if (roll < 0.55) {
    return { reward: 200 + lv * 80, tier: "medium" };
  }
  return { reward: 80 + lv * 40, tier: "small" };
}

function casinoSpunToday(row) {
  return row.casino_date === todayKey();
}

function goldRushActive(row) {
  return number(row.gold_rush_until) > nowMs();
}

function goldRushClaimedToday(row) {
  return row.gold_rush_date === todayKey();
}

function goldRushCanStart(row) {
  return !goldRushClaimedToday(row) && !goldRushActive(row);
}

function tournamentBracketLabel(row) {
  const min = number(row.bracket_min_level);
  const max = number(row.bracket_max_level);
  if (!min && !max) return "All levels";
  if (max > 0) return `Empire Lv ${min || 1}–${max}`;
  return `Empire Lv ${min}+`;
}

function tournamentMatchesLevel(row, level) {
  const min = number(row.bracket_min_level);
  const max = number(row.bracket_max_level);
  if (!min && !max) return true;
  const lv = Math.max(1, number(level));
  const lo = min > 0 ? min : 1;
  const hi = max > 0 ? max : 9999;
  return lv >= lo && lv <= hi;
}

function tapPower(row) {
  const boostActive = number(row.tap_boost_until) > nowMs();
  let power = economy.tapValue(row);
  if (boostActive) power *= 2;
  if (goldRushActive(row)) power *= GOLD_RUSH_MULTIPLIER;
  return Math.floor(power);
}

function incomeMultiplier(row) {
  return number(row.income_boost_until) > nowMs() ? 2 : 1;
}

function buildCityValue(row) {
  return number(row.coins) + number(row.spent);
}

function computeDailyRank(rows, userId, userTickets) {
  if (!userId) return 0;

  const ticketCount = (row) => economy.computeTickets(row.daily_contest_score);

  const sorted = [...rows].sort((a, b) => {
    const byTickets = ticketCount(b) - ticketCount(a);
    if (byTickets !== 0) return byTickets;
    return number(b.daily_contest_score) - number(a.daily_contest_score);
  });
  const index = sorted.findIndex((row) => row.user_id === userId);
  if (index >= 0) return index + 1;

  return 1 + sorted.filter((row) => ticketCount(row) > number(userTickets)).length;
}

function mergeDailyLeaderboardRows(
  today,
  dailyEligibleRows,
  realDailyScores,
  yourDailyGame,
  userId,
  systemBotRows = []
) {
  const merged = [...dailyEligibleRows];

  if (yourDailyGame && userId && !merged.some((row) => row.user_id === userId)) {
    merged.push(yourDailyGame);
  }

  if (systemBotRows.length) {
    merged.push(...systemBotRows);
  } else if (!systemBots.systemBotsEnabled()) {
    const topRealDailyScore = realDailyScores.reduce((max, score) => Math.max(max, score), 0);
    merged.push(...contestSeedGameRows(today, {
      topRealDailyScore,
      realScores: realDailyScores
    }));
  }

  const ticketCount = (row) => economy.computeTickets(row.daily_contest_score);
  const sortByTickets = (a, b) => {
    const byTickets = ticketCount(b) - ticketCount(a);
    if (byTickets !== 0) return byTickets;
    return number(b.daily_contest_score) - number(a.daily_contest_score);
  };

  merged.sort(sortByTickets);

  const byUser = new Map();
  for (const row of merged) {
    const id = row.user_id;
    const existing = byUser.get(id);
    if (!existing || sortByTickets(row, existing) < 0) {
      byUser.set(id, row);
    }
  }

  return Array.from(byUser.values()).sort(sortByTickets);
}

function syncDailyContest(row) {
  const today = todayKey();
  const contestDate = String(row.contest_date || "");

  if (contestDate !== today) {
    return {
      contest_date: today,
      contest_baseline_city: buildCityValue(row),
      daily_contest_score: 0
    };
  }

  return {
    contest_date: contestDate,
    contest_baseline_city: number(row.contest_baseline_city),
    daily_contest_score: number(row.daily_contest_score)
  };
}

function mergeDailyContest(row, patch) {
  const merged = { ...row, ...patch };
  return { ...patch, ...syncDailyContest(merged) };
}

function utcDayEndIso() {
  const now = new Date();
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23,
    59,
    59,
    999
  );
  return new Date(end).toISOString();
}

function safeJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value || "");
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

function adminSecretFromRequest(req) {
  return String(
    req.headers["x-admin-secret"] ||
    req.query.secret ||
    req.body.adminSecret ||
    ""
  ).trim();
}

function requireAdmin(req, res) {
  if (!ADMIN_SECRET) {
    res.status(503).json({ error: "ADMIN_NOT_CONFIGURED" });
    return false;
  }

  if (adminSecretFromRequest(req) !== ADMIN_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return false;
  }

  return true;
}

function requirePlayer(req, res, next) {
  const userId = verifyToken(bearerTokenFromRequest(req));
  if (!userId) {
    res.status(401).json({ error: "SESSION_EXPIRED" });
    return;
  }

  req.playerId = userId;
  next();
}

async function getPlayerTelegramId(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return String(data?.telegram_id || "");
}

function isPremiumSpinAdmin(telegramId, userId = "") {
  const id = String(telegramId || userId || "").trim();
  return id === ADMIN_TELEGRAM_ID;
}

function ipRateLimit(req, res, next) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  if (req.path === "/api/adsgram/reward" || req.path === "/api/session") {
    next();
    return;
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const now = nowMs();
  let bucket = ipRateBuckets.get(ip);

  if (!bucket || now - bucket.start > IP_RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 };
  }

  bucket.count += 1;
  ipRateBuckets.set(ip, bucket);

  if (bucket.count > IP_MAX_HITS) {
    res.status(429).json({ error: "RATE_LIMITED" });
    return;
  }

  next();
}

function nextTapRateState(row) {
  const now = nowMs();
  let windowStart = number(row.tap_window_start);
  let count = number(row.tap_window_count);

  if (!windowStart || now - windowStart >= TAP_RATE_WINDOW_MS) {
    windowStart = now;
    count = 0;
  }

  if (count >= MAX_TAPS_PER_WINDOW) {
    return {
      allowed: false,
      windowStart,
      count,
      violations: number(row.tap_violations) + 1
    };
  }

  return {
    allowed: true,
    windowStart,
    count: count + 1,
    violations: number(row.tap_violations)
  };
}

async function logTapViolation(userId, violations) {
  if (violations % 5 !== 0 && violations < TAP_VIOLATION_ALERT_THRESHOLD) return;

  await logMetric("tap_rate_violation", violations, `user=${userId}`, { userId });
}

function tournamentIsLive(row, ms = nowMs()) {
  if (!row || row.status !== "active") return false;
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();
  return ms >= starts && ms < ends;
}

async function getActiveTournament(userId = "") {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  const live = (data || []).filter((row) => tournamentIsLive(row));
  if (!live.length) return null;

  if (!userId) return live[0];

  let level = 1;
  try {
    const row = await loadGame(userId);
    level = empireLevel(row);
  } catch {
    level = 1;
  }

  return live.find((row) => tournamentMatchesLevel(row, level)) || null;
}

async function getTournamentEntry(tournamentId, userId) {
  const { data, error } = await supabase
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("user_id", String(userId))
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function incrementTournamentScore(userId, amount = 1) {
  const tournament = await getActiveTournament(userId);
  if (!tournament) return;

  const entry = await getTournamentEntry(tournament.id, userId);
  if (!entry) return;

  await supabase
    .from("tournament_entries")
    .update({
      tap_score: number(entry.tap_score) + number(amount)
    })
    .eq("id", entry.id);
}

async function logMetric(metricType, amount, notes = "", extra = {}) {
  await supabase.from("admin_metrics").insert({
    metric_type: metricType,
    amount: number(amount),
    notes: String(notes || ""),
    user_id: extra.userId || null,
    tournament_id: extra.tournamentId || null
  });
}

function toClientTournament(row, entry = null) {
  if (!row) return null;

  const ms = nowMs();
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();

  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    entryFee: number(row.entry_fee),
    prizePool: number(row.prize_pool),
    prizes: {
      winner: number(row.prize_winner),
      runnerUp: number(row.prize_runner_up),
      third: number(row.prize_third)
    },
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isLive: tournamentIsLive(row, ms),
    hasStarted: ms >= starts,
    hasEnded: ms >= ends,
    joined: Boolean(entry),
    myScore: entry ? number(entry.tap_score) : 0,
    bracketMin: number(row.bracket_min_level),
    bracketMax: number(row.bracket_max_level),
    bracketLabel: tournamentBracketLabel(row)
  };
}

function buildDailyTasks(row) {
  const shop = number(row.shop_level);
  const bank = number(row.bank_level);
  const factory = number(row.factory_level);
  const level = Math.max(1, shop + bank + factory);
  const cycleSeed = Number(taskCycleKey());

  const pool = [
    {
      id: "tap-small",
      title: `Tap ${40 + level * 15} times`,
      type: "taps",
      target: 40 + level * 15,
      reward: 100 + level * 25
    },
    {
      id: "tap-big",
      title: `Tap ${100 + level * 30} times`,
      type: "taps",
      target: 100 + level * 30,
      reward: 200 + level * 40
    },
    {
      id: "earn-coins",
      title: `Reach ${Math.max(500, 200 + level * 150)} city value`,
      type: "city_value",
      target: Math.max(500, 200 + level * 150),
      reward: 180 + level * 45
    }
  ];

  if (shop < 12) {
    pool.push({
      id: "upgrade-shop",
      title: `Upgrade Shop to Lv.${shop + 1}`,
      type: "shop_level",
      target: shop + 1,
      reward: 150 + level * 35
    });
  }

  if (bank < 1) {
    pool.push({
      id: "open-bank",
      title: "Open Bank",
      type: "bank_level",
      target: 1,
      reward: 200 + level * 20
    });
  } else if (bank < 10) {
    pool.push({
      id: "upgrade-bank",
      title: `Upgrade Bank to Lv.${bank + 1}`,
      type: "bank_level",
      target: bank + 1,
      reward: 180 + level * 30
    });
  }

  if (factory < 1) {
    pool.push({
      id: "grow-factory",
      title: "Build Factory",
      type: "factory_level",
      target: 1,
      reward: 250 + level * 35
    });
  } else if (factory < 10) {
    pool.push({
      id: "upgrade-factory",
      title: `Upgrade Factory to Lv.${factory + 1}`,
      type: "factory_level",
      target: factory + 1,
      reward: 220 + level * 40
    });
  }

  const start = pool.length ? cycleSeed % pool.length : 0;
  const picked = [];

  for (let i = 0; i < Math.min(TASKS_PER_CYCLE, pool.length); i += 1) {
    picked.push(pool[(start + i) % pool.length]);
  }

  return [...buildSocialTasks(level), ...picked];
}

function buildSocialTasks(level) {
  return [
    {
      id: "social-join-telegram",
      title: "Join Telegram Channel",
      type: "social",
      action: "join_telegram",
      url: SOCIAL_JOIN_TELEGRAM_URL,
      target: 1,
      reward: 120 + level * 10
    }
  ];
}

function ensureSocialTasks(row) {
  const level = Math.max(
    1,
    number(row.shop_level) + number(row.bank_level) + number(row.factory_level)
  );
  const socialTasks = buildSocialTasks(level);
  const rawTasks = safeJson(row.daily_tasks_json, []);
  const currentTasks = Array.isArray(rawTasks)
    ? rawTasks.filter((task) => task && task.id !== "social-follow-x")
    : [];
  const existingIds = new Set(currentTasks.map((task) => task.id));
  const missing = socialTasks.filter((task) => !existingIds.has(task.id));

  if (missing.length === 0 && currentTasks.length === rawTasks.length) {
    return row;
  }

  row.daily_tasks_json = [...missing, ...currentTasks];
  return row;
}

function taskProgress(row, task) {
  if (task.type === "social") return 0;
  if (task.type === "taps") return number(row.taps);
  if (task.type === "city_value") return buildCityValue(row);
  if (task.type === "shop_level") return number(row.shop_level);
  if (task.type === "bank_level") return number(row.bank_level);
  if (task.type === "factory_level") return number(row.factory_level);
  return 0;
}

function taskReady(row, task) {
  if (task.type === "social") return true;
  return taskProgress(row, task) >= number(task.target);
}

function refreshDailyTasks(row) {
  const cycleKey = taskCycleKey();
  const currentTasks = safeJson(row.daily_tasks_json, []);

  const mustCreateTasks =
    row.daily_tasks_date !== cycleKey ||
    !Array.isArray(currentTasks) ||
    currentTasks.length === 0;

  if (!mustCreateTasks) {
    return ensureSocialTasks(row);
  }

  row.daily_tasks_date = cycleKey;
  row.daily_tasks_json = buildDailyTasks(row);
  row.daily_tasks_claimed_json = [];

  return row;
}

function applyPassive(row) {
  const result = economy.applyOfflineProgress(row, {
    incomeMultiplier: incomeMultiplier(row)
  });
  result.row.city_value = buildCityValue(result.row);
  return result.row;
}

function passiveDbPatch(row, contest) {
  return {
    coins: row.coins,
    energy: row.energy,
    max_energy: economy.maxEnergy(row),
    spent: number(row.spent),
    shop_level: number(row.shop_level),
    bank_level: number(row.bank_level),
    factory_level: number(row.factory_level),
    casino_level: number(row.casino_level),
    city_value: row.city_value,
    last_seen_at: row.last_seen_at,
    daily_tasks_date: row.daily_tasks_date,
    daily_tasks_json: row.daily_tasks_json,
    daily_tasks_claimed_json: row.daily_tasks_claimed_json,
    contest_date: contest.contest_date,
    contest_baseline_city: contest.contest_baseline_city,
    daily_contest_score: contest.daily_contest_score,
    updated_at: new Date().toISOString()
  };
}

function attachPassiveMeta(target, source) {
  target.__offlineEarnings = number(source.__offlineEarnings || 0);
  target.__offlineCashAdded = number(source.__offlineCashAdded || 0);
  target.__autoUpgrades = Array.isArray(source.__autoUpgrades) ? source.__autoUpgrades : [];
  return target;
}

function toClientUser(row, extra = {}) {
  const tasks = safeJson(row.daily_tasks_json, []);
  const claimed = safeJson(row.daily_tasks_claimed_json, []);
  const contest = syncDailyContest(row);
  const referralCount = number(extra.referralCount);

  return {
    userId: row.user_id,
    game: {
      coins: number(row.coins),
      totalBalance: number(row.coins),
      energy: number(row.energy),
      currentEnergy: number(row.energy),
      maxEnergy: economy.maxEnergy(row),
      taps: number(row.taps),
      spent: number(row.spent),
      cityValue: buildCityValue(row),
      tapValue: economy.tapValue(row),
      hourlyProfit: economy.totalHourlyProfit(row, incomeMultiplier(row)),
      offlineEarnings: number(extra.offlineEarnings ?? row.__offlineEarnings ?? 0),
      offlineCashAdded: number(extra.offlineCashAdded ?? row.__offlineCashAdded ?? 0),
      autoUpgrades: Array.isArray(extra.autoUpgrades ?? row.__autoUpgrades)
        ? (extra.autoUpgrades ?? row.__autoUpgrades)
        : [],
      autoBuyEnabled: number(row.bank_level) >= economy.AUTO_BUY_MIN_BANK_LEVEL,
      dailyScore: number(contest.daily_contest_score),
      tickets: economy.computeTickets(contest.daily_contest_score),
      ticketProgress: economy.scoreProgressToNextTicket(contest.daily_contest_score),
      dailyDate: row.daily_date || "",
      dailyStreak: number(row.daily_streak),
      dailyTasksDate: row.daily_tasks_date || "",
      dailyTasksNextRefresh: new Date(nextTaskRefreshMs()).toISOString(),
      dailyReward: {
        streak: number(row.daily_streak),
        claimedToday: dailyRewardClaimedToday(row),
        nextAmount: dailyRewardAmount(row)
      },
      boosts: {
        tapActive: number(row.tap_boost_until) > nowMs(),
        incomeActive: number(row.income_boost_until) > nowMs(),
        endlessActive: hasEndlessEnergy(row),
        tapUntil: number(row.tap_boost_until),
        incomeUntil: number(row.income_boost_until),
        endlessUntil: number(row.endless_energy_until)
      },
      dailyTasks: tasks.map((task) => ({
        ...task,
        progress: taskProgress(row, task),
        ready: taskReady(row, task),
        claimed: claimed.includes(task.id)
      })),
      tasks: {
        tap100: Boolean(row.tap100_done),
        earn500: Boolean(row.earn500_done),
        shopUpgrade: Boolean(row.shop_upgrade_done),
        bankOpen: Boolean(row.bank_open_done),
        invite: Boolean(row.invite_done),
        sponsor: Boolean(row.sponsor_done),
        channel: Boolean(row.channel_done)
      },
      adReward: {
        nextAt: adRewardNextAt(row),
        reward: EARN_TASKS.ad.reward,
        cooldownMs: AD_REWARD_COOLDOWN_MS
      },
      bonusAdReward: {
        nextAt: bonusAdRewardNextAt(row),
        reward: EARN_TASKS.bonus_ad.reward,
        cooldownMs: BONUS_AD_REWARD_COOLDOWN_MS
      },
      buildings: {
        shop: number(row.shop_level),
        bank: number(row.bank_level),
        factory: number(row.factory_level),
        casino: number(row.casino_level)
      },
      empireLevel: empireLevel(row),
      casino: {
        level: number(row.casino_level),
        spunToday: casinoSpunToday(row),
        canSpin: number(row.casino_level) >= 1 && !casinoSpunToday(row)
      },
      goldRush: {
        active: goldRushActive(row),
        until: number(row.gold_rush_until),
        claimedToday: goldRushClaimedToday(row),
        canStart: goldRushCanStart(row),
        multiplier: GOLD_RUSH_MULTIPLIER,
        durationMinutes: Math.round(GOLD_RUSH_DURATION_MS / 60000)
      },
      dailyContest: {
        score: contest.daily_contest_score,
        date: contest.contest_date,
        resetsAt: utcDayEndIso(),
        minReferrals: DAILY_PRIZE_MIN_REFERRALS,
        eligible: dailyPrizeEligible(referralCount),
        tickets: economy.computeTickets(contest.daily_contest_score),
        ticketProgress: economy.scoreProgressToNextTicket(contest.daily_contest_score)
      },
      referrals: {
        count: referralCount,
        friendsInvited: referralCount,
        required: DAILY_PRIZE_MIN_REFERRALS,
        eligible: dailyPrizeEligible(referralCount)
      }
    }
  };
}

async function isOfficialChannelMember(telegramId) {
  const check = await checkOfficialChannelMembership(telegramId);
  return Boolean(check.isMember);
}

async function creditReferrerCoins(referrerId) {
  const referrer = String(referrerId || "");
  if (!referrer) return;

  const { data: refRow } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", referrer)
    .maybeSingle();

  if (!refRow) return;

  const bonus = REFERRAL_BONUS;

  await supabase
    .from("game_states")
    .update({
      coins: number(refRow.coins) + bonus,
      city_value: number(refRow.coins) + bonus + number(refRow.spent),
      invite_done: true,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", referrer);
}

async function registerPendingReferral(referrerId, newUserId, options = {}) {
  const referrer = String(referrerId || "");
  const newbie = String(newUserId || "");

  if (!referrer || !newbie || referrer === newbie) return false;

  return recordReferral(referrer, newbie, {
    ...options,
    status: REFERRAL_STATUS_PENDING_CHANNEL
  });
}

async function qualifyReferralIfPending(referredUserId) {
  const referred = String(referredUserId || "");
  if (!referred) return false;

  const { data: pending, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_user_id", referred)
    .eq("status", REFERRAL_STATUS_PENDING_CHANNEL)
    .maybeSingle();

  if (error) throw error;
  if (!pending) return false;

  const referrer = String(pending.referrer_id || "");
  if (!referrer || referrer === referred) return false;

  const { error: updateError } = await supabase
    .from("referrals")
    .update({
      status: REFERRAL_STATUS_QUALIFIED,
      reject_reason: ""
    })
    .eq("id", pending.id)
    .eq("status", REFERRAL_STATUS_PENDING_CHANNEL);

  if (updateError) throw updateError;

  await creditReferrerCoins(referrer);

  const qualifiedCount = await getReferralCount(referrer);
  await supabase
    .from("users")
    .update({
      referral_count: qualifiedCount
    })
    .eq("id", referrer);

  return true;
}

async function isReferralBotAccount(userId, options = {}) {
  if (options.isBot === true) return true;
  if (options.isBot === false) return false;
  if (String(userId) === "web_demo") return true;

  const lookup = await telegramApiSafe("getChat", { chat_id: Number(userId) });
  if (!lookup.ok) {
    if (String(lookup.error || "").toLowerCase().includes("user not found")) {
      return false;
    }
    console.warn("REFERRAL_BOT_LOOKUP_FAILED:", lookup.error);
    return false;
  }

  return Boolean(lookup.result?.is_bot);
}

async function recordReferral(referrerId, referredUserId, options = {}) {
  const referrer = String(referrerId || "");
  const referred = String(referredUserId || "");
  const status = String(options.status || REFERRAL_STATUS_QUALIFIED);

  if (!referrer || !referred || referrer === referred) return false;

  const isBot = await isReferralBotAccount(referred, options);
  if (isBot) {
    const { error } = await supabase.from("referrals").upsert({
      referrer_id: referrer,
      referred_user_id: referred,
      status: REFERRAL_STATUS_REJECTED_BOT,
      reject_reason: "telegram_bot"
    }, { onConflict: "referred_user_id" });

    if (error && error.code !== "23505") {
      console.error("REFERRAL_BOT_REJECT_ERROR:", error);
    }

    await logMetric("referral_bot_blocked", 1, `referrer=${referrer}`, {
      userId: referrer
    });
    return false;
  }

  const { error } = await supabase.from("referrals").insert({
    referrer_id: referrer,
    referred_user_id: referred,
    status,
    reject_reason: ""
  });

  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }

  if (status === REFERRAL_STATUS_QUALIFIED) {
    const qualifiedCount = await getReferralCount(referrer);

    await supabase
      .from("users")
      .update({
        referral_count: qualifiedCount
      })
      .eq("id", referrer);
  }

  return true;
}

async function getReferralCount(userId) {
  const { count, error } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", String(userId))
    .eq("status", REFERRAL_STATUS_QUALIFIED);

  if (error) throw error;
  return number(count);
}

async function getReferralCounts(userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  const counts = new Map();

  for (const id of ids) counts.set(id, 0);
  if (!ids.length) return counts;

  const { data, error } = await supabase
    .from("referrals")
    .select("referrer_id")
    .in("referrer_id", ids)
    .eq("status", REFERRAL_STATUS_QUALIFIED);

  if (error) throw error;

  for (const row of data || []) {
    counts.set(row.referrer_id, (counts.get(row.referrer_id) || 0) + 1);
  }

  return counts;
}

function dailyPrizeEligible(referralCount) {
  return number(referralCount) >= DAILY_PRIZE_MIN_REFERRALS;
}

const DAILY_PRIZE_AMOUNT = Math.max(1, Number(process.env.DAILY_PRIZE_AMOUNT || 10));
const DAILY_LEADERBOARD_LIMIT = Math.max(
  3,
  Number(process.env.DAILY_LEADERBOARD_LIMIT || 10)
);

function formatDailyWinnerLabel(winner) {
  if (!winner) return "";

  const handle = winner.username
    ? (String(winner.username).startsWith("@") ? winner.username : `@${winner.username}`)
    : (winner.displayName || winner.label || "Player");
  const tickets = number(winner.tickets);

  return `${handle} (🎟️ ${tickets} Ticket${tickets === 1 ? "" : "s"})`;
}

async function getLatestDailyWinner() {
  const { data, error } = await supabase
    .from("daily_winners")
    .select("*")
    .order("contest_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const fallback = systemBots.randomYesterdayBotWinner(yesterdayKey());
    return {
      ...fallback,
      label: formatDailyWinnerLabel(fallback)
    };
  }

  const username = String(data.username || "").trim();
  const displayName = data.display_name || `Player ${String(data.user_id).slice(-4)}`;
  const tickets = number(data.tickets);
  const winner = {
    contestDate: data.contest_date,
    userId: data.user_id,
    username: username || displayName,
    displayName,
    score: number(data.daily_score),
    tickets,
    prize: number(data.prize_amount),
    currency: data.prize_currency || "USD",
    drawnAt: data.drawn_at
  };

  return {
    ...winner,
    label: formatDailyWinnerLabel(winner)
  };
}

async function resetDailyContestForAll() {
  const today = todayKey();
  const { error } = await supabase.rpc("reset_daily_contest", { p_today: today });
  if (error) throw error;
  await systemBots.resetSystemBots(supabase, today);
}

async function runDailyLottery(contestDate = yesterdayKey()) {
  const { data: existing, error: existingError } = await supabase
    .from("daily_winners")
    .select("id")
    .eq("contest_date", contestDate)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return { ok: true, skipped: true, reason: "ALREADY_DRAWN", contestDate };
  }

  const minScore = economy.TICKETS_PER_SCORE;
  const { data: candidates, error } = await supabase
    .from("game_states")
    .select("user_id, daily_contest_score, contest_date")
    .eq("contest_date", contestDate)
    .gte("daily_contest_score", minScore);

  if (error) throw error;

  const candidateIds = (candidates || [])
    .map((row) => row.user_id)
    .filter((userId) => userId && !String(userId).startsWith("contest_seed"));

  const referralCounts = await getReferralCounts(candidateIds);
  const eligible = (candidates || []).filter((row) => {
    if (!row.user_id || String(row.user_id).startsWith("contest_seed")) return false;
    return dailyPrizeEligible(referralCounts.get(row.user_id) || 0);
  });

  if (!eligible.length) {
    await resetDailyContestForAll();
    return { ok: true, skipped: true, reason: "NO_ELIGIBLE_PLAYERS", contestDate };
  }

  const bag = [];
  for (const row of eligible) {
    const tickets = economy.computeTickets(row.daily_contest_score);
    for (let i = 0; i < tickets; i += 1) {
      bag.push(row.user_id);
    }
  }

  if (!bag.length) {
    await resetDailyContestForAll();
    return { ok: true, skipped: true, reason: "NO_TICKETS", contestDate };
  }

  const winnerId = bag[Math.floor(Math.random() * bag.length)];
  const winnerRow = eligible.find((row) => row.user_id === winnerId);
  const winnerScore = number(winnerRow?.daily_contest_score);
  const winnerTickets = economy.computeTickets(winnerScore);

  const { data: winnerUser } = await supabase
    .from("users")
    .select("username, first_name")
    .eq("id", winnerId)
    .maybeSingle();

  const displayName = winnerUser?.first_name || `Player ${String(winnerId).slice(-4)}`;
  const username = String(winnerUser?.username || "").trim();

  const { error: insertError } = await supabase.from("daily_winners").insert({
    contest_date: contestDate,
    user_id: winnerId,
    username,
    display_name: displayName,
    daily_score: winnerScore,
    tickets: winnerTickets,
    prize_amount: DAILY_PRIZE_AMOUNT,
    prize_currency: "USD"
  });

  if (insertError) throw insertError;

  await resetDailyContestForAll();

  await logMetric("daily_lottery_winner", winnerTickets, `winner=${winnerId}`, {
    userId: winnerId,
    contestDate,
    entries: bag.length
  });

  return {
    ok: true,
    contestDate,
    winnerId,
    winnerLabel: username ? `@${username}` : displayName,
    tickets: winnerTickets,
    entries: bag.length,
    eligiblePlayers: eligible.length
  };
}

async function ensureUserProfile(telegramUser) {
  const telegramId = String(telegramUser?.id || "");
  const name = telegramUser?.first_name || "Player";
  const username = telegramUser?.username || "";

  if (!telegramId) {
    const error = new Error("TELEGRAM_USER_ID_MISSING");
    error.code = "TELEGRAM_USER_ID_MISSING";
    throw error;
  }

  if (Boolean(telegramUser?.is_bot)) {
    const error = new Error("BOTS_NOT_ALLOWED");
    error.code = "BOTS_NOT_ALLOWED";
    throw error;
  }

  const { error: userError } = await supabase.from("users").upsert({
    id: telegramId,
    telegram_id: telegramId,
    first_name: name,
    username,
    last_seen_at: new Date().toISOString()
  });

  if (userError) throw userError;

  const { data: existing, error: existingError } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", telegramId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    let row = refreshDailyTasks(applyPassive(existing));
    const contest = syncDailyContest(row);

    const { data: saved, error } = await supabase
      .from("game_states")
      .update(passiveDbPatch(row, contest))
      .eq("user_id", telegramId)
      .select("*")
      .single();

    if (error) throw error;
    return {
      row: attachPassiveMeta(saved, row),
      isNew: false
    };
  }

  const fresh = refreshDailyTasks({
    user_id: telegramId,
    coins: NEW_PLAYER_BONUS,
    energy: MAX_ENERGY,
    max_energy: MAX_ENERGY,
    taps: 0,
    spent: 0,
    city_value: NEW_PLAYER_BONUS,
    shop_level: 1,
    bank_level: 0,
    factory_level: 0,
    casino_level: 0,
    casino_date: "",
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const { data, error } = await supabase
    .from("game_states")
    .insert(fresh)
    .select("*")
    .single();

  if (error) throw error;
  return {
    row: data,
    isNew: true
  };
}

async function registerPendingReferralIfNew(telegramUser, referrerId) {
  const telegramId = String(telegramUser?.id || "");
  const referrer = parseReferrerId(referrerId);

  if (!telegramId || !referrer || referrer === telegramId) return false;

  const { data: existingReferral, error: existingError } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_user_id", telegramId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingReferral) return false;

  return registerPendingReferral(referrer, telegramId, {
    isBot: Boolean(telegramUser?.is_bot)
  });
}

async function getOrCreatePlayer(telegramUser, referrerId = "") {
  const { row } = await ensureUserProfile(telegramUser);

  try {
    await registerPendingReferralIfNew(telegramUser, referrerId);
  } catch (error) {
    console.warn("PENDING_REFERRAL_REGISTER_FAILED:", error.message);
  }

  return row;
}

async function loadGame(userId) {
  const { data, error } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", String(userId))
    .single();

  if (error) throw error;

  let row = refreshDailyTasks(applyPassive(data));
  const contest = syncDailyContest(row);

  const { data: saved, error: saveError } = await supabase
    .from("game_states")
    .update(passiveDbPatch(row, contest))
    .eq("user_id", String(userId))
    .select("*")
    .single();

  if (saveError) throw saveError;
  return attachPassiveMeta(saved, row);
}

app.get("/", (_req, res) => {
  res.json({ ok: true, app: "Wealthia API", database: true, version: "stars-bot-embedded-v1" });
});

async function checkTelegramBot() {
  const token = TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { configured: false, ok: false, username: "" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    return {
      configured: true,
      ok: Boolean(data.ok),
      username: data.result?.username || ""
    };
  } catch {
    return { configured: true, ok: false, username: "" };
  }
}

app.get("/health", async (_req, res) => {
  let database = false;

  try {
    const { error } = await supabase.from("users").select("id").limit(1);
    database = !error;
  } catch {
    database = false;
  }

  const telegram = await checkTelegramBot();
  let officialChannel = { ok: false, username: OFFICIAL_CHANNEL_USERNAME };
  let stars = { productionMode: telegramStars.STARS_PRODUCTION_MODE, balance: 0, webhook: false };

  if (telegram.ok) {
    try {
      officialChannel = await inspectOfficialChannelAccess();
    } catch (error) {
      officialChannel = {
        ok: false,
        username: OFFICIAL_CHANNEL_USERNAME,
        error: error.message || "CHANNEL_CHECK_FAILED"
      };
    }

    const balance = await telegramStars.getBotStarBalance(telegramApiSafe);
    stars.balance = balance.amount;
    stars.balanceOk = balance.ok;
    stars.webhook = Boolean(TELEGRAM_WEBHOOK_SECRET && WEBHOOK_BASE_URL);
  }

  res.json({
    ok: true,
    app: "Wealthia API",
    database,
    telegram,
    officialChannel,
    stars,
    session: {
      configured: Boolean(TELEGRAM_BOT_TOKEN || process.env.SESSION_SECRET || ADMIN_SECRET)
    },
    version: "stars-production-webhook-v1"
  });
});

// AdsGram server-side reward callback (GET; userid=[userId] replaced by AdsGram)
app.get("/api/adsgram/reward", (_req, res) => {
  res.status(200).send("ok");
});

app.post("/api/session", async (req, res) => {
  try {
    const telegramUser = resolveTelegramUser(req);
    if (!telegramUser) {
      res.status(401).json({
        error: "INVALID_TELEGRAM_AUTH",
        reason: authFailureReason(req) || "UNKNOWN"
      });
      return;
    }

    const referrerId = parseReferrerId(
      req.body.referrerId || req.body.referralId || telegramUser.start_param
    );

    let row;
    let isNewPlayer = false;
    try {
      const profile = await ensureUserProfile(telegramUser);
      row = profile.row;
      isNewPlayer = Boolean(profile.isNew);
    } catch (profileError) {
      console.error("ENSURE_USER_PROFILE_FAILED:", profileError);
      if (profileError.code === "BOTS_NOT_ALLOWED") {
        res.status(403).json({ error: "BOTS_NOT_ALLOWED" });
        return;
      }
      res.status(503).json({
        error: "CONNECTION_ERROR",
        message: CONNECTION_ERROR_MESSAGE
      });
      return;
    }

    try {
      await registerPendingReferralIfNew(telegramUser, referrerId);
    } catch (referralError) {
      console.warn("PENDING_REFERRAL_REGISTER_FAILED:", referralError.message);
    }

    const enforceChannelGate = isNewPlayer || await hasPendingChannelReferral(telegramUser.id);
    if (enforceChannelGate) {
      const channelCheck = await checkOfficialChannelMembership(telegramUser.id);

      if (channelCheck.skipped) {
        console.warn("OFFICIAL_CHANNEL_CHECK_SKIPPED:", channelCheck.error);
      } else if (!channelCheck.isMember) {
        res.json({
          userId: telegramUser.id,
          channelRequired: true,
          channelUrl: getOfficialChannelUrl(),
          channelMessage: "Please subscribe to our official channel to unlock the game"
        });
        return;
      }
    }

    try {
      await qualifyReferralIfPending(telegramUser.id);
    } catch (qualifyError) {
      console.warn("QUALIFY_REFERRAL_FAILED:", qualifyError.message);
    }

    const session = createSessionToken(telegramUser.id);
    let referralCount = 0;
    try {
      referralCount = await getReferralCount(telegramUser.id);
    } catch (countError) {
      console.warn("REFERRAL_COUNT_FAILED:", countError.message);
    }

    res.json({
      ...toClientUser(row, {
        referralCount,
        offlineEarnings: number(row.__offlineEarnings || 0),
        offlineCashAdded: number(row.__offlineCashAdded || 0),
        autoUpgrades: row.__autoUpgrades || []
      }),
      token: session.token,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error("SESSION_ERROR:", error);
    if (error.code === "BOTS_NOT_ALLOWED") {
      res.status(403).json({ error: "BOTS_NOT_ALLOWED" });
      return;
    }
    res.status(503).json({
      error: "CONNECTION_ERROR",
      message: CONNECTION_ERROR_MESSAGE
    });
  }
});
app.post("/api/gold-rush/start", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const row = await loadGame(userId);

    if (!goldRushCanStart(row)) {
      if (goldRushActive(row)) {
        res.status(400).json({ error: "GOLD_RUSH_ACTIVE", until: number(row.gold_rush_until) });
        return;
      }
      res.status(400).json({ error: "GOLD_RUSH_CLAIMED_TODAY" });
      return;
    }

    const until = nowMs() + GOLD_RUSH_DURATION_MS;
    const { data, error } = await supabase
      .from("game_states")
      .update({
        gold_rush_date: todayKey(),
        gold_rush_until: until,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, until, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tap", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const row = await loadGame(userId);
    const endless = hasEndlessEnergy(row);
    const rate = nextTapRateState(row);

    if (!rate.allowed) {
      await supabase
        .from("game_states")
        .update({
          tap_window_start: rate.windowStart,
          tap_window_count: rate.count,
          tap_violations: rate.violations,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      await logTapViolation(userId, rate.violations);
      res.status(429).json({ error: "TOO_FAST", retryAfterMs: TAP_RATE_WINDOW_MS });
      return;
    }

    if (!endless && number(row.energy) < economy.tapValue(row)) {
      res.status(400).json({ error: "NO_ENERGY" });
      return;
    }

    const amount = tapPower(row);
    const tapCost = economy.tapValue(row);
    const today = todayKey();
    let dailyScore = number(row.daily_contest_score);
    if (row.contest_date !== today) {
      dailyScore = 0;
    }

    const updated = {
      coins: number(row.coins) + amount,
      energy: endless ? number(row.energy) : Math.max(0, number(row.energy) - tapCost),
      taps: number(row.taps) + 1,
      daily_contest_score: dailyScore + amount,
      contest_date: today,
      contest_baseline_city: row.contest_date === today
        ? number(row.contest_baseline_city)
        : buildCityValue(row),
      city_value: number(row.coins) + amount + number(row.spent),
      tap_window_start: rate.windowStart,
      tap_window_count: rate.count,
      tap_violations: rate.violations,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("game_states")
      .update(updated)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    await incrementTournamentScore(userId, 1);

    res.json({ amount, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/upgrade", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const building = String(req.body.building || "");

    if (!["shop", "bank", "factory", "casino"].includes(building)) {
      res.status(400).json({ error: "BAD_BUILDING" });
      return;
    }

    const row = await loadGame(userId);
    const column = `${building}_level`;
    const level = number(row[column]);
    const cost = upgradeCost(building, building === "shop" ? level : level + 1);

    if (number(row.coins) < cost) {
      res.status(400).json({ error: "NOT_ENOUGH_COINS" });
      return;
    }

    const updated = mergeDailyContest(row, {
      coins: number(row.coins) - cost,
      spent: number(row.spent) + cost,
      [column]: level + 1,
      city_value: number(row.coins) - cost + number(row.spent) + cost,
      updated_at: new Date().toISOString()
    });

    const { data, error } = await supabase
      .from("game_states")
      .update(updated)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ cost, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/claim-task", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const taskId = String(req.body.task || "");

    const row = await loadGame(userId);
    const tasks = safeJson(row.daily_tasks_json, []);
    const claimed = safeJson(row.daily_tasks_claimed_json, []);
    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      res.status(404).json({ error: "TASK_NOT_FOUND" });
      return;
    }

    if (claimed.includes(task.id)) {
      res.status(400).json({ error: "TASK_ALREADY_CLAIMED" });
      return;
    }

    if (!taskReady(row, task)) {
      res.status(400).json({ error: "TASK_NOT_READY" });
      return;
    }

    const reward = number(task.reward);
    const updatedClaimed = [...claimed, task.id];

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        daily_tasks_claimed_json: updatedClaimed,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, reward, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/claim-daily", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const row = await loadGame(userId);

    if (dailyRewardClaimedToday(row)) {
      res.status(400).json({ error: "ALREADY_CLAIMED" });
      return;
    }

    const streak = nextDailyStreak(row);
    const reward = dailyRewardAmount(row);

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        daily_date: todayKey(),
        daily_streak: streak,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, reward, streak, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/claim-earn", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const type = String(req.body.type || "");
    const earnTask = EARN_TASKS[type];

    if (!earnTask) {
      res.status(400).json({ error: "BAD_EARN_TYPE" });
      return;
    }

    const row = await loadGame(userId);

    if (type === "ad") {
      if (adRewardOnCooldown(row)) {
        res.status(400).json({ error: "AD_COOLDOWN", nextAt: adRewardNextAt(row) });
        return;
      }

      const reward = EARN_TASKS.ad.reward;

      const { data, error } = await supabase
        .from("game_states")
        .update({
          coins: number(row.coins) + reward,
          city_value: number(row.coins) + reward + number(row.spent),
          ad_last_claimed_at: nowMs(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;

      res.json({ ok: true, reward, user: toClientUser(data) });
      return;
    }

    if (type === "bonus_ad") {
      if (bonusAdRewardOnCooldown(row)) {
        res.status(400).json({ error: "BONUS_AD_COOLDOWN", nextAt: bonusAdRewardNextAt(row) });
        return;
      }

      const reward = EARN_TASKS.bonus_ad.reward;

      const { data, error } = await supabase
        .from("game_states")
        .update({
          coins: number(row.coins) + reward,
          city_value: number(row.coins) + reward + number(row.spent),
          bonus_ad_last_claimed_at: nowMs(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;

      res.json({ ok: true, reward, user: toClientUser(data) });
      return;
    }

    if (Boolean(row[earnTask.field])) {
      res.status(400).json({ error: "ALREADY_CLAIMED" });
      return;
    }

    const reward = earnTask.reward;

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        [earnTask.field]: true,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, reward, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/buy-boost", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const boost = String(req.body.boost || "");
    const option = BOOST_OPTIONS[boost];

    if (!option) {
      res.status(400).json({ error: "BAD_BOOST" });
      return;
    }

    const row = await loadGame(userId);

    if (number(row.coins) < option.cost) {
      res.status(400).json({ error: "NOT_ENOUGH_COINS" });
      return;
    }

    const updated = {
      coins: number(row.coins) - option.cost,
      city_value: number(row.coins) - option.cost + number(row.spent),
      updated_at: new Date().toISOString()
    };

    if (option.type === "energy") {
      updated.energy = economy.maxEnergy(row);
    }

    if (option.type === "tap") {
      updated.tap_boost_until = nowMs() + BOOST_DURATION_MS;
    }

    if (option.type === "income") {
      updated.income_boost_until = nowMs() + BOOST_DURATION_MS;
    }

    const { data, error } = await supabase
      .from("game_states")
      .update(updated)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, boost, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stars/products", (_req, res) => {
  const products = Object.entries(STAR_PRODUCTS).map(([id, product]) => ({
    id,
    stars: product.stars,
    title: product.title,
    description: product.description
  }));

  res.json({ ok: true, products });
});

app.post("/api/stars/invoice", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const productId = String(req.body.productId || "");
    const product = STAR_PRODUCTS[productId];

    if (!userId || !product) {
      res.status(400).json({ error: "BAD_PRODUCT" });
      return;
    }

    if (!TELEGRAM_BOT_TOKEN) {
      res.status(503).json({ error: "STARS_NOT_CONFIGURED" });
      return;
    }

    if (!telegramStars.STARS_PRODUCTION_MODE) {
      res.status(503).json({ error: "STARS_TEST_MODE_DISABLED" });
      return;
    }

    const invoiceLink = await telegramApi(
      "createInvoiceLink",
      telegramStars.buildStarsInvoiceBody({
        title: product.title,
        description: product.description,
        payload: starPayload(userId, productId),
        stars: product.stars
      })
    );

    res.json({
      ok: true,
      invoiceLink,
      productionMode: true,
      product: {
        id: productId,
        stars: product.stars,
        title: product.title
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/telegram/webhook/:secret", async (req, res) => {
  if (!TELEGRAM_WEBHOOK_SECRET || req.params.secret !== TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  res.json({ ok: true });

  const update = req.body;
  if (!update || typeof update !== "object") return;

  try {
    if (update.pre_checkout_query) {
      await telegramStars.answerPreCheckoutQuery(
        telegramApiSafe,
        update.pre_checkout_query,
        {
          starProducts: STAR_PRODUCTS,
          parseStarPayload
        }
      );
      return;
    }

    if (update.message?.successful_payment) {
      await telegramStars.handleSuccessfulPayment(update.message, getTelegramStarsOptions());
    }
  } catch (error) {
    console.error("TELEGRAM_WEBHOOK_ERROR:", error.message);
  }
});

app.post("/api/stars/fulfill", async (req, res) => {
  try {
    const secret = String(req.body.secret || "");
    if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }

    const result = await fulfillStarPaymentRecord({
      userId: String(req.body.userId || ""),
      productId: String(req.body.productId || ""),
      chargeId: String(req.body.chargeId || ""),
      stars: number(req.body.stars),
      invoicePayload: String(req.body.invoicePayload || "")
    });

    res.json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      productId: result.productId,
      user: toClientUser(result.user),
      premiumSpinReady: Boolean(result.premiumSpinReady)
    });
  } catch (error) {
    if (error.code === "FRAUD_REPLAY") {
      res.status(409).json({ error: "FRAUD_REPLAY", duplicate: true });
      return;
    }
    if (error.code === "INVALID_PAYLOAD") {
      res.status(400).json({ error: "INVALID_PAYLOAD" });
      return;
    }
    if (error.code === "INVALID_STARS_AMOUNT") {
      res.status(400).json({ error: "INVALID_STARS_AMOUNT" });
      return;
    }
    if (error.code === "INVALID_CHARGE_ID") {
      res.status(400).json({ error: "INVALID_CHARGE_ID" });
      return;
    }
    if (error.code === "BAD_REQUEST" || error.code === "BAD_PRODUCT") {
      res.status(400).json({ error: error.code });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/casino-spin", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const row = await loadGame(userId);

    if (number(row.casino_level) < 1) {
      res.status(400).json({ error: "CASINO_LOCKED" });
      return;
    }

    if (casinoSpunToday(row)) {
      res.status(400).json({ error: "ALREADY_SPUN" });
      return;
    }

    const spin = casinoSpinReward(row.casino_level);
    const reward = spin.reward;

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        casino_date: todayKey(),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({
      ok: true,
      reward,
      tier: spin.tier,
      user: toClientUser(data)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/premium-spin/status",
  requireVerifiedTelegramPlayer,
  premiumSpinSecurity.premiumSpinRateLimit,
  async (req, res) => {
  try {
    const userId = req.playerId;
    const telegramId = await getPlayerTelegramId(userId);
    const adminBypass = isPremiumSpinAdmin(telegramId, userId);
    const payment = adminBypass
      ? null
      : await premiumSpin.findPendingPremiumPayment(supabase, userId);

    res.json({
      ok: true,
      ready: adminBypass || Boolean(payment),
      chargeId: payment?.charge_id || "",
      adminBypass
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/premium-spin",
  requireVerifiedTelegramPlayer,
  premiumSpinSecurity.premiumSpinRateLimit,
  async (req, res) => {
  try {
    const userId = req.playerId;

    if (
      req.body.prize ||
      req.body.segmentIndex !== undefined ||
      req.body.prizeId ||
      req.body.chargeId
    ) {
      await premiumSpinSecurity.logFraudEvent(supabase, {
        userId,
        eventType: "REQUEST_TAMPER",
        detail: JSON.stringify({
          prize: req.body.prize,
          segmentIndex: req.body.segmentIndex,
          prizeId: req.body.prizeId,
          chargeId: req.body.chargeId
        }).slice(0, 500)
      });
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }

    const { data: buyer, error: buyerError } = await supabase
      .from("users")
      .select("first_name, username, telegram_id")
      .eq("id", userId)
      .maybeSingle();

    if (buyerError) throw buyerError;

    const adminBypass = isPremiumSpinAdmin(buyer?.telegram_id, userId);
    let payment = null;

    if (!adminBypass) {
      payment = await premiumSpin.findPendingPremiumPayment(supabase, userId);

      if (!payment) {
        res.status(402).json({ error: "NO_PAYMENT" });
        return;
      }

      if (number(payment.stars_amount) !== premiumSpin.PREMIUM_SPIN_STARS) {
        await premiumSpinSecurity.logFraudEvent(supabase, {
          userId,
          eventType: "INVALID_PAYMENT_AMOUNT",
          detail: `payment_id=${payment.id}`
        });
        res.status(403).json({ error: "INVALID_PAYMENT" });
        return;
      }

      const now = new Date().toISOString();
      const { data: consumed, error: consumeError } = await supabase
        .from("star_payments")
        .update({ consumed_at: now })
        .eq("id", payment.id)
        .eq("user_id", userId)
        .eq("product_id", "premium_spin")
        .is("consumed_at", null)
        .select("id")
        .maybeSingle();

      if (consumeError) throw consumeError;
      if (!consumed) {
        await premiumSpinSecurity.logFraudEvent(supabase, {
          userId,
          eventType: "PAYMENT_REPLAY_RACE",
          detail: `payment_id=${payment.id}`
        });
        res.status(409).json({ error: "FRAUD_REPLAY" });
        return;
      }
    }

    const globalSpins = adminBypass
      ? await premiumSpin.getGlobalPremiumSpins(supabase)
      : await premiumSpin.incrementGlobalPremiumSpins(supabase);
    const prize = premiumSpin.rollPremiumPrize(globalSpins, { adminTest: adminBypass });
    const row = await loadGame(userId);

    const username = String(buyer?.username || "").trim();
    const displayName = buyer?.first_name || `Player ${String(userId).slice(-4)}`;

    if (prize.type === "cash" && !adminBypass) {
      await premiumSpin.createPendingPayout(supabase, {
        userId,
        username,
        displayName,
        amountUsd: prize.amount,
        prizeId: prize.id,
        spinPaymentId: payment.id
      });
    }

    const productUpdate = premiumSpin.buildPremiumSpinUpdate(row, prize, extendBoostUntil);

    let saved = row;
    if (Object.keys(productUpdate).length > 1) {
      const { data, error } = await supabase
        .from("game_states")
        .update(productUpdate)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;
      saved = data;
    }

    res.json({
      ok: true,
      prize: premiumSpinSecurity.sanitizePremiumSpinPrize(prize),
      user: toClientUser(saved)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reset", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const mode = String(req.body.mode || "full");

    if (mode === "daily") {
      const row = await loadGame(userId);
      const today = todayKey();
      const cityValue = buildCityValue(row);
      const { data, error } = await supabase
        .from("game_states")
        .update({
          contest_date: today,
          contest_baseline_city: cityValue,
          daily_contest_score: 0,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;

      res.json({ ok: true, user: toClientUser(data) });
      return;
    }

    if (mode === "earn") {
      if (process.env.ALLOW_EARN_RESET === "false") {
        res.status(403).json({ error: "EARN_RESET_DISABLED" });
        return;
      }

      const row = await loadGame(userId);
      let coins = number(row.coins);
      const onlyType = String(req.body.type || "").trim();

      const update = {
        coins,
        city_value: coins + number(row.spent),
        updated_at: new Date().toISOString()
      };

      if (!onlyType || onlyType === "ad") {
        if (number(row.ad_last_claimed_at) > 0 && adRewardOnCooldown(row)) {
          coins = Math.max(0, coins - EARN_TASKS.ad.reward);
        }
        update.ad_last_claimed_at = 0;
      }
      if (!onlyType || onlyType === "bonus_ad") {
        if (number(row.bonus_ad_last_claimed_at) > 0 && bonusAdRewardOnCooldown(row)) {
          coins = Math.max(0, coins - EARN_TASKS.bonus_ad.reward);
        }
        update.bonus_ad_last_claimed_at = 0;
      }
      if (!onlyType || onlyType === "sponsor") {
        if (Boolean(row.sponsor_done)) coins = Math.max(0, coins - EARN_TASKS.sponsor.reward);
      }
      if (!onlyType || onlyType === "channel") {
        if (Boolean(row.channel_done)) coins = Math.max(0, coins - EARN_TASKS.channel.reward);
      }

      update.coins = coins;
      update.city_value = coins + number(row.spent);

      if (!onlyType || onlyType === "sponsor") update.sponsor_done = false;
      if (!onlyType || onlyType === "channel") update.channel_done = false;

      const { data, error } = await supabase
        .from("game_states")
        .update(update)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;

      res.json({ ok: true, user: toClientUser(data) });
      return;
    }

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: NEW_PLAYER_BONUS,
        energy: MAX_ENERGY,
        max_energy: MAX_ENERGY,
        taps: 0,
        spent: 0,
        city_value: NEW_PLAYER_BONUS,
        shop_level: 1,
        bank_level: 0,
        factory_level: 0,
        casino_level: 0,
        daily_date: "",
        daily_streak: 0,
        daily_tasks_date: "",
        daily_tasks_json: [],
        daily_tasks_claimed_json: [],
        sponsor_done: false,
        ad_last_claimed_at: 0,
        bonus_ad_last_claimed_at: 0,
        gold_rush_date: "",
        gold_rush_until: 0,
        channel_done: false,
        casino_date: "",
        endless_energy_until: 0,
        tap_boost_until: 0,
        income_boost_until: 0,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    let row = refreshDailyTasks(applyPassive(data));

    const { data: saved, error: saveError } = await supabase
      .from("game_states")
      .update({
        daily_tasks_date: row.daily_tasks_date,
        daily_tasks_json: row.daily_tasks_json,
        daily_tasks_claimed_json: row.daily_tasks_claimed_json,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (saveError) throw saveError;

    res.json({ ok: true, user: toClientUser(saved) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/leaderboard", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const today = todayKey();

    const { data: topData, error } = await supabase
      .from("game_states")
      .select("user_id, city_value")
      .order("city_value", { ascending: false })
      .limit(3);

    if (error) throw error;

    const { data: dailyCandidates, error: dailyError } = await supabase
      .from("game_states")
      .select("user_id, daily_contest_score, contest_date")
      .eq("contest_date", today)
      .gt("daily_contest_score", 0)
      .order("daily_contest_score", { ascending: false })
      .limit(100);

    if (dailyError) throw dailyError;

    const candidateIds = (dailyCandidates || []).map((row) => row.user_id);
    const referralCounts = await getReferralCounts(candidateIds);
    const dailyEligibleRows = (dailyCandidates || []).filter((row) =>
      dailyPrizeEligible(referralCounts.get(row.user_id) || 0) &&
      economy.computeTickets(row.daily_contest_score) >= 1
    );
    const realDailyScores = dailyEligibleRows.map((row) => number(row.daily_contest_score));

    const topIds = (topData || []).map((row) => row.user_id);
    const lookupIds = [...new Set(topIds)];

    let yourRank = null;
    let yourGame = null;
    let yourDailyRank = null;
    let yourDailyGame = null;
    let yourReferrals = 0;
    let yourDailyEligible = false;
    let dailyMerged = [];
    let dailyTopData = [];

    if (userId) {
      yourReferrals = await getReferralCount(userId);
      yourDailyEligible = dailyPrizeEligible(yourReferrals);

      const { data: userRow } = await supabase
        .from("game_states")
        .select("user_id, city_value, daily_contest_score, contest_date, coins, spent, contest_baseline_city")
        .eq("user_id", userId)
        .maybeSingle();

      if (userRow) {
        yourGame = userRow;
        const { count, error: countError } = await supabase
          .from("game_states")
          .select("*", { count: "exact", head: true })
          .gt("city_value", number(userRow.city_value));

        if (countError) throw countError;
        yourRank = number(count) + 1;

        const contest = syncDailyContest(userRow);
        yourDailyGame = { ...userRow, ...contest };
      }
    }

    let systemBotRows = [];
    try {
      systemBotRows = await systemBots.loadSystemBotGameRows(supabase, today);
    } catch (error) {
      console.warn("SYSTEM_BOTS_LOAD_FAILED:", error.message);
    }

    dailyMerged = mergeDailyLeaderboardRows(
      today,
      dailyEligibleRows,
      realDailyScores,
      yourDailyGame,
      userId,
      systemBotRows
    );
    dailyTopData = dailyMerged.slice(0, 3);
    const dailyListData = dailyMerged.slice(0, DAILY_LEADERBOARD_LIMIT);

    if (yourDailyGame && userId) {
      yourDailyRank = computeDailyRank(
        dailyMerged,
        userId,
        economy.computeTickets(yourDailyGame.daily_contest_score)
      );
    }

    const dailyIds = dailyMerged.map((row) => row.user_id);
    lookupIds.push(...dailyIds);
    if (userId && !lookupIds.includes(userId)) {
      lookupIds.push(userId);
    }

    const { data: users } = await supabase
      .from("users")
      .select("id, first_name, username")
      .in("id", lookupIds);

    const userMap = new Map((users || []).map((user) => [user.id, user]));

    function rowFromGame(gameRow, rank, valueKey = "cityValue") {
      const seed = contestSeedProfile(gameRow.user_id) || systemBots.systemBotProfile(gameRow.user_id);
      const profile = userMap.get(gameRow.user_id) || {};
      const dailyScore = number(gameRow.daily_contest_score);
      const tickets = economy.computeTickets(dailyScore);
      const value = valueKey === "dailyScore"
        ? tickets
        : number(gameRow.city_value);
      const refCount = seed
        ? seed.referralCount
        : (referralCounts.get(gameRow.user_id) || 0);

      return {
        rank,
        userId: gameRow.user_id,
        name: seed?.name || profile.first_name || profile.username || `Player ${String(gameRow.user_id).slice(-4)}`,
        cityValue: number(gameRow.city_value),
        dailyScore,
        tickets,
        referralCount: refCount,
        prizeEligible: seed ? false : dailyPrizeEligible(refCount),
        score: value,
        isYou: gameRow.user_id === userId
      };
    }

    const top3 = (topData || []).map((row, index) => rowFromGame(row, index + 1));
    const youInTop3 = top3.some((row) => row.isYou);
    const you = yourGame && yourRank && !youInTop3
      ? rowFromGame(yourGame, yourRank)
      : null;

    const dailyTop3 = dailyTopData.map((row, index) => rowFromGame(row, index + 1, "dailyScore"));
    const dailyRows = dailyListData.map((row, index) => rowFromGame(row, index + 1, "dailyScore"));

    const youInDailyList = dailyRows.some((row) => row.isYou);
    const dailyYou = yourDailyGame && !youInDailyList
      ? rowFromGame(yourDailyGame, yourDailyRank, "dailyScore")
      : null;

    const lastWinner = await getLatestDailyWinner();
    const yourDailyScore = yourDailyGame ? number(yourDailyGame.daily_contest_score) : 0;

    res.json({
      top3,
      you,
      daily: {
        date: today,
        resetsAt: utcDayEndIso(),
        minReferrals: DAILY_PRIZE_MIN_REFERRALS,
        yourReferrals,
        eligible: yourDailyEligible,
        top3: dailyTop3,
        rows: dailyRows,
        you: dailyYou,
        yourRank: yourDailyRank || 0,
        yourScore: yourDailyScore,
        yourTickets: economy.computeTickets(yourDailyScore),
        ticketProgress: economy.scoreProgressToNextTicket(yourDailyScore),
        lastWinner
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/auth", async (req, res) => {
  const secret = String(req.body.adminSecret || req.body.secret || "").trim();

  if (!ADMIN_SECRET) {
    res.status(503).json({ error: "ADMIN_NOT_CONFIGURED" });
    return;
  }

  if (secret !== ADMIN_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  res.json({ ok: true });
});

app.get("/api/admin/ping", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ ok: true });
});

app.get("/api/admin/summary", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { count: users } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const { data } = await supabase
      .from("game_states")
      .select("coins, taps, city_value");

    const totals = (data || []).reduce(
      (acc, row) => {
        acc.coins += number(row.coins);
        acc.taps += number(row.taps);
        acc.cityValue += number(row.city_value);
        return acc;
      },
      { coins: 0, taps: 0, cityValue: 0 }
    );

    res.json({ users: users || 0, totals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/dashboard", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { count: totalPlayers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const dayAgo = new Date(nowMs() - 24 * 60 * 60 * 1000).toISOString();

    const { count: activeToday } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", dayAgo);

    const { data: gameRows } = await supabase
      .from("game_states")
      .select("coins, taps, city_value");

    const totals = (gameRows || []).reduce(
      (acc, row) => {
        acc.coins += number(row.coins);
        acc.taps += number(row.taps);
        acc.cityValue += number(row.city_value);
        return acc;
      },
      { coins: 0, taps: 0, cityValue: 0 }
    );

    const { data: metrics, error: metricsError } = await supabase
      .from("admin_metrics")
      .select("metric_type, amount");

    if (metricsError && metricsError.code !== "PGRST205") throw metricsError;

    const revenue = (metrics || []).reduce(
      (acc, row) => {
        const value = number(row.amount);
        acc.total += value;
        if (row.metric_type === "tournament_fee") acc.tournamentFees += value;
        if (row.metric_type === "ad_revenue") acc.adRevenue += value;
        if (row.metric_type === "sponsor") acc.sponsor += value;
        return acc;
      },
      { total: 0, tournamentFees: 0, adRevenue: 0, sponsor: 0 }
    );

    const { count: tournamentEntries, error: entriesError } = await supabase
      .from("tournament_entries")
      .select("*", { count: "exact", head: true });

    if (entriesError && entriesError.code !== "PGRST205") throw entriesError;

    let activeTournament = null;
    try {
      activeTournament = await getActiveTournament();
    } catch {
      activeTournament = null;
    }

    res.json({
      players: {
        total: totalPlayers || 0,
        activeToday: activeToday || 0
      },
      totals,
      revenue,
      tournaments: {
        active: activeTournament ? toClientTournament(activeTournament) : null,
        totalEntries: tournamentEntries || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/players", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const limit = Math.min(100, Math.max(1, number(req.query.limit) || 50));
    const offset = Math.max(0, number(req.query.offset) || 0);
    const search = String(req.query.search || "").trim().toLowerCase();

    const { data: users, error } = await supabase
      .from("users")
      .select("id, first_name, username, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const ids = (users || []).map((user) => user.id);
    const { data: games } = ids.length
      ? await supabase
        .from("game_states")
        .select("user_id, coins, taps, city_value, shop_level, bank_level, factory_level")
        .in("user_id", ids)
      : { data: [] };

    const gameMap = new Map((games || []).map((row) => [row.user_id, row]));

    let rows = (users || []).map((user) => {
      const game = gameMap.get(user.id) || {};
      return {
        userId: user.id,
        name: user.first_name || user.username || `Player ${String(user.id).slice(-4)}`,
        username: user.username || "",
        lastSeenAt: user.last_seen_at,
        coins: number(game.coins),
        taps: number(game.taps),
        cityValue: number(game.city_value),
        level: number(game.shop_level) + number(game.bank_level) + number(game.factory_level)
      };
    });

    if (search) {
      rows = rows.filter((row) =>
        row.name.toLowerCase().includes(search) ||
        row.username.toLowerCase().includes(search) ||
        row.userId.includes(search)
      );
    }

    res.json({ rows, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/grant-coins", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const userId = String(req.body.userId || "");
    const amount = number(req.body.amount);

    if (!userId || amount <= 0) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const row = await loadGame(userId);

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + amount,
        city_value: number(row.coins) + amount + number(row.spent),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    await logMetric("manual_grant", amount, "Admin coin grant", { userId });

    res.json({ ok: true, amount, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/tournaments", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const ids = (data || []).map((row) => row.id);
    const { data: counts } = ids.length
      ? await supabase
        .from("tournament_entries")
        .select("tournament_id")
        .in("tournament_id", ids)
      : { data: [] };

    const entryCounts = (counts || []).reduce((acc, row) => {
      acc[row.tournament_id] = (acc[row.tournament_id] || 0) + 1;
      return acc;
    }, {});

    res.json({
      rows: (data || []).map((row) => ({
        ...toClientTournament(row),
        entries: entryCounts[row.id] || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/tournaments", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const entryFee = Math.max(0, number(req.body.entryFee));
    const prizeWinner = Math.max(0, number(req.body.prizeWinner));
    const prizeRunnerUp = Math.max(0, number(req.body.prizeRunnerUp));
    const prizeThird = Math.max(0, number(req.body.prizeThird));
    const durationHours = Math.max(1, number(req.body.durationHours) || 24);
    const bracketMinLevel = Math.max(0, number(req.body.bracketMinLevel));
    const bracketMaxLevel = Math.max(0, number(req.body.bracketMaxLevel));
    const activate = Boolean(req.body.activate);

    if (!title) {
      res.status(400).json({ error: "TITLE_REQUIRED" });
      return;
    }

    const prizePool = prizeWinner + prizeRunnerUp + prizeThird;
    const startsAt = new Date().toISOString();
    const endsAt = new Date(nowMs() + durationHours * 60 * 60 * 1000).toISOString();

    if (activate) {
      let endQuery = supabase
        .from("tournaments")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("status", "active")
        .eq("bracket_min_level", bracketMinLevel)
        .eq("bracket_max_level", bracketMaxLevel);

      await endQuery;
    }

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        title,
        description,
        entry_fee: entryFee,
        prize_pool: prizePool,
        prize_winner: prizeWinner,
        prize_runner_up: prizeRunnerUp,
        prize_third: prizeThird,
        bracket_min_level: bracketMinLevel,
        bracket_max_level: bracketMaxLevel,
        status: activate ? "active" : "draft",
        starts_at: startsAt,
        ends_at: endsAt
      })
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, tournament: toClientTournament(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/tournaments/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const tournamentId = String(req.body.tournamentId || "");
    const status = String(req.body.status || "");

    if (!tournamentId || !["draft", "active", "ended"].includes(status)) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    if (status === "active") {
      await supabase
        .from("tournaments")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("status", "active");
    }

    const { data, error } = await supabase
      .from("tournaments")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", tournamentId)
      .select("*")
      .single();

    if (error) throw error;

    if (status === "ended") {
      await distributeTournamentPrizes(data);
    }

    res.json({ ok: true, tournament: toClientTournament(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function distributeTournamentPrizes(tournament) {
  const { data: entries, error } = await supabase
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournament.id)
    .order("tap_score", { ascending: false })
    .limit(3);

  if (error) throw error;

  const prizes = [
    number(tournament.prize_winner),
    number(tournament.prize_runner_up),
    number(tournament.prize_third)
  ];

  for (let i = 0; i < (entries || []).length; i += 1) {
    const entry = entries[i];
    const prize = prizes[i];
    if (!prize) continue;

    const row = await loadGame(entry.user_id);

    await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + prize,
        city_value: number(row.coins) + prize + number(row.spent),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", entry.user_id);

    await supabase
      .from("tournament_entries")
      .update({ prize_won: prize })
      .eq("id", entry.id);
  }
}

app.post("/api/admin/metrics", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const metricType = String(req.body.metricType || "manual");
    const amount = number(req.body.amount);
    const notes = String(req.body.notes || "");

    if (!amount) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    await logMetric(metricType, amount, notes);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/metrics", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { data, error } = await supabase
      .from("admin_metrics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ rows: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/payouts", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const status = String(req.query.status || "pending").trim() || "pending";
    let query = supabase
      .from("pending_payouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ rows: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/payouts/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const payoutId = number(req.body.id);
    const status = String(req.body.status || "").trim();

    if (!payoutId || !["pending", "completed"].includes(status)) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const patch = {
      status
    };

    if (status === "completed") {
      patch.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("pending_payouts")
      .update(patch)
      .eq("id", payoutId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, payout: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tournaments/active", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const tournament = await getActiveTournament(userId);

    if (!tournament) {
      res.json({ tournament: null });
      return;
    }

    const entry = userId ? await getTournamentEntry(tournament.id, userId) : null;

    res.json({ tournament: toClientTournament(tournament, entry) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tournaments/join", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const tournamentId = String(req.body.tournamentId || "");

    if (!userId || !tournamentId) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (tournamentError) throw tournamentError;

    if (!tournamentIsLive(tournament)) {
      res.status(400).json({ error: "TOURNAMENT_NOT_LIVE" });
      return;
    }

    const row = await loadGame(userId);
    const playerLevel = empireLevel(row);
    if (!tournamentMatchesLevel(tournament, playerLevel)) {
      res.status(400).json({
        error: "BRACKET_MISMATCH",
        bracketLabel: tournamentBracketLabel(tournament),
        yourLevel: playerLevel
      });
      return;
    }

    const existing = await getTournamentEntry(tournamentId, userId);
    if (existing) {
      res.status(400).json({ error: "ALREADY_JOINED" });
      return;
    }

    const fee = number(tournament.entry_fee);

    if (fee > 0 && number(row.coins) < fee) {
      res.status(400).json({ error: "NOT_ENOUGH_COINS" });
      return;
    }

    if (fee > 0) {
      await supabase
        .from("game_states")
        .update({
          coins: number(row.coins) - fee,
          city_value: number(row.coins) - fee + number(row.spent),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      await logMetric("tournament_fee", fee, `Entry: ${tournament.title}`, {
        userId,
        tournamentId
      });
    }

    const { error: entryError } = await supabase
      .from("tournament_entries")
      .insert({
        tournament_id: tournamentId,
        user_id: userId,
        entry_paid: fee,
        tap_score: 0
      });

    if (entryError) throw entryError;

    const updatedRow = await loadGame(userId);
    const entry = await getTournamentEntry(tournamentId, userId);

    res.json({
      ok: true,
      fee,
      tournament: toClientTournament(tournament, entry),
      user: toClientUser(updatedRow)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tournaments/leaderboard", requirePlayer, async (req, res) => {
  try {
    const tournamentId = String(req.body.tournamentId || "");
    const userId = req.playerId;

    if (!tournamentId) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const { data, error } = await supabase
      .from("tournament_entries")
      .select("user_id, tap_score, prize_won")
      .eq("tournament_id", tournamentId)
      .order("tap_score", { ascending: false })
      .limit(20);

    if (error) throw error;

    const ids = (data || []).map((row) => row.user_id);
    const { data: users } = ids.length
      ? await supabase
        .from("users")
        .select("id, first_name, username")
        .in("id", ids)
      : { data: [] };

    const userMap = new Map((users || []).map((user) => [user.id, user]));

    res.json({
      rows: (data || []).map((row, index) => {
        const profile = userMap.get(row.user_id) || {};
        return {
          rank: index + 1,
          userId: row.user_id,
          name: profile.first_name || profile.username || `Player ${String(row.user_id).slice(-4)}`,
          tapScore: number(row.tap_score),
          prizeWon: number(row.prize_won),
          isYou: row.user_id === userId
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function requireCron(req, res) {
  if (!CRON_SECRET) {
    res.status(503).json({ error: "CRON_NOT_CONFIGURED" });
    return false;
  }

  const secret = String(req.headers["x-cron-secret"] || req.body.secret || "").trim();
  if (secret !== CRON_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return false;
  }

  return true;
}

async function sendPushMessage(telegramId, text) {
  if (!TELEGRAM_BOT_TOKEN) return false;

  try {
    const webAppUrl = process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/v5.html?v=2019";
    await telegramApi("sendMessage", {
      chat_id: telegramId,
      text,
      reply_markup: {
        inline_keyboard: [[{
          text: "🎮 Play Wealthia",
          web_app: { url: webAppUrl }
        }]]
      }
    });
    return true;
  } catch {
    return false;
  }
}

app.post("/api/cron/system-bots-tick", async (req, res) => {
  if (!requireCron(req, res)) return;

  try {
    const result = await systemBots.tickSystemBots(supabase, todayKey());
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cron/daily-lottery", async (req, res) => {
  if (!requireCron(req, res)) return;

  try {
    const hourUtc = new Date().getUTCHours();
    const force = Boolean(req.body.force);
    const contestDate = String(req.body.contestDate || yesterdayKey());

    if (!force && hourUtc !== 0) {
      res.json({
        ok: true,
        skipped: true,
        reason: "NOT_LOTTERY_HOUR",
        hourUtc
      });
      return;
    }

    const result = await runDailyLottery(contestDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cron/daily-push", async (req, res) => {
  if (!requireCron(req, res)) return;

  try {
    const hourUtc = new Date().getUTCHours();
    const force = Boolean(req.body.force);

    if (!force && hourUtc !== DAILY_PUSH_HOUR_UTC) {
      res.json({
        ok: true,
        skipped: true,
        reason: "NOT_PUSH_HOUR",
        hourUtc,
        pushHour: DAILY_PUSH_HOUR_UTC
      });
      return;
    }

    const today = todayKey();
    const { data: users, error } = await supabase
      .from("users")
      .select("id, first_name, last_push_date")
      .neq("last_push_date", today)
      .limit(500);

    if (error) throw error;

    let sent = 0;
    for (const user of users || []) {
      const name = user.first_name || "Builder";
      const text = [
        "🏆 Wealthia Daily Reminder",
        "",
        "⚡ Gold Rush — 2x tap coins for 15 min (once daily)",
        "🎁 Claim your daily streak in Tasks",
        "🏅 Join your level bracket tournament in Rank",
        "",
        `Hi ${name}, tap Play to continue your empire!`
      ].join("\n");

      const ok = await sendPushMessage(user.id, text);
      if (ok) {
        sent += 1;
        await supabase
          .from("users")
          .update({ last_push_date: today })
          .eq("id", user.id);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    res.json({ ok: true, sent, total: (users || []).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Wealthia backend running on port ${port}`);

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_WEBHOOK_SECRET && WEBHOOK_BASE_URL) {
    telegramStars.registerTelegramWebhook(telegramApiSafe, {
      secret: TELEGRAM_WEBHOOK_SECRET,
      baseUrl: WEBHOOK_BASE_URL
    }).catch((error) => {
      console.warn("Telegram webhook setup skipped:", error.message);
    });
  } else if (process.env.TELEGRAM_BOT_TOKEN && process.env.ENABLE_BOT_POLLING !== "false") {
    try {
      const { startBotPolling } = require("../bot/runner");
      startBotPolling();
      console.log("Telegram bot polling embedded in backend.");
    } catch (error) {
      console.warn("Telegram bot polling skipped:", error.message);
    }
  } else {
    console.warn(
      "Stars webhook not configured. Set WEBHOOK_BASE_URL and TELEGRAM_WEBHOOK_SECRET on the backend."
    );
  }
});
