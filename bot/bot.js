const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/v5.html?v=2009";
const BOT_USERNAME = process.env.BOT_USERNAME || "WealthiaGameBot";
const CHANNEL_URL = process.env.CHANNEL_URL || "";
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

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
let offset = 0;

async function api(method, body) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || "Telegram API error");
  }

  return data.result;
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
      `Tap, upgrade your city, complete daily missions and climb the leaderboard.\n\n` +
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

async function handleMessage(message) {
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
      allowed_updates: ["message"]
    });

    for (const update of updates) {
      offset = update.update_id + 1;

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

console.log("Wealthia bot running...");
console.log("WebApp:", WEBAPP_URL);
if (CHANNEL_URL) console.log("Channel:", CHANNEL_URL);

setupBotProfile().finally(() => poll());
