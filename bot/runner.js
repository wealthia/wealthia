const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBAPP_URL = process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/v5.html?v=2063";
const BOT_USERNAME = process.env.BOT_USERNAME || "WealthiaGameBot";
const CHANNEL_URL = process.env.CHANNEL_URL || "";
const BACKEND_URL = process.env.BACKEND_URL || "https://wealthia-backend.onrender.com";
const STARS_WEBHOOK_SECRET = process.env.STARS_WEBHOOK_SECRET || process.env.ADMIN_SECRET || "";
const CRON_SECRET = process.env.CRON_SECRET || STARS_WEBHOOK_SECRET || "";
const ENABLE_DAILY_PUSH = process.env.ENABLE_DAILY_PUSH === "true";
const DAILY_PUSH_HOUR_UTC = Number(process.env.DAILY_PUSH_HOUR_UTC || 10);
const DISABLE_BOT_POLLING = process.env.DISABLE_BOT_POLLING === "true";
const telegramStars = require("../server/telegram-stars");

const STAR_PRODUCT_IDS = new Set([
  "refill_energy",
  "tap_boost_30",
  "endless_energy_30",
  "income_boost_30",
  "premium_spin"
]);

const STAR_PRODUCT_STARS = {
  refill_energy: 5,
  tap_boost_30: 10,
  endless_energy_30: 15,
  income_boost_30: 15,
  premium_spin: 50
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

const STAR_SUCCESS_MESSAGES = {
  refill_energy: "Energy refilled to 100%!",
  tap_boost_30: "2x Tap boost active for 30 minutes!",
  endless_energy_30: "Endless Energy active for 30 minutes!",
  income_boost_30: "2x Income boost active for 30 minutes!",
  premium_spin: "Premium spin ready!"
};

const BOT_DESCRIPTION = process.env.BOT_DESCRIPTION || [
  "🏙️ Wealthia — Build your wealth empire in Telegram!",
  "",
  "Tap for coins, upgrade your city, complete daily missions and climb the leaderboard.",
  "Invite friends for +500 bonus coins.",
  "",
  "Press Start to play free."
].join("\n");

const BOT_SHORT_DESCRIPTION = process.env.BOT_SHORT_DESCRIPTION ||
  "Tap. Build. Earn. Free city-building clicker game in Telegram.";

let offset = 0;
let started = false;

function getApiBase() {
  if (!TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN missing");
  }

  return `https://api.telegram.org/bot${TOKEN}`;
}

async function apiSafe(method, body) {
  const response = await fetch(`${getApiBase()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!data.ok) {
    return { ok: false, error: data.description || "Telegram API error", result: null };
  }

  return { ok: true, error: "", result: data.result };
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
  if (!response.ok) {
    throw new Error(result.error || "Fulfillment failed");
  }

  return result;
}

async function setupBotProfile() {
  try {
    await api("setMyDescription", { description: BOT_DESCRIPTION });
    await api("setMyShortDescription", { short_description: BOT_SHORT_DESCRIPTION });
    await api("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Play Wealthia",
        web_app: { url: WEBAPP_URL }
      }
    });
    console.log("Bot profile updated (description + menu button).");
  } catch (error) {
    console.warn("Bot profile setup skipped:", error.message);
  }
}

function gameUrl(startParam) {
  if (!startParam) return WEBAPP_URL;
  return `${WEBAPP_URL}?tgWebAppStartParam=${encodeURIComponent(startParam)}`;
}

function welcomeText(firstName, referral) {
  const name = firstName || "Builder";
  const channelLine = CHANNEL_URL
    ? `\n📢 Join our channel for updates: ${CHANNEL_URL}\n`
    : "";

  if (referral) {
    return (
      `🏙️ Welcome to Wealthia, ${name}!\n\n` +
      `Your friend invited you to build a wealth empire.\n` +
      `Subscribe to our official Telegram channel, then open the game to unlock play.\n` +
      `Your friend earns +500 coins when you join and play.\n\n` +
      `🎁 New players get a welcome bonus!\n` +
      channelLine +
      `👇 Press Play to start`
    );
  }

  return (
    `🏙️ Welcome to Wealthia, ${name}!\n\n` +
    `Build your empire, tap for Wealth Coins, upgrade Shop, Bank and Factory.\n\n` +
    `✨ Daily missions refresh every 12 hours\n` +
    `👥 Invite friends → +500 coins each\n` +
    `📺 Watch ads in Earn tab for bonus coins\n` +
    `⭐ Premium boosts available with Telegram Stars\n` +
    `🏆 Compete on the global leaderboard\n` +
    channelLine +
    `👇 Press Play to start your empire`
  );
}

function startKeyboard(userId, startParam) {
  const ref = startParam && startParam.startsWith("ref_") ? startParam : `ref_${userId}`;
  const rows = [
    [
      {
        text: "🎮 Play Wealthia",
        web_app: { url: gameUrl(startParam || `ref_${userId}`) }
      }
    ],
    [
      {
        text: "👥 Invite Friends",
        url: `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_USERNAME}?start=${ref}`)}&text=${encodeURIComponent("Join my Wealthia empire!")}`
      }
    ]
  ];

  if (CHANNEL_URL) {
    rows.push([{ text: "📢 Official Channel", url: CHANNEL_URL }]);
  }

  return { inline_keyboard: rows };
}

async function handleStart(chatId, user, startParam) {
  const referral = startParam && startParam.startsWith("ref_");

  await api("sendMessage", {
    chat_id: chatId,
    text: welcomeText(user.first_name, referral),
    reply_markup: startKeyboard(user.id, startParam)
  });
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

  const text = message.text || "";
  const chatId = message.chat.id;
  const user = message.from;

  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const startParam = parts[1] || "";
    await handleStart(chatId, user, startParam);
    return;
  }

  if (text === "/play") {
    await handleStart(chatId, user, "");
    return;
  }

  if (text === "/channel") {
    if (!CHANNEL_URL) {
      await api("sendMessage", {
        chat_id: chatId,
        text: "Channel link is not configured yet."
      });
      return;
    }

    await api("sendMessage", {
      chat_id: chatId,
      text: `📢 Join the official Wealthia channel:\n${CHANNEL_URL}`,
      reply_markup: {
        inline_keyboard: [[{ text: "📢 Join Channel", url: CHANNEL_URL }]]
      }
    });
    return;
  }

  if (text === "/help") {
    await api("sendMessage", {
      chat_id: chatId,
      text:
        "Wealthia Commands:\n" +
        "/start — Open the game\n" +
        "/play — Play Wealthia\n" +
        "/channel — Official channel\n" +
        "/help — This message\n\n" +
        `Game: ${WEBAPP_URL}`
    });
    return;
  }

  await api("sendMessage", {
    chat_id: chatId,
    text: "Use /start to play Wealthia 🏙️",
    reply_markup: {
      inline_keyboard: [[{ text: "🎮 Play", web_app: { url: WEBAPP_URL } }]]
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
  if (CHANNEL_URL) console.log("Channel:", CHANNEL_URL);
  if (ENABLE_DAILY_PUSH) console.log("Daily push enabled at UTC hour", DAILY_PUSH_HOUR_UTC);

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
