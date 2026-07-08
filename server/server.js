const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const {
  authFailureReason,
  bearerTokenFromRequest,
  createSessionToken,
  diagnoseTelegramAuth,
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
const paymentSecurity = require("./payment-security");
const gameSettings = require("./game-settings");
const macroGuard = require("./macro-guard");
const telegramStars = require("./telegram-stars");
const economy = require("./economy");
const { createTapPipeline } = require("./tap-pipeline");
const { insertGameState, updateGameState } = require("./game-state-update");
const { handleBotMessage, setupBotProfile } = require("./bot-commands");

const app = express();
const port = process.env.PORT || 3000;

app.set("trust proxy", 1);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const tapPipeline = createTapPipeline({ supabase });
const tapHelpers = {
  economy,
  nowMs,
  todayKey,
  buildCityValue,
  syncDailyContest,
  hasEndlessEnergy,
  tapPower,
  incrementTournamentScore: null
};

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
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const AD_REWARD_COOLDOWN_MS = 60 * 1000;
const BONUS_AD_REWARD_COOLDOWN_MS = 60 * 1000;
const GOLD_RUSH_DURATION_MS = 15 * 60 * 1000;
const GOLD_RUSH_MULTIPLIER = 2;
const CRON_SECRET = process.env.CRON_SECRET || process.env.ADMIN_SECRET || "";
const DAILY_PUSH_HOUR_UTC = Math.max(0, Math.min(23, Number(process.env.DAILY_PUSH_HOUR_UTC) || 10));
const DAILY_PRIZE_MIN_REFERRALS = Math.max(0, Number(process.env.DAILY_PRIZE_MIN_REFERRALS) || 1);
const REFERRAL_STATUS_QUALIFIED = "qualified";
const REFERRAL_STATUS_PENDING_CHANNEL = "pending_channel";
const REFERRAL_STATUS_REJECTED_BOT = "rejected_bot";
const CHANNEL_MEMBER_STATUSES = new Set([
  "creator",
  "administrator",
  "member",
  "restricted"
]);
const VERIFIED_CHANNEL_STATUSES = new Set([
  "creator",
  "administrator",
  "member"
]);
const CHANNEL_SUBSCRIPTION_REQUIRED_MESSAGE =
  "Subscription not found! Please join the channel first.";
const TAP_RATE_WINDOW_MS = 1000;
const MAX_TAPS_PER_WINDOW = Number(process.env.MAX_TAPS_PER_SECOND || 15);
const TAP_VIOLATION_ALERT_THRESHOLD = 25;
const IP_RATE_WINDOW_MS = 60 * 1000;
const IP_MAX_HITS = 240;
const ipRateBuckets = new Map();

const EARN_TASKS = {
  sponsor: { reward: 750, field: "sponsor_done" },
  ad: { reward: 1500, cooldown: true },
  bonus_ad: { reward: 800, cooldown: true, field: "bonus_ad_last_claimed_at" },
  channel: { reward: 500, field: "channel_done" }
};

const BOOST_OPTIONS = {
  fullEnergy: { cost: 100, type: "energy" },
  tapBoost: { cost: 150, type: "tap" },
  incomeBoost: { cost: 200, type: "income"   }
};

function getStarProduct(productId) {
  const product = STAR_PRODUCTS[productId];
  if (!product) return null;

  if (productId === "premium_spin") {
    return {
      ...product,
      stars: gameSettings.getSettingsSync().premium_spin_stars
    };
  }

  return product;
}

function getStarProductsMap() {
  return Object.fromEntries(
    Object.keys(STAR_PRODUCTS).map((id) => [id, getStarProduct(id)])
  );
}

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
    description: "Spin the premium wheel for cash prizes, tickets and boosts",
    successMessage: "Premium spin ready!"
  },
  tickets_1: {
    stars: 5,
    title: "1 Tournament Ticket",
    description: "Add 1 ticket to today's Daily Race",
    successMessage: "+1 Ticket added!",
    ticketCount: 1
  },
  tickets_5: {
    stars: 20,
    title: "5 Tournament Tickets",
    description: "Add 5 tickets to today's Daily Race",
    successMessage: "+5 Tickets added!",
    ticketCount: 5
  },
  tickets_10: {
    stars: 35,
    title: "10 Tournament Tickets",
    description: "Add 10 tickets to today's Daily Race",
    successMessage: "+10 Tickets added!",
    ticketCount: 10
  },
  tickets_50: {
    stars: 150,
    title: "50 Tournament Tickets",
    description: "Add 50 tickets to today's Daily Race",
    successMessage: "+50 Tickets added!",
    ticketCount: 50
  },
  tickets_100: {
    stars: 250,
    title: "100 Tournament Tickets",
    description: "Add 100 tickets to today's Daily Race",
    successMessage: "+100 Tickets added!",
    ticketCount: 100
  },
  coins_5000: {
    stars: 10,
    title: "5,000 Wealth Coins",
    description: "Instant coin pack for your empire",
    successMessage: "+5,000 Coins added!",
    coinAmount: 5000
  },
  coins_15000: {
    stars: 25,
    title: "15,000 Wealth Coins",
    description: "Instant coin pack for your empire",
    successMessage: "+15,000 Coins added!",
    coinAmount: 15000
  },
  coins_50000: {
    stars: 70,
    title: "50,000 Wealth Coins",
    description: "Instant coin pack for your empire",
    successMessage: "+50,000 Coins added!",
    coinAmount: 50000
  },
  coins_150000: {
    stars: 180,
    title: "150,000 Wealth Coins",
    description: "Instant coin pack for your empire",
    successMessage: "+150,000 Coins added!",
    coinAmount: 150000
  },
  coins_500000: {
    stars: 450,
    title: "500,000 Wealth Coins",
    description: "Instant coin pack for your empire",
    successMessage: "+500,000 Coins added!",
    coinAmount: 500000
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
    "💰 Wealthia — Stars sale!",
    "",
    `Player: ${details.playerName}`,
    `Product: ${details.productTitle}`,
    `Paid: ${details.stars} ⭐`,
    "",
    "Revenue incoming — nice! 🎉"
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

function isChannelJoinTask(task) {
  return Boolean(
    task &&
    task.type === "social" &&
    (task.action === "join_telegram" || task.id === "social-join-telegram")
  );
}

async function verifyChannelSubscriptionStrict(telegramId) {
  if (!TELEGRAM_BOT_TOKEN || !telegramId) {
    return { ok: false, message: CHANNEL_SUBSCRIPTION_REQUIRED_MESSAGE };
  }

  const chatId = await getOfficialChannelChatId();
  if (!chatId) {
    return { ok: false, message: CHANNEL_SUBSCRIPTION_REQUIRED_MESSAGE };
  }

  const lookup = await telegramApiSafe("getChatMember", {
    chat_id: chatId,
    user_id: Number(telegramId)
  });

  if (!lookup.ok) {
    return { ok: false, message: CHANNEL_SUBSCRIPTION_REQUIRED_MESSAGE };
  }

  const status = String(lookup.result?.status || "");
  if (!VERIFIED_CHANNEL_STATUSES.has(status)) {
    return { ok: false, message: CHANNEL_SUBSCRIPTION_REQUIRED_MESSAGE, status };
  }

  return { ok: true, status };
}

function rejectChannelSubscription(res) {
  res.status(400).json({
    success: false,
    error: "CHANNEL_NOT_SUBSCRIBED",
    message: CHANNEL_SUBSCRIPTION_REQUIRED_MESSAGE
  });
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

function applyTicketsValue(row, ticketCount) {
  const today = todayKey();
  const tickets = Math.max(0, Math.floor(number(ticketCount)));
  let baseline = number(row.contest_baseline_city);
  let contestDate = String(row.contest_date || "");

  if (contestDate !== today) {
    baseline = number(row.coins) + number(row.spent);
    contestDate = today;
  }

  return {
    daily_contest_score: tickets * economy.TICKETS_PER_SCORE,
    contest_date: contestDate,
    contest_baseline_city: baseline,
    updated_at: new Date().toISOString()
  };
}

function ticketsFromRow(row) {
  const today = todayKey();
  let score = number(row.daily_contest_score);
  if (String(row.contest_date || "") !== today) score = 0;
  return Math.floor(score / economy.TICKETS_PER_SCORE);
}

async function getUserTotalSpins(userId) {
  const { count, error } = await supabase
    .from("star_payments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("product_id", "premium_spin")
    .not("consumed_at", "is", null);

  if (error) {
    console.warn("TOTAL_SPINS_LOOKUP_FAILED:", error.message);
    return 0;
  }

  return count || 0;
}

const ADMIN_USER_SELECT_FULL =
  "id, first_name, username, last_seen_at, created_at, is_banned, banned_at, ban_reason";
const ADMIN_USER_SELECT_BASE = "id, first_name, username, last_seen_at";

function isMissingColumnError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

function normalizeAdminUser(user) {
  return {
    ...user,
    created_at: user.created_at || null,
    is_banned: Boolean(user.is_banned),
    banned_at: user.banned_at || null,
    ban_reason: user.ban_reason || ""
  };
}

async function queryAdminUser(applyFilters, useExtendedColumns = true) {
  const selectFields = useExtendedColumns ? ADMIN_USER_SELECT_FULL : ADMIN_USER_SELECT_BASE;
  let request = supabase.from("users").select(selectFields).limit(1);
  request = applyFilters(request);

  const { data, error } = await request;
  if (error) {
    if (useExtendedColumns && isMissingColumnError(error)) {
      return queryAdminUser(applyFilters, false);
    }
    throw error;
  }

  const user = Array.isArray(data) ? data[0] : null;
  return user ? normalizeAdminUser(user) : null;
}

async function findUserByAdminQuery(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/^@/, "").toLowerCase();

  if (/^\d+$/.test(trimmed)) {
    return queryAdminUser((request) => request.eq("id", trimmed));
  }

  let user = await queryAdminUser((request) => request.ilike("username", normalized));
  if (user) return user;

  user = await queryAdminUser((request) => request.ilike("username", `%${normalized}%`));
  if (user) return user;

  return queryAdminUser((request) => request.ilike("first_name", `%${normalized}%`));
}

async function loadGameRowForAdmin(userId) {
  const emptyRow = {
    user_id: String(userId),
    coins: 0,
    spent: 0,
    daily_contest_score: 0,
    contest_date: "",
    contest_baseline_city: 0
  };

  const { data, error } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", String(userId))
    .maybeSingle();

  if (error) {
    console.warn("ADMIN_LOAD_GAME_FAILED:", error.message);
    return { row: emptyRow, exists: false };
  }

  if (!data) {
    return { row: emptyRow, exists: false };
  }

  return { row: data, exists: true };
}

function toAdminUserProfile(user, gameRow, totalSpins) {
  return {
    userId: user.id,
    username: user.username || "",
    displayName: user.first_name || "",
    coins: number(gameRow.coins),
    tickets: ticketsFromRow(gameRow),
    totalSpins,
    registrationDate: user.created_at || null,
    lastSeenAt: user.last_seen_at || null,
    isBanned: Boolean(user.is_banned),
    bannedAt: user.banned_at || null,
    banReason: user.ban_reason || ""
  };
}

function applyTicketPackPurchase(row, ticketCount) {
  const today = todayKey();
  let score = number(row.daily_contest_score);
  let contestDate = String(row.contest_date || "");
  let baseline = number(row.contest_baseline_city);

  if (contestDate !== today) {
    score = 0;
    baseline = number(row.coins) + number(row.spent);
    contestDate = today;
  }

  const bonusScore = Math.max(1, number(ticketCount)) * economy.TICKETS_PER_SCORE;

  return {
    daily_contest_score: score + bonusScore,
    contest_date: contestDate,
    contest_baseline_city: baseline,
    updated_at: new Date().toISOString()
  };
}

function applyCoinPackPurchase(row, coinAmount) {
  const bonusCoins = Math.max(0, number(coinAmount));
  const newCoins = number(row.coins) + bonusCoins;

  return {
    coins: newCoins,
    city_value: newCoins + number(row.spent),
    updated_at: new Date().toISOString()
  };
}

function applyStarProduct(row, productId) {
  const product = STAR_PRODUCTS[productId];
  const updated = {
    updated_at: new Date().toISOString()
  };

  if (productId.startsWith("coins_") && product?.coinAmount) {
    return applyCoinPackPurchase(row, product.coinAmount);
  }

  if (productId.startsWith("tickets_") && product?.ticketCount) {
    return applyTicketPackPurchase(row, product.ticketCount);
  }

  if (productId === "refill_energy") {
    updated.energy = economy.maxEnergy(row);
    updated.last_energy_updated_at = nowMs();
    return updated;
  }

  if (productId === "tap_boost_30") {
    updated.tap_boost_until = extendBoostUntil(row.tap_boost_until);
    return updated;
  }

  if (productId === "endless_energy_30") {
    updated.endless_energy_until = extendBoostUntil(row.endless_energy_until);
    updated.energy = economy.maxEnergy(row);
    updated.last_energy_updated_at = nowMs();
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

function starPriceLabel(product, productId = "") {
  if (!product) return "Wealthia";
  const tickets = Number(product.ticketCount || 0);
  if (tickets > 0) {
    return `${tickets}x Ticket`;
  }
  const coins = Number(product.coinAmount || 0);
  if (coins > 0) {
    return `${coins.toLocaleString("en-US")} Coins`;
  }
  if (productId === "premium_spin") {
    return "Premium Spin";
  }
  return String(product.title || "Wealthia").trim();
}

function parseStarPayload(payload) {
  const parts = String(payload || "").split("|");
  if (parts.length !== 3 || parts[0] !== "w") return null;
  return { userId: parts[1], productId: parts[2] };
}

function getTelegramStarsOptions() {
  return {
    telegramApiSafe,
    starProducts: getStarProductsMap(),
    parseStarPayload,
    fulfillPayment: async (payload) => fulfillStarPaymentRecord({
      ...payload,
      telegramSettled: true
    }),
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
  invoicePayload,
  telegramSettled = false
}) {
  try {
    const starsAmount = number(stars);
    const payload = parseStarPayload(telegramStars.normalizeInvoicePayload(invoicePayload));

    if (!userId || !productId || !chargeId || !getStarProduct(productId)) {
      const error = new Error("BAD_REQUEST");
      error.code = "BAD_REQUEST";
      throw error;
    }

    if (!payload || payload.userId !== userId || payload.productId !== productId) {
      await paymentSecurity.logPaymentFraud(supabase, {
        userId,
        eventType: "FRAUD_ATTEMPT",
        detail: `invalid_payload product=${productId} charge_id=${chargeId}`
      });
      const error = new Error("INVALID_PAYLOAD");
      error.code = "INVALID_PAYLOAD";
      throw error;
    }

    const expectedStars = number(getStarProduct(productId).stars);
    if (!expectedStars || starsAmount !== expectedStars) {
      await paymentSecurity.logPaymentFraud(supabase, {
        userId,
        eventType: "FRAUD_ATTEMPT",
        detail: `stars_mismatch product=${productId} paid=${starsAmount} expected=${expectedStars} charge_id=${chargeId}`
      });
      const error = new Error("INVALID_STARS_AMOUNT");
      error.code = "INVALID_STARS_AMOUNT";
      throw error;
    }

    if (!chargeId || chargeId.length < 8) {
      const error = new Error("INVALID_CHARGE_ID");
      error.code = "INVALID_CHARGE_ID";
      throw error;
    }

    if (!telegramSettled) {
      const error = new Error("TELEGRAM_SETTLEMENT_REQUIRED");
      error.code = "TELEGRAM_SETTLEMENT_REQUIRED";
      throw error;
    }

    const { data: existing } = await supabase
      .from("star_payments")
      .select("id")
      .eq("charge_id", chargeId)
      .maybeSingle();

    if (existing) {
      await paymentSecurity.logPaymentFraud(supabase, {
        userId,
        eventType: "REPLAY_CHARGE_ID",
        detail: `charge_id=${chargeId} product=${productId}`
      });
      return { duplicate: true, replay: true, user: await loadGame(userId) };
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
      charge_id: chargeId,
      telegram_settled: true,
      settled_at: new Date().toISOString()
    });

    if (paymentError) {
      if (paymentSecurity.isUniqueViolation(paymentError)) {
        await paymentSecurity.logPaymentFraud(supabase, {
          userId,
          eventType: "REPLAY_CHARGE_ID",
          detail: `race_charge_id=${chargeId} product=${productId}`
        });
        return { duplicate: true, replay: true, user: await loadGame(userId) };
      }
      throw paymentError;
    }

    const { data, error } = await supabase
      .from("game_states")
      .update(productUpdate)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    syncTapCache(userId, data);

    const { data: buyer } = await supabase
      .from("users")
      .select("first_name, username")
      .eq("id", userId)
      .maybeSingle();

    await notifyOwnerStarsSale({
      playerName: buyer?.first_name || buyer?.username || `Player ${userId.slice(-4)}`,
      productTitle: getStarProduct(productId).title,
      stars: expectedStars
    });

    return {
      duplicate: false,
      user: data,
      productId,
      premiumSpinReady: productId === "premium_spin"
    };
  } catch (error) {
    console.error("FULFILL_STAR_PAYMENT_ERROR:", error.message);
    throw error;
  }
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

function sortDailyContestRows(rows) {
  const ticketCount = (row) => economy.computeTickets(row.daily_contest_score);
  return [...rows].sort((a, b) => {
    const byTickets = ticketCount(b) - ticketCount(a);
    if (byTickets !== 0) return byTickets;
    return number(b.daily_contest_score) - number(a.daily_contest_score);
  });
}

function buildDailyPodiumRows(dailyCandidates) {
  return sortDailyContestRows(dailyCandidates || [])
    .filter((row) =>
      number(row.daily_contest_score) > 0 &&
      economy.computeTickets(row.daily_contest_score) >= 1
    )
    .slice(0, 3);
}

function computeGlobalDailyRank(dailyCandidates, userId, userScore) {
  if (!userId) return 0;

  const scorers = sortDailyContestRows(
    (dailyCandidates || []).filter((row) => number(row.daily_contest_score) > 0)
  );
  const index = scorers.findIndex((row) => row.user_id === userId);
  if (index >= 0) return index + 1;

  const score = number(userScore);
  if (score <= 0) return 0;

  const userTickets = economy.computeTickets(score);
  return 1 + scorers.filter((row) => {
    const rowTickets = economy.computeTickets(row.daily_contest_score);
    if (rowTickets !== userTickets) return rowTickets > userTickets;
    return number(row.daily_contest_score) > score;
  }).length;
}

function mergeDailyLeaderboardRows(
  today,
  dailyEligibleRows,
  realDailyScores,
  systemBotRows = []
) {
  const merged = [...dailyEligibleRows];

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

function requirePlayerOrTelegram(req, res, next) {
  try {
    const userId = verifyToken(bearerTokenFromRequest(req));
    if (userId) {
      req.playerId = userId;
      next();
      return;
    }

    const initData = String(req.body?.initData || "");
    if (initData && TELEGRAM_BOT_TOKEN) {
      const diagnosis = diagnoseTelegramAuth(initData, TELEGRAM_BOT_TOKEN);
      if (diagnosis.ok && diagnosis.user?.id) {
        req.playerId = String(diagnosis.user.id);
        req.telegramUser = diagnosis.user;
        next();
        return;
      }
    }
  } catch (error) {
    console.error("REQUIRE_PLAYER_OR_TELEGRAM_ERROR:", error.message);
    res.status(500).json({
      ok: false,
      error: "AUTH_ERROR",
      message: "Payment auth failed. Close and reopen the game."
    });
    return;
  }

  res.status(401).json({
    error: "SESSION_EXPIRED",
    message: "Session expired. Close and reopen the game."
  });
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


function ipRateLimit(req, res, next) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  if (req.path === "/api/adsgram/reward" || req.path === "/api/session" || req.path === "/api/stars/invoice") {
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

tapHelpers.incrementTournamentScore = incrementTournamentScore;

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
  if (isChannelJoinTask(task)) return false;
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
    energy_regen_rate: economy.energyRegenRate(row),
    last_energy_updated_at: economy.lastEnergyUpdatedAtMs(row),
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
      energyRegenRate: economy.energyRegenRate(row),
      lastEnergyUpdatedAt: economy.lastEnergyUpdatedAtMs(row),
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

async function tryQualifyPendingReferral(referredUserId) {
  try {
    return await qualifyReferralIfPending(referredUserId);
  } catch (error) {
    console.warn("QUALIFY_REFERRAL_FAILED:", referredUserId, error.message);
    return false;
  }
}

async function syncReferralAfterChannelJoin(userId) {
  const channelCheck = await checkOfficialChannelMembership(userId);
  if (!channelCheck.skipped && !channelCheck.isMember) {
    return {
      ok: false,
      channelRequired: true,
      channelUrl: getOfficialChannelUrl(),
      channelMessage: "Please subscribe to our official channel to unlock the game"
    };
  }

  const referralQualified = await tryQualifyPendingReferral(userId);
  return { ok: true, referralQualified };
}

async function isOfficialChannelMember(telegramId) {
  const check = await checkOfficialChannelMembership(telegramId);
  return Boolean(check.isMember);
}

async function creditReferrerCoins(referrerId) {
  const referrer = String(referrerId || "");
  if (!referrer) return;

  await tapPipeline.flushUser(referrer, tapHelpers);

  const { data: refRow } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", referrer)
    .maybeSingle();

  if (!refRow) return;

  const bonus = REFERRAL_BONUS;

  const { data } = await supabase
    .from("game_states")
    .update({
      coins: number(refRow.coins) + bonus,
      city_value: number(refRow.coins) + bonus + number(refRow.spent),
      invite_done: true,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", referrer)
    .select("*")
    .single();

  syncTapCache(referrer, data);
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

  const { data: updatedRows, error: updateError } = await supabase
    .from("referrals")
    .update({
      status: REFERRAL_STATUS_QUALIFIED,
      reject_reason: ""
    })
    .eq("id", pending.id)
    .eq("status", REFERRAL_STATUS_PENDING_CHANNEL)
    .select("id");

  if (updateError) throw updateError;
  if (!updatedRows || !updatedRows.length) return false;

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

  await supabase
    .from("users")
    .update({ referred_by: referrer })
    .eq("id", referred)
    .is("referred_by", null);

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

async function buildReferralsAnalytics() {
  const { data: qualifiedRows, error: qualifiedError } = await supabase
    .from("referrals")
    .select("referrer_id, referred_user_id, status, created_at")
    .eq("status", REFERRAL_STATUS_QUALIFIED);

  if (qualifiedError) throw qualifiedError;

  const { data: viralRows, error: viralError } = await supabase
    .from("referrals")
    .select("referred_user_id")
    .neq("status", REFERRAL_STATUS_REJECTED_BOT);

  if (viralError) throw viralError;

  const byReferrer = new Map();
  for (const row of qualifiedRows || []) {
    const referrerId = String(row.referrer_id || "");
    if (!referrerId) continue;
    byReferrer.set(referrerId, number(byReferrer.get(referrerId)) + 1);
  }

  const referrerIds = [...byReferrer.entries()]
    .filter(([, count]) => count > 0)
    .map(([id]) => id);

  const userMap = new Map();
  if (referrerIds.length) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username, first_name, is_banned, referral_count")
      .in("id", referrerIds);

    if (usersError) throw usersError;

    for (const user of users || []) {
      userMap.set(String(user.id), user);
    }
  }

  const leaderboard = referrerIds
    .map((telegramId) => {
      const referralCount = number(byReferrer.get(telegramId));
      const user = userMap.get(telegramId) || {};
      return {
        telegramId,
        username: String(user.username || ""),
        displayName: String(user.first_name || "Player"),
        referralCount,
        totalRewardsDistributed: referralCount * REFERRAL_BONUS,
        status: user.is_banned ? "banned" : "active"
      };
    })
    .sort((a, b) => b.referralCount - a.referralCount || String(a.telegramId).localeCompare(String(b.telegramId)))
    .map((row, index) => ({
      rank: index + 1,
      ...row
    }));

  const totalViralUsers = new Set(
    (viralRows || []).map((row) => String(row.referred_user_id || "")).filter(Boolean)
  ).size;

  const king = leaderboard[0] || null;

  return {
    summary: {
      totalViralUsers,
      kingOfInvites: king
        ? {
            telegramId: king.telegramId,
            username: king.username,
            displayName: king.displayName,
            referralCount: king.referralCount
          }
        : null
    },
    leaderboard
  };
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

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("is_banned, ban_reason, created_at")
    .eq("id", telegramId)
    .maybeSingle();

  if (existingUserError) throw existingUserError;

  if (existingUser?.is_banned) {
    const error = new Error("ACCOUNT_BANNED");
    error.code = "ACCOUNT_BANNED";
    error.banReason = String(existingUser.ban_reason || "");
    throw error;
  }

  const userUpsert = {
    id: telegramId,
    telegram_id: telegramId,
    first_name: name,
    username,
    last_seen_at: new Date().toISOString()
  };

  if (!existingUser) {
    userUpsert.created_at = new Date().toISOString();
  }

  const { error: userError } = await supabase.from("users").upsert(userUpsert);

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

    const saved = await updateGameState(
      supabase,
      telegramId,
      passiveDbPatch(row, contest),
      { select: "*" }
    );

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
    energy_regen_rate: economy.BASE_ENERGY_REGEN_RATE,
    last_energy_updated_at: nowMs(),
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

  const data = await insertGameState(supabase, fresh, { select: "*" });

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

  const registered = await registerPendingReferral(referrer, telegramId, {
    isBot: Boolean(telegramUser?.is_bot)
  });

  if (registered) {
    console.log("PENDING_REFERRAL_REGISTERED:", referrer, "->", telegramId);
  }

  return registered;
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

async function loadGameRow(userId) {
  const { data, error } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", String(userId))
    .single();

  if (error) throw error;

  let row = refreshDailyTasks(applyPassive(data));
  const contest = syncDailyContest(row);

  const saved = await updateGameState(
    supabase,
    userId,
    passiveDbPatch(row, contest),
    { select: "*" }
  );

  return attachPassiveMeta(saved, row);
}

async function loadGame(userId) {
  return tapPipeline.reload(userId, async () => loadGameRow(userId), tapHelpers);
}

function syncTapCache(userId, row) {
  if (row) tapPipeline.hydrate(userId, row);
  return row;
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

app.get("/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

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
    tap: tapPipeline.stats(),
    session: {
      configured: Boolean(TELEGRAM_BOT_TOKEN || process.env.SESSION_SECRET || ADMIN_SECRET)
    },
    version: "stars-settlement-v1"
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
      row = await tapPipeline.reload(telegramUser.id, async () => {
        const profile = await ensureUserProfile(telegramUser);
        isNewPlayer = Boolean(profile.isNew);
        return profile.row;
      }, tapHelpers);
    } catch (profileError) {
      console.error("ENSURE_USER_PROFILE_FAILED:", profileError);
      if (profileError.code === "BOTS_NOT_ALLOWED") {
        res.status(403).json({ error: "BOTS_NOT_ALLOWED" });
        return;
      }
      if (profileError.code === "ACCOUNT_BANNED") {
        res.status(403).json({
          error: "ACCOUNT_BANNED",
          message: profileError.banReason || "Your account has been blocked."
        });
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
      const referralQualified = await tryQualifyPendingReferral(telegramUser.id);
      if (referralQualified) {
        console.log("REFERRAL_QUALIFIED:", telegramUser.id);
      }
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

    const responseRow = await tapPipeline.getLiveRow(telegramUser.id, row, tapHelpers);

    res.json({
      ...toClientUser(responseRow || row, {
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
    if (error.code === "ACCOUNT_BANNED") {
      res.status(403).json({ error: "ACCOUNT_BANNED", message: "Your account has been blocked." });
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
    syncTapCache(userId, data);

    res.json({ ok: true, until, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tap", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const count = Math.min(20, Math.max(1, Math.floor(number(req.body?.count) || 1)));

    const macro = await macroGuard.enforceMacroGuard(supabase, userId, "tap");
    if (macro.blocked) {
      res.status(403).json({
        error: macro.banned ? "ACCOUNT_BANNED" : "MACRO_DETECTED",
        message: "Suspicious activity detected."
      });
      return;
    }

    await tapPipeline.ensureHydrated(userId, async () => loadGameRow(userId));

    const result = await tapPipeline.applyBatch(userId, count, tapHelpers);
    if (!result.ok) {
      if (result.error === "TOO_FAST") {
        await tapPipeline.flushUser(userId, tapHelpers);
        await logTapViolation(userId, result.violations || 0);
        res.status(429).json({
          error: "TOO_FAST",
          retryAfterMs: result.retryAfterMs || TAP_RATE_WINDOW_MS
        });
        return;
      }

      if (result.error === "NO_ENERGY") {
        res.status(400).json({ error: "NO_ENERGY", user: toClientUser(result.row) });
        return;
      }

      res.status(400).json({ error: result.error || "TAP_FAILED" });
      return;
    }

    res.json({
      amount: result.amount,
      applied: result.applied,
      count: result.count,
      user: toClientUser(result.row)
    });
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
    syncTapCache(userId, data);

    res.json({ cost, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/verify-channel-subscription", requirePlayer, async (req, res) => {
  try {
    const check = await verifyChannelSubscriptionStrict(req.playerId);
    if (!check.ok) {
      rejectChannelSubscription(res);
      return;
    }

    const referralQualified = await tryQualifyPendingReferral(req.playerId);

    res.json({ success: true, status: check.status, referralQualified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/referral/sync", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const sync = await syncReferralAfterChannelJoin(userId);

    if (!sync.ok) {
      res.json({
        ok: false,
        channelRequired: true,
        channelUrl: sync.channelUrl,
        channelMessage: sync.channelMessage
      });
      return;
    }

    const row = await loadGame(userId);
    const referralCount = await getReferralCount(userId);

    res.json({
      ok: true,
      referralQualified: Boolean(sync.referralQualified),
      user: toClientUser(row, { referralCount })
    });
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

    if (isChannelJoinTask(task)) {
      const check = await verifyChannelSubscriptionStrict(userId);
      if (!check.ok) {
        rejectChannelSubscription(res);
        return;
      }
    } else if (!taskReady(row, task)) {
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
    syncTapCache(userId, data);

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
    syncTapCache(userId, data);

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
      syncTapCache(userId, data);

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
      syncTapCache(userId, data);

      res.json({ ok: true, reward, user: toClientUser(data) });
      return;
    }

    if (Boolean(row[earnTask.field])) {
      res.status(400).json({ error: "ALREADY_CLAIMED" });
      return;
    }

    if (type === "channel") {
      const check = await verifyChannelSubscriptionStrict(userId);
      if (!check.ok) {
        rejectChannelSubscription(res);
        return;
      }
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
    syncTapCache(userId, data);

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
      updated.last_energy_updated_at = nowMs();
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
    syncTapCache(userId, data);

    res.json({ ok: true, boost, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stars/products", (_req, res) => {
  const products = Object.keys(STAR_PRODUCTS).map((id) => {
    const product = getStarProduct(id);
    return {
      id,
      stars: product.stars,
      title: product.title,
      description: product.description
    };
  });

  res.json({ ok: true, products });
});

app.post("/api/stars/invoice", requirePlayerOrTelegram, paymentSecurity.starsInvoiceRateLimit, async (req, res) => {
  try {
    const tokenUserId = String(req.playerId || "");
    const productId = String(req.body.productId || "").trim();
    const product = getStarProduct(productId);
    const payloadUserId = tokenUserId;

    if (!tokenUserId || !product) {
      res.status(400).json({ ok: false, error: "BAD_PRODUCT" });
      return;
    }

    if (!TELEGRAM_BOT_TOKEN) {
      res.status(503).json({ ok: false, error: "STARS_NOT_CONFIGURED" });
      return;
    }

    if (!telegramStars.STARS_PRODUCTION_MODE) {
      res.status(503).json({ ok: false, error: "STARS_TEST_MODE_DISABLED" });
      return;
    }

    const invoice = await telegramApiSafe(
      "createInvoiceLink",
      telegramStars.buildStarsInvoiceBody({
        title: product.title,
        description: product.description,
        payload: starPayload(payloadUserId, productId),
        stars: product.stars,
        priceLabel: starPriceLabel(product, productId)
      })
    );

    if (!invoice.ok || !invoice.result) {
      console.error("CREATE_INVOICE_LINK_FAILED:", productId, invoice.error);
      res.status(502).json({
        ok: false,
        error: "INVOICE_CREATE_FAILED",
        message: invoice.error || "Could not create Telegram Stars payment link."
      });
      return;
    }

    const invoiceLink = String(invoice.result || "").trim();
    if (!invoiceLink.startsWith("https://")) {
      res.status(502).json({
        ok: false,
        error: "INVALID_INVOICE_LINK",
        message: "Telegram returned an invalid payment link."
      });
      return;
    }

    res.json({
      ok: true,
      invoiceLink,
      productionMode: true,
      product: {
        id: productId,
        stars: Number(product.stars),
        title: product.title,
        priceLabel: starPriceLabel(product, productId)
      }
    });
  } catch (error) {
    console.error("STARS_INVOICE_ERROR:", error.message);
    res.status(500).json({
      ok: false,
      error: "INVOICE_ERROR",
      message: error.message || "Could not create payment link."
    });
  }
});

app.post("/api/telegram/webhook/:secret", paymentSecurity.createTelegramWebhookGuard({
  webhookSecret: TELEGRAM_WEBHOOK_SECRET
}), async (req, res) => {
  const update = req.body;
  if (!update || typeof update !== "object") {
    res.json({ ok: true });
    return;
  }

  try {
    if (update.pre_checkout_query) {
      res.json({ ok: true });
      telegramStars.answerPreCheckoutQuery(
        telegramApiSafe,
        update.pre_checkout_query,
        {
          starProducts: getStarProductsMap(),
          parseStarPayload,
          logFraud: (detail) => paymentSecurity.logPaymentFraud(supabase, detail)
        }
      ).catch((error) => {
        console.error("PRE_CHECKOUT_HANDLER_ERROR:", error.message);
      });
      return;
    }

    if (update.message?.successful_payment) {
      const result = await telegramStars.handleSuccessfulPayment(
        update.message,
        {
          ...getTelegramStarsOptions(),
          logFraud: (detail) => paymentSecurity.logPaymentFraud(supabase, detail)
        }
      );
      res.json({ ok: true, settled: Boolean(result?.ok), duplicate: Boolean(result?.duplicate) });
      return;
    }

    if (update.message) {
      await handleBotMessage(update.message, { telegramApiSafe });
      res.json({ ok: true });
      return;
    }
  } catch (error) {
    console.error("TELEGRAM_WEBHOOK_ERROR:", error.message);
  }

  res.json({ ok: true });
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
      invoicePayload: String(req.body.invoicePayload || ""),
      telegramSettled: true
    });

    res.json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      replay: Boolean(result.replay),
      productId: result.productId,
      user: toClientUser(result.user),
      premiumSpinReady: Boolean(result.premiumSpinReady)
    });
  } catch (error) {
    if (error.code === "FRAUD_REPLAY") {
      res.status(200).json({ ok: true, duplicate: true, replay: true });
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
    syncTapCache(userId, data);

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
  requirePlayer,
  premiumSpinSecurity.premiumSpinRateLimit,
  async (req, res) => {
  try {
    const userId = req.playerId;
    const payment = await premiumSpin.findPendingPremiumPayment(supabase, userId);

    res.json({
      ok: true,
      ready: Boolean(payment),
      chargeId: payment?.charge_id || "",
      telegramConfirmed: Boolean(payment?.telegram_settled)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/premium-spin",
  requirePlayer,
  premiumSpinSecurity.premiumSpinRateLimit,
  async (req, res) => {
  try {
    const userId = req.playerId;

    const macro = await macroGuard.enforceMacroGuard(supabase, userId, "spin");
    if (macro.blocked) {
      res.status(403).json({
        error: macro.banned ? "ACCOUNT_BANNED" : "MACRO_DETECTED",
        message: "Suspicious activity detected."
      });
      return;
    }

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

    const payment = await premiumSpin.findPendingPremiumPayment(supabase, userId);

    if (!payment) {
      res.status(402).json({ error: "NO_PAYMENT" });
      return;
    }

    if (!payment.telegram_settled) {
      res.status(402).json({ error: "PAYMENT_NOT_SETTLED" });
      return;
    }

    if (!payment.charge_id) {
      res.status(402).json({ error: "MISSING_CHARGE_ID" });
      return;
    }

    if (number(payment.stars_amount) !== premiumSpin.getPremiumSpinStars()) {
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

    const globalSpins = await premiumSpin.incrementGlobalPremiumSpins(supabase);
    const prize = await premiumSpin.rollPremiumPrize(supabase, globalSpins);
    const row = await loadGame(userId);

    const username = String(buyer?.username || "").trim();
    const displayName = buyer?.first_name || `Player ${String(userId).slice(-4)}`;

    if (prize.type === "cash") {
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
      syncTapCache(userId, saved);
    }

    res.json({
      ok: true,
      success: true,
      winnerSliceId: prize.segmentIndex,
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
      syncTapCache(userId, data);

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
      syncTapCache(userId, data);

      res.json({ ok: true, user: toClientUser(data) });
      return;
    }

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: NEW_PLAYER_BONUS,
        energy: MAX_ENERGY,
        max_energy: MAX_ENERGY,
        energy_regen_rate: economy.BASE_ENERGY_REGEN_RATE,
        last_energy_updated_at: nowMs(),
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
    syncTapCache(userId, saved);

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
      systemBotRows
    );
    dailyTopData = buildDailyPodiumRows(dailyCandidates);
    const dailyListData = dailyMerged.slice(0, DAILY_LEADERBOARD_LIMIT);

    if (yourDailyGame && userId) {
      yourDailyRank = computeGlobalDailyRank(
        dailyCandidates,
        userId,
        number(yourDailyGame.daily_contest_score)
      );
    }

    const dailyIds = [
      ...dailyMerged.map((row) => row.user_id),
      ...dailyTopData.map((row) => row.user_id)
    ];
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

    const youInDailyTop3 = dailyTop3.some((row) => row.isYou);
    const youInDailyList = dailyRows.some((row) => row.isYou);
    const dailyYou = yourDailyGame && !youInDailyTop3 && !youInDailyList
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

    const { data: starPayments, error: starPaymentsError } = await supabase
      .from("star_payments")
      .select("stars_amount")
      .eq("telegram_settled", true);

    if (starPaymentsError && starPaymentsError.code !== "PGRST205") throw starPaymentsError;

    const totalStarsRevenue = (starPayments || []).reduce(
      (sum, row) => sum + number(row.stars_amount),
      0
    );

    const { count: pendingCashPayouts, error: pendingPayoutsError } = await supabase
      .from("pending_payouts")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (pendingPayoutsError && pendingPayoutsError.code !== "PGRST205") throw pendingPayoutsError;

    let globalSpinCount = 0;
    let spinMilestones = null;
    try {
      await gameSettings.loadSettings(supabase);
      globalSpinCount = await premiumSpin.getGlobalPremiumSpins(supabase);
      spinMilestones = premiumSpin.getSpinMilestoneInfo(globalSpinCount);
    } catch (spinError) {
      console.warn("ADMIN_SPIN_MONITOR_FAILED:", spinError.message);
    }

    res.json({
      players: {
        total: totalPlayers || 0,
        activeToday: activeToday || 0
      },
      totals,
      revenue,
      stars: {
        totalRevenue: totalStarsRevenue
      },
      payouts: {
        pendingCash: pendingCashPayouts || 0
      },
      spinMonitor: {
        globalSpinCount,
        milestones: spinMilestones
      },
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
    syncTapCache(userId, data);

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

    const { data } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + prize,
        city_value: number(row.coins) + prize + number(row.spent),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", entry.user_id)
      .select("*")
      .single();

    syncTapCache(entry.user_id, data);

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

app.get("/api/admin/spin-winners", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const status = String(req.query.status || "all").trim() || "all";
    let query = supabase
      .from("pending_payouts")
      .select("*")
      .in("prize_id", ["cash_10", "cash_5", "cash_2"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (status === "pending") {
      query = query.eq("status", "pending");
    } else if (status === "paid" || status === "completed") {
      query = query.eq("status", "completed");
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username || "",
      displayName: row.display_name || "",
      wonAmountUsd: number(row.amount_usd),
      prizeId: row.prize_id || "",
      status: row.status === "completed" ? "paid" : "pending",
      createdAt: row.created_at,
      completedAt: row.completed_at || null
    }));

    res.json({ rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/fraud-alerts", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const limit = Math.min(200, Math.max(1, number(req.query.limit) || 100));
    const { data, error } = await supabase
      .from("fraud_events")
      .select("id, user_id, event_type, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const userIds = [...new Set((data || []).map((row) => String(row.user_id || "")).filter(Boolean))];
    const { data: users } = userIds.length
      ? await supabase
        .from("users")
        .select("id, username, first_name, is_banned")
        .in("id", userIds)
      : { data: [] };

    const userMap = new Map((users || []).map((user) => [user.id, user]));

    const rows = (data || []).map((row) => {
      const user = userMap.get(row.user_id) || {};
      return {
        id: row.id,
        userId: row.user_id,
        username: user.username || "",
        displayName: user.first_name || "",
        eventType: row.event_type,
        detail: row.detail,
        createdAt: row.created_at,
        isBanned: Boolean(user.is_banned)
      };
    });

    res.json({ rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/referrals-analytics", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const analytics = await buildReferralsAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/ban-user", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const userId = String(req.body.userId || "").trim();
    const reason = String(req.body.reason || "Fraud / anti-cheat violation").trim().slice(0, 500);

    if (!userId) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        ban_reason: reason
      })
      .eq("id", userId)
      .select("id, username, first_name, is_banned, banned_at, ban_reason")
      .single();

    if (error) throw error;

    await premiumSpinSecurity.logFraudEvent(supabase, {
      userId,
      eventType: "ADMIN_BAN",
      detail: reason
    });

    res.json({ ok: true, user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/spin-monitor", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    await gameSettings.loadSettings(supabase, { force: true });
    const globalSpinCount = await premiumSpin.getGlobalPremiumSpins(supabase);
    const milestones = premiumSpin.getSpinMilestoneInfo(globalSpinCount);

    res.json({
      globalSpinCount,
      milestones
    });
  } catch (error) {
    console.error("ADMIN_SPIN_MONITOR_ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/game-settings", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const settings = await gameSettings.loadSettings(supabase, { force: true });
    res.json({ ok: true, settings });
  } catch (error) {
    console.error("ADMIN_GAME_SETTINGS_GET_ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/game-settings", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const settings = await gameSettings.saveSettings(supabase, {
      premium_spin_stars: req.body.premium_spin_stars,
      cash_10_interval: req.body.cash_10_interval,
      cash_5_interval: req.body.cash_5_interval,
      cash_2_interval: req.body.cash_2_interval
    });

    STAR_PRODUCTS.premium_spin.stars = settings.premium_spin_stars;

    res.json({ ok: true, settings });
  } catch (error) {
    console.error("ADMIN_GAME_SETTINGS_SAVE_ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/broadcast", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      res.status(400).json({ error: "EMPTY_MESSAGE" });
      return;
    }

    if (message.length > 4096) {
      res.status(400).json({ error: "MESSAGE_TOO_LONG" });
      return;
    }

    if (!TELEGRAM_BOT_TOKEN) {
      res.status(503).json({ error: "BOT_NOT_CONFIGURED" });
      return;
    }

    const dayAgo = new Date(nowMs() - 24 * 60 * 60 * 1000).toISOString();
    const { data: users, error } = await supabase
      .from("users")
      .select("id, first_name")
      .eq("is_banned", false)
      .gte("last_seen_at", dayAgo)
      .order("last_seen_at", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const recipients = users || [];
    let sent = 0;
    let failed = 0;
    const BATCH_SIZE = 30;
    const BATCH_DELAY_MS = 1000;

    for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
      const batch = recipients.slice(index, index + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (user) => {
        try {
          const ok = await sendPushMessage(user.id, message);
          return ok;
        } catch (sendError) {
          console.warn("BROADCAST_SEND_FAILED:", user.id, sendError.message);
          return false;
        }
      }));

      results.forEach((ok) => {
        if (ok) sent += 1;
        else failed += 1;
      });

      if (index + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    res.json({
      ok: true,
      sent,
      failed,
      total: recipients.length
    });
  } catch (error) {
    console.error("ADMIN_BROADCAST_ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/give-reward", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const userId = String(req.body.userId || req.body.telegramId || "").trim();
    const amount = Math.floor(number(req.body.amount));
    const rewardType = String(req.body.type || "coins").trim().toLowerCase();

    if (!userId || amount <= 0) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    if (!["coins", "tickets"].includes(rewardType)) {
      res.status(400).json({ error: "INVALID_REWARD_TYPE" });
      return;
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, is_banned")
      .eq("id", userId)
      .maybeSingle();

    if (userError) throw userError;

    if (!userRow) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    if (userRow.is_banned) {
      res.status(400).json({ error: "USER_BANNED" });
      return;
    }

    const row = await loadGame(userId);
    const productUpdate = rewardType === "coins"
      ? applyCoinPackPurchase(row, amount)
      : applyTicketPackPurchase(row, amount);

    const { data, error } = await supabase
      .from("game_states")
      .update(productUpdate)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    syncTapCache(userId, data);

    await logMetric("manual_grant", amount, `Admin ${rewardType} reward`, { userId, rewardType });

    let notified = false;
    try {
      notified = await sendPushMessage(
        userId,
        "An administrator has credited your account with a reward!"
      );
    } catch (notifyError) {
      console.warn("ADMIN_REWARD_NOTIFY_FAILED:", userId, notifyError.message);
    }

    res.json({
      ok: true,
      amount,
      type: rewardType,
      notified,
      user: toClientUser(data)
    });
  } catch (error) {
    console.error("ADMIN_GIVE_REWARD_ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/user-profile", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const query = String(req.query.query || req.query.q || "").trim();
    if (!query) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const user = await findUserByAdminQuery(query);
    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    const { row, exists: hasGameState } = await loadGameRowForAdmin(user.id);
    const totalSpins = await getUserTotalSpins(user.id);

    res.json({
      ok: true,
      profile: toAdminUserProfile(user, row, totalSpins)
    });
  } catch (error) {
    console.error("ADMIN_USER_PROFILE_GET_ERROR:", error.message);
    const payload = { error: error.message };
    if (isMissingColumnError(error)) {
      payload.error = "MIGRATION_REQUIRED";
      payload.detail = "Run supabase/migration-user-ban.sql and migration-promo-codes.sql";
    }
    res.status(500).json(payload);
  }
});

app.post("/api/admin/user-profile", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const userId = String(req.body.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const user = await queryAdminUser((request) => request.eq("id", userId));
    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }

    const { row, exists: hasGameState } = await loadGameRowForAdmin(userId);
    const gamePatch = {
      updated_at: new Date().toISOString()
    };

    if (req.body.coins !== undefined) {
      const coins = Math.max(0, Math.floor(number(req.body.coins)));
      gamePatch.coins = coins;
      gamePatch.city_value = coins + number(row.spent);
    }

    if (req.body.tickets !== undefined) {
      Object.assign(gamePatch, applyTicketsValue(row, req.body.tickets));
    }

    let game = row;
    const shouldUpdateGame = req.body.coins !== undefined || req.body.tickets !== undefined;

    if (shouldUpdateGame) {
      if (hasGameState) {
        const { data, error: gameError } = await supabase
          .from("game_states")
          .update(gamePatch)
          .eq("user_id", userId)
          .select("*")
          .single();

        if (gameError) throw gameError;
        game = data;
      } else {
        const { data, error: gameError } = await supabase
          .from("game_states")
          .insert({
            user_id: userId,
            coins: gamePatch.coins ?? 0,
            city_value: gamePatch.city_value ?? 0,
            energy: MAX_ENERGY,
            max_energy: MAX_ENERGY,
            energy_regen_rate: economy.BASE_ENERGY_REGEN_RATE,
            last_energy_updated_at: nowMs(),
            taps: 0,
            spent: 0,
            shop_level: 1,
            bank_level: 0,
            factory_level: 0,
            casino_level: 0,
            casino_date: "",
            daily_contest_score: gamePatch.daily_contest_score ?? 0,
            contest_date: gamePatch.contest_date ?? "",
            contest_baseline_city: gamePatch.contest_baseline_city ?? 0,
            last_seen_at: new Date().toISOString(),
            updated_at: gamePatch.updated_at
          })
          .select("*")
          .single();

        if (gameError) throw gameError;
        game = data;
      }
    }

    if (shouldUpdateGame) {
      syncTapCache(userId, game);
    }

    let updatedUser = user;
    if (req.body.isBanned !== undefined) {
      const shouldBan = Boolean(req.body.isBanned);
      const userPatch = {
        is_banned: shouldBan,
        ban_reason: shouldBan
          ? String(req.body.banReason || "Banned by administrator").slice(0, 500)
          : "",
        banned_at: shouldBan ? new Date().toISOString() : null
      };

      const { data, error } = await supabase
        .from("users")
        .update(userPatch)
        .eq("id", userId)
        .select("id, first_name, username, created_at, is_banned, banned_at, ban_reason, last_seen_at")
        .single();

      if (error) throw error;
      updatedUser = data;

      if (shouldBan) {
        await premiumSpinSecurity.logFraudEvent(supabase, {
          userId,
          eventType: "ADMIN_BAN",
          detail: userPatch.ban_reason
        });
      }
    }

    const totalSpins = await getUserTotalSpins(userId);

    res.json({
      ok: true,
      profile: toAdminUserProfile(updatedUser, game, totalSpins)
    });
  } catch (error) {
    console.error("ADMIN_USER_PROFILE_UPDATE_ERROR:", error.message);
    const payload = { error: error.message };
    if (isMissingColumnError(error)) {
      payload.error = "MIGRATION_REQUIRED";
      payload.detail = "Run supabase/migration-user-ban.sql and migration-promo-codes.sql";
    }
    res.status(500).json(payload);
  }
});

app.get("/api/admin/promo-codes", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({
      rows: (data || []).map((row) => ({
        id: row.id,
        code: row.code,
        coinReward: number(row.coin_reward),
        ticketReward: number(row.ticket_reward),
        maxUses: number(row.max_uses),
        usesCount: number(row.uses_count),
        active: Boolean(row.active),
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("ADMIN_PROMO_LIST_ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/promo-codes", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const maxUses = Math.max(1, Math.floor(number(req.body.maxUses)));
    const coinReward = Math.max(0, Math.floor(number(req.body.coinReward)));
    const ticketReward = Math.max(0, Math.floor(number(req.body.ticketReward)));

    if (!code || code.length < 3 || code.length > 32) {
      res.status(400).json({ error: "INVALID_CODE" });
      return;
    }

    if (coinReward <= 0 && ticketReward <= 0) {
      res.status(400).json({ error: "EMPTY_REWARDS" });
      return;
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .insert({
        code,
        max_uses: maxUses,
        coin_reward: coinReward,
        ticket_reward: ticketReward,
        uses_count: 0,
        active: true
      })
      .select("*")
      .single();

    if (error) throw error;

    res.json({
      ok: true,
      promo: {
        id: data.id,
        code: data.code,
        coinReward: number(data.coin_reward),
        ticketReward: number(data.ticket_reward),
        maxUses: number(data.max_uses),
        usesCount: number(data.uses_count),
        active: Boolean(data.active),
        createdAt: data.created_at
      }
    });
  } catch (error) {
    console.error("ADMIN_PROMO_CREATE_ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/promo/redeem", requirePlayer, async (req, res) => {
  try {
    const userId = req.playerId;
    const code = String(req.body.code || "").trim().toUpperCase();

    if (!code) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("is_banned")
      .eq("id", userId)
      .maybeSingle();

    if (userError) throw userError;
    if (user?.is_banned) {
      res.status(403).json({ error: "ACCOUNT_BANNED" });
      return;
    }

    const { data: promo, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (promoError) throw promoError;

    if (!promo) {
      res.status(404).json({ error: "INVALID_CODE" });
      return;
    }

    if (number(promo.uses_count) >= number(promo.max_uses)) {
      res.status(400).json({ error: "CODE_EXHAUSTED" });
      return;
    }

    const { data: existingRedemption } = await supabase
      .from("promo_redemptions")
      .select("id")
      .eq("promo_code_id", promo.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRedemption) {
      res.status(400).json({ error: "ALREADY_REDEEMED" });
      return;
    }

    const row = await loadGame(userId);
    let mergedRow = { ...row };
    let gamePatch = { updated_at: new Date().toISOString() };

    if (number(promo.coin_reward) > 0) {
      const coinPatch = applyCoinPackPurchase(mergedRow, number(promo.coin_reward));
      gamePatch = { ...gamePatch, ...coinPatch };
      mergedRow = { ...mergedRow, ...coinPatch };
    }

    if (number(promo.ticket_reward) > 0) {
      const ticketPatch = applyTicketPackPurchase(mergedRow, number(promo.ticket_reward));
      gamePatch = { ...gamePatch, ...ticketPatch };
    }

    const { data: updatedPromo, error: promoUpdateError } = await supabase
      .from("promo_codes")
      .update({ uses_count: number(promo.uses_count) + 1 })
      .eq("id", promo.id)
      .lt("uses_count", promo.max_uses)
      .select("*")
      .maybeSingle();

    if (promoUpdateError) throw promoUpdateError;
    if (!updatedPromo) {
      res.status(400).json({ error: "CODE_EXHAUSTED" });
      return;
    }

    const { error: redemptionError } = await supabase
      .from("promo_redemptions")
      .insert({
        promo_code_id: promo.id,
        user_id: userId
      });

    if (redemptionError) {
      await supabase
        .from("promo_codes")
        .update({ uses_count: number(promo.uses_count) })
        .eq("id", promo.id);
      throw redemptionError;
    }

    const { data: game, error: gameError } = await supabase
      .from("game_states")
      .update(gamePatch)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (gameError) throw gameError;
    syncTapCache(userId, game);

    res.json({
      ok: true,
      code: promo.code,
      coinReward: number(promo.coin_reward),
      ticketReward: number(promo.ticket_reward),
      user: toClientUser(game)
    });
  } catch (error) {
    console.error("PROMO_REDEEM_ERROR:", error.message);
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
    const webAppUrl = process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/v5.html?v=2108";
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

  tapPipeline.initRedis().then(() => {
    tapPipeline.startFlushLoop(tapHelpers);
    console.log("Tap pipeline flush loop started");
  }).catch((error) => {
    console.warn("Tap pipeline init failed:", error.message);
    tapPipeline.startFlushLoop(tapHelpers);
  });

  const shutdownFlush = async () => {
    try {
      await tapPipeline.flushAll(tapHelpers);
    } catch (error) {
      console.error("TAP_SHUTDOWN_FLUSH_FAILED:", error.message);
    }
  };

  process.once("SIGTERM", () => {
    shutdownFlush().finally(() => process.exit(0));
  });
  process.once("SIGINT", () => {
    shutdownFlush().finally(() => process.exit(0));
  });

  gameSettings.loadSettings(supabase, { force: true }).then((settings) => {
    STAR_PRODUCTS.premium_spin.stars = settings.premium_spin_stars;
    console.log("Game settings loaded:", settings);
  }).catch((error) => {
    console.warn("Game settings preload failed:", error.message);
  });

  if (TELEGRAM_BOT_TOKEN) {
    setupBotProfile().catch((error) => {
      console.warn("Bot profile setup failed:", error.message);
    });

    telegramStars.startStarsPaymentListener(telegramApiSafe, {
      secret: TELEGRAM_WEBHOOK_SECRET,
      baseUrl: WEBHOOK_BASE_URL,
      starProducts: getStarProductsMap(),
      parseStarPayload,
      fulfillPayment: fulfillStarPaymentRecord,
      handleBotMessage,
      sendBotMessage: async (chatId, text) => {
        await telegramApiSafe("sendMessage", { chat_id: chatId, text });
      }
    }).then((listener) => {
      console.log(`Stars payment listener mode: ${listener.mode}`);
    }).catch((error) => {
      console.warn("Stars payment listener failed:", error.message);
    });
  }
});
