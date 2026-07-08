const WEBAPP_URL = process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/v5.html?v=2102";
const BOT_USERNAME = process.env.BOT_USERNAME || "WealthiaGameBot";
const CHANNEL_URL = process.env.CHANNEL_URL || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const START_WELCOME_TEXT = `🏰 Welcome to Wealthia! 🏰

Your journey to building an unstoppable empire starts right here, right now. 🚀

⚡️ Energy Refilled & Ready!
🎲 Spin the Lucky Wheel!
🏗️ Build, Upgrade, and Dominate!

Are you ready to become the ultimate ruler? Tap the button below to launch the game and claim your daily rewards! 👇`;

const PLAY_BUTTON_TEXT = "🎮  Play Wealthia  🎮";

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

function getApiBase() {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN missing");
  }

  return `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
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

function isStartCommand(text) {
  return /^\/start(?:@\w+)?(?:\s|$)/i.test(String(text || "").trim());
}

function parseStartParam(text) {
  const parts = String(text || "").trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function gameUrl(startParam) {
  if (!startParam) return WEBAPP_URL;
  return `${WEBAPP_URL}?tgWebAppStartParam=${encodeURIComponent(startParam)}`;
}

function startKeyboard(userId, startParam) {
  const ref = startParam && startParam.startsWith("ref_") ? startParam : `ref_${userId}`;
  const rows = [
    [
      {
        text: PLAY_BUTTON_TEXT,
        web_app: { url: gameUrl(startParam || `ref_${userId}`) }
      }
    ],
    [
      {
        text: "Invite Friends",
        url: `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_USERNAME}?startapp=${ref}`)}&text=${encodeURIComponent("Join my Wealthia empire!")}`
      }
    ]
  ];

  if (CHANNEL_URL) {
    rows.push([{ text: "Official Channel", url: CHANNEL_URL }]);
  }

  return { inline_keyboard: rows };
}

async function sendStartWelcome(chatId, user, startParam = "", options = {}) {
  const sendApi = options.telegramApiSafe || apiSafe;
  const result = await sendApi("sendMessage", {
    chat_id: chatId,
    text: START_WELCOME_TEXT,
    reply_markup: startKeyboard(user.id, startParam)
  });

  if (!result.ok) {
    throw new Error(result.error || "sendMessage failed");
  }

  console.log("BOT_START_SENT:", user.id, startParam || "(none)");
  return result.result;
}

async function handleStart(chatId, user, startParam = "", options = {}) {
  return sendStartWelcome(chatId, user, startParam, options);
}

async function setupBotProfile() {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    await api("setMyDescription", { description: BOT_DESCRIPTION });
    await api("setMyShortDescription", { short_description: BOT_SHORT_DESCRIPTION });
    await api("setMyCommands", {
      commands: [
        { command: "start", description: "Play Wealthia" },
        { command: "play", description: "Open the game" },
        { command: "help", description: "Show help" }
      ]
    });
    await api("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: PLAY_BUTTON_TEXT,
        web_app: { url: WEBAPP_URL }
      }
    });
    console.log("Bot profile updated (description, commands, menu button).");
  } catch (error) {
    console.warn("Bot profile setup skipped:", error.message);
  }
}

async function handleBotMessage(message, options = {}) {
  if (!message || message.successful_payment) return false;

  const text = String(message.text || "").trim();
  const chatId = message.chat?.id;
  const user = message.from;

  if (!chatId || !user || user.is_bot) return false;

  if (isStartCommand(text)) {
    await sendStartWelcome(chatId, user, parseStartParam(text), options);
    return true;
  }

  if (/^\/play(?:@\w+)?$/i.test(text)) {
    await sendStartWelcome(chatId, user, "", options);
    return true;
  }

  const sendApi = options.telegramApiSafe || apiSafe;
  const sendMessage = async (body) => {
    const result = await sendApi("sendMessage", body);
    if (!result.ok) {
      throw new Error(result.error || "sendMessage failed");
    }
    return result.result;
  };

  if (text === "/channel") {
    if (!CHANNEL_URL) {
      await sendMessage({
        chat_id: chatId,
        text: "Channel link is not configured yet."
      });
      return true;
    }

    await sendMessage({
      chat_id: chatId,
      text: `Join the official Wealthia channel:\n${CHANNEL_URL}`,
      reply_markup: {
        inline_keyboard: [[{ text: "Join Channel", url: CHANNEL_URL }]]
      }
    });
    return true;
  }

  if (text === "/help") {
    await sendMessage({
      chat_id: chatId,
      text:
        "Wealthia Commands:\n" +
        "/start — Open the game\n" +
        "/play — Play Wealthia\n" +
        "/channel — Official channel\n" +
        "/help — This message\n\n" +
        `Game: ${WEBAPP_URL}`
    });
    return true;
  }

  return false;
}

module.exports = {
  START_WELCOME_TEXT,
  PLAY_BUTTON_TEXT,
  apiSafe,
  handleBotMessage,
  handleStart,
  setupBotProfile,
  startKeyboard
};
