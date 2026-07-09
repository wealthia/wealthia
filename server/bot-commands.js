const WEBAPP_URL =
  process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/merge-arena/app/?v=47";
const BOT_USERNAME = process.env.BOT_USERNAME || "MergeArenaBot";
const CHANNEL_URL =
  String(process.env.CHANNEL_URL || "").trim() ||
  String(process.env.OFFICIAL_CHANNEL_URL || "").trim() ||
  "https://t.me/weathia_official";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

const START_WELCOME_TEXT = [
  "Welcome to MERGE ARENA",
  "",
  "Fuse twin heroes. Build your squad. Climb the arenas.",
  "",
  "How it works",
  "1. Tap Get Hero to drop fighters",
  "2. Drag matching heroes together to fuse",
  "3. Enter Fight when your power leads",
  "",
  "Earn gems, climb ranks, clear Hard Gates, and chase Panda Lord.",
  "",
  "Ready? Tap Play below to open the arena."
].join("\n");

const PLAY_BUTTON_TEXT = process.env.PLAY_BUTTON_TEXT || "Play MERGE ARENA";

const HELP_TEXT = [
  "MERGE ARENA — quick help",
  "",
  "/start — Welcome + Play button",
  "/play — Open the arena",
  "/help — This message",
  "/channel — Official channel",
  "",
  "In game:",
  "• Get Hero uses energy",
  "• Fuse twins to grow power",
  "• Win fights to climb arenas & ranks",
  "• Shop has ads, gems, and Stars packs",
  "",
  `Open: ${WEBAPP_URL}`
].join("\n");

const BOT_DESCRIPTION =
  process.env.BOT_DESCRIPTION ||
  [
    "MERGE ARENA — fuse twin heroes, build your squad, and climb Hard Gates.",
    "",
    "Get Hero · fuse · fight",
    "Climb ranks from Recruit to Panda Lord",
    "Earn gems, open Glory Pass, beat Ghost Rivals",
    "",
    "Tap Start, then Play to enter the arena."
  ].join("\n");

const BOT_SHORT_DESCRIPTION =
  process.env.BOT_SHORT_DESCRIPTION ||
  "Merge heroes, smash arenas, climb ranks. Free Telegram mini-game.";

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

  const encoded = encodeURIComponent(startParam);
  const base = String(WEBAPP_URL || "").split("#")[0];
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}tgWebAppStartParam=${encoded}#tgWebAppStartParam=${encoded}`;
}

function startKeyboard(userId, startParam) {
  const ref = startParam && /^(?:maref_|ref_)/.test(startParam) ? startParam : `maref_${userId}`;
  const rows = [
    [
      {
        text: PLAY_BUTTON_TEXT,
        web_app: { url: gameUrl(startParam || `maref_${userId}`) }
      }
    ],
    [{ text: "How to play", callback_data: "help_howto" }],
    [
      { text: "Join channel", url: CHANNEL_URL },
      {
        text: "Invite friends",
        url: `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_USERNAME}?start=${ref}`)}&text=${encodeURIComponent("Play MERGE ARENA with me — fuse heroes and climb the arenas!")}`
      }
    ]
  ];

  return { inline_keyboard: rows };
}

async function sendStartWelcome(chatId, user, startParam = "", options = {}) {
  const sendApi = options.telegramApiSafe || apiSafe;
  const first = String(user.first_name || "").trim();
  const greet = first ? `Hey ${first} — welcome to MERGE ARENA` : "Welcome to MERGE ARENA";
  const text = `${greet}\n\n${START_WELCOME_TEXT.split("\n").slice(2).join("\n")}`;
  const result = await sendApi("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: startKeyboard(user.id, startParam),
    disable_web_page_preview: true
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
        { command: "start", description: "Welcome + open MERGE ARENA" },
        { command: "play", description: "Launch the arena" },
        { command: "help", description: "How to play" },
        { command: "channel", description: "Official channel" }
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

  if (/^\/channel(?:@\w+)?$/i.test(text)) {
    await sendMessage({
      chat_id: chatId,
      text: `Join the official channel, then open MERGE ARENA:\n${CHANNEL_URL}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join channel", url: CHANNEL_URL }],
          [{ text: PLAY_BUTTON_TEXT, web_app: { url: WEBAPP_URL } }]
        ]
      },
      disable_web_page_preview: true
    });
    return true;
  }

  if (/^\/help(?:@\w+)?$/i.test(text)) {
    await sendMessage({
      chat_id: chatId,
      text: HELP_TEXT,
      reply_markup: {
        inline_keyboard: [[{ text: PLAY_BUTTON_TEXT, web_app: { url: WEBAPP_URL } }]]
      },
      disable_web_page_preview: true
    });
    return true;
  }

  return false;
}

async function handleBotCallbackQuery(query, options = {}) {
  if (!query || !query.id) return false;
  const data = String(query.data || "");
  const chatId = query.message && query.message.chat && query.message.chat.id;
  const sendApi = options.telegramApiSafe || apiSafe;

  await sendApi("answerCallbackQuery", { callback_query_id: query.id });

  if (data === "help_howto" && chatId) {
    await sendApi("sendMessage", {
      chat_id: chatId,
      text: HELP_TEXT,
      reply_markup: {
        inline_keyboard: [[{ text: PLAY_BUTTON_TEXT, web_app: { url: WEBAPP_URL } }]]
      },
      disable_web_page_preview: true
    });
    return true;
  }

  return false;
}

module.exports = {
  START_WELCOME_TEXT,
  PLAY_BUTTON_TEXT,
  HELP_TEXT,
  WEBAPP_URL,
  apiSafe,
  handleBotMessage,
  handleBotCallbackQuery,
  handleStart,
  setupBotProfile,
  startKeyboard
};
