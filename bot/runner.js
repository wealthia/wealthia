const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/merge-arena/app/?v=33";
const BACKEND_URL = process.env.BACKEND_URL || "https://wealthia-backend.onrender.com";
const STARS_WEBHOOK_SECRET = process.env.STARS_WEBHOOK_SECRET || process.env.ADMIN_SECRET || "";
const CRON_SECRET = process.env.CRON_SECRET || STARS_WEBHOOK_SECRET || "";
const ENABLE_DAILY_PUSH = process.env.ENABLE_DAILY_PUSH === "true";
const DAILY_PUSH_HOUR_UTC = Number(process.env.DAILY_PUSH_HOUR_UTC || 10);
const DISABLE_BOT_POLLING = process.env.DISABLE_BOT_POLLING === "true";
const telegramStars = require("../server/telegram-stars");
const {
  apiSafe,
  handleBotMessage,
  setupBotProfile,
  PLAY_BUTTON_TEXT
} = require("./commands");

const STAR_PRODUCT_IDS = new Set([
  "refill_energy",
  "tap_boost_30",
  "endless_energy_30",
  "income_boost_30",
  "premium_spin",
  "tickets_1",
  "tickets_5",
  "tickets_10",
  "tickets_50",
  "tickets_100",
  "coins_5000",
  "coins_15000",
  "coins_50000",
  "coins_150000",
  "coins_500000"
]);

const STAR_PRODUCT_STARS = {
  refill_energy: 5,
  tap_boost_30: 10,
  endless_energy_30: 15,
  income_boost_30: 15,
  premium_spin: 30,
  tickets_1: 5,
  tickets_5: 20,
  tickets_10: 35,
  tickets_50: 150,
  tickets_100: 250,
  coins_5000: 10,
  coins_15000: 25,
  coins_50000: 70,
  coins_150000: 180,
  coins_500000: 450
};

const STAR_SUCCESS_MESSAGES = {
  refill_energy: "Energy refilled to 100%!",
  tap_boost_30: "2x Tap boost active for 30 minutes!",
  endless_energy_30: "Endless Energy active for 30 minutes!",
  income_boost_30: "2x Income boost active for 30 minutes!",
  premium_spin: "Premium spin ready!",
  tickets_1: "+1 Ticket added!",
  tickets_5: "+5 Tickets added!",
  tickets_10: "+10 Tickets added!",
  tickets_50: "+50 Tickets added!",
  tickets_100: "+100 Tickets added!",
  coins_5000: "+5,000 Coins added!",
  coins_15000: "+15,000 Coins added!",
  coins_50000: "+50,000 Coins added!",
  coins_150000: "+150,000 Coins added!",
  coins_500000: "+500,000 Coins added!"
};

const STAR_PRODUCTS = Object.fromEntries(
  Object.entries(STAR_PRODUCT_STARS).map(([id, stars]) => [
    id,
    {
      stars,
      title: id,
      description: id,
      successMessage: STAR_SUCCESS_MESSAGES[id] || "Premium purchase activated!"
    }
  ])
);

let offset = 0;
let started = false;

function getApiBase() {
  if (!TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN missing");
  }

  return `https://api.telegram.org/bot${TOKEN}`;
}

async function api(method, body) {
  const safe = await apiSafe(method, body);
  if (!safe.ok) {
    throw new Error(safe.error || "Telegram API error");
  }
  return safe.result;
}

function parseStarPayload(payload) {
  const parts = String(payload || "").split("|");
  if (parts.length !== 3 || parts[0] !== "w") return null;
  return { userId: parts[1], productId: parts[2] };
}

async function fulfillStarPayment(userId, productId, chargeId, stars, invoicePayload) {
  if (!STARS_WEBHOOK_SECRET) {
    throw new Error("STARS_WEBHOOK_SECRET or ADMIN_SECRET missing");
  }

  const response = await fetch(`${BACKEND_URL}/api/stars/fulfill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: STARS_WEBHOOK_SECRET,
      userId,
      productId,
      chargeId,
      stars,
      invoicePayload
    })
  });

  const result = await response.json();
  if (!response.ok && !(response.status === 200 && result.duplicate)) {
    throw new Error(result.error || "Fulfillment failed");
  }

  return result;
}

async function handlePreCheckout(query) {
  await telegramStars.answerPreCheckoutQuery(apiSafe, query, {
    starProducts: STAR_PRODUCTS,
    parseStarPayload
  });
}

async function handleSuccessfulPayment(message) {
  await telegramStars.handleSuccessfulPayment(message, {
    telegramApiSafe: apiSafe,
    starProducts: STAR_PRODUCTS,
    parseStarPayload,
    fulfillPayment: async ({ userId, productId, chargeId, stars, invoicePayload }) => {
      await fulfillStarPayment(userId, productId, chargeId, stars, invoicePayload);
    },
    sendBotMessage: async (chatId, text) => {
      await api("sendMessage", { chat_id: chatId, text });
    }
  });
}

async function handleMessage(message) {
  if (message.successful_payment) {
    await handleSuccessfulPayment(message);
    return;
  }

  const handled = await handleBotMessage(message, { telegramApiSafe: apiSafe });
  if (handled) return;

  const chatId = message.chat.id;
  await api("sendMessage", {
    chat_id: chatId,
    text: "Use /start to play Wealthia.",
    reply_markup: {
      inline_keyboard: [[{ text: PLAY_BUTTON_TEXT, web_app: { url: WEBAPP_URL } }]]
    }
  });
}

async function poll() {
  try {
    const updates = await api("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message", "pre_checkout_query"]
    });

    for (const update of updates) {
      offset = update.update_id + 1;

      if (update.pre_checkout_query) {
        await handlePreCheckout(update.pre_checkout_query);
      }

      if (update.message) {
        await handleMessage(update.message);
      }
    }
  } catch (error) {
    console.error("Poll error:", error.message);
    await new Promise((r) => setTimeout(r, 3000));
  }

  setImmediate(poll);
}

function startBotPolling() {
  if (started) return;
  if (!TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN missing");
  }

  started = true;

  if (DISABLE_BOT_POLLING) {
    console.log("Telegram polling disabled — Stars payments handled by backend webhook.");
    setupBotProfile().finally(() => {
      scheduleDailyPush();
      scheduleDailyLottery();
      scheduleSystemBotsTick();
    });
    return;
  }

  console.log("Telegram bot polling started.");
  console.log("WebApp:", WEBAPP_URL);

  setupBotProfile().finally(() => {
    poll();
    scheduleDailyPush();
    scheduleDailyLottery();
    scheduleSystemBotsTick();
  });
}

let lastDailyPushDate = "";
let lastLotteryDate = "";

async function runDailyLotteryCron() {
  if (!CRON_SECRET) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/cron/daily-lottery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result && result.winnerLabel) {
      console.log(`Daily lottery winner for ${result.contestDate}: ${result.winnerLabel}`);
    } else if (result && result.skipped) {
      console.log("Daily lottery skipped:", result.reason || "unknown");
    }
  } catch (error) {
    console.warn("Daily lottery cron failed:", error.message);
  }
}

function scheduleDailyLottery() {
  setInterval(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getUTCHours();
    const minute = new Date().getUTCMinutes();

    if (hour === 0 && minute === 0 && lastLotteryDate !== today) {
      lastLotteryDate = today;
      runDailyLotteryCron();
    }
  }, 60 * 1000);
}

async function runSystemBotsTickCron() {
  if (!CRON_SECRET) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/cron/system-bots-tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result && result.updated) {
      console.log(`System bots tick updated ${result.updated} bot(s).`);
    }
  } catch (error) {
    console.warn("System bots tick cron failed:", error.message);
  }
}

function scheduleSystemBotsTick() {
  const intervalMs = Math.max(
    10,
    Number(process.env.SYSTEM_BOT_TICK_MINUTES || 12)
  ) * 60 * 1000;

  runSystemBotsTickCron();
  setInterval(runSystemBotsTickCron, intervalMs);
}

async function runDailyPushCron() {
  if (!CRON_SECRET) return;

  try {
    const response = await fetch(`${BACKEND_URL}/api/cron/daily-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result.sent) {
      console.log(`Daily push sent to ${result.sent} players.`);
    }
  } catch (error) {
    console.warn("Daily push cron failed:", error.message);
  }
}

function scheduleDailyPush() {
  if (!ENABLE_DAILY_PUSH) return;

  setInterval(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getUTCHours();
    if (hour === DAILY_PUSH_HOUR_UTC && lastDailyPushDate !== today) {
      lastDailyPushDate = today;
      runDailyPushCron();
    }
  }, 30 * 60 * 1000);
}

module.exports = { startBotPolling };
