const WEBAPP_URL =
  process.env.WEBAPP_URL || "https://wealthia.github.io/wealthia/merge-arena/app/?v=47";
const PLAY_BUTTON_TEXT = process.env.PLAY_BUTTON_TEXT || "Play MERGE ARENA";
const BOT_USERNAME = process.env.BOT_USERNAME || "MergeArenaBot";
const CHANNEL_URL =
  String(process.env.CHANNEL_URL || "").trim() || "https://t.me/weathia_official";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const DISABLE_BOT_POLLING = process.env.DISABLE_BOT_POLLING === "true";

const HELP_TEXT = [
  "MERGE ARENA — quick help",
  "",
  "/start — Welcome + Play button",
  "/play — Open the arena",
  "/help — This message",
  "",
  "In game:",
  "• Get Hero uses energy",
  "• Fuse twins to grow power",
  "• Win fights to climb arenas & ranks",
  "• Shop has ads, gems, and Stars packs",
  "",
  `Open: ${WEBAPP_URL}`
].join("\n");

function welcomeText(firstName) {
  const greet = firstName
    ? `Hey ${firstName} — welcome to MERGE ARENA`
    : "Welcome to MERGE ARENA";
  return [
    greet,
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
}

function playKeyboard(userId, startParam) {
  const ref =
    startParam && /^(?:maref_|ref_)/.test(startParam)
      ? startParam
      : `maref_${userId || "guest"}`;
  let url = WEBAPP_URL;
  if (startParam) {
    const encoded = encodeURIComponent(startParam);
    const base = String(WEBAPP_URL || "").split("#")[0];
    const joiner = base.includes("?") ? "&" : "?";
    url = `${base}${joiner}tgWebAppStartParam=${encoded}#tgWebAppStartParam=${encoded}`;
  }
  return {
    inline_keyboard: [
      [{ text: PLAY_BUTTON_TEXT, web_app: { url } }],
      [{ text: "How to play", callback_data: "help_howto" }],
      [
        { text: "Join channel", url: CHANNEL_URL },
        {
          text: "Invite friends",
          url: `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_USERNAME}?start=${ref}`)}&text=${encodeURIComponent("Play MERGE ARENA with me — fuse heroes and climb the arenas!")}`
        }
      ]
    ]
  };
}

async function telegramApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("BOT_TOKEN_MISSING");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || method);
  return data.result;
}

function parseStartParam(text) {
  const parts = String(text || "").trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

async function sendWelcome(chatId, user, startParam = "") {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: welcomeText(user && user.first_name),
    reply_markup: playKeyboard(user && user.id, startParam),
    disable_web_page_preview: true
  });
}

async function sendHelp(chatId) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: HELP_TEXT,
    reply_markup: {
      inline_keyboard: [[{ text: PLAY_BUTTON_TEXT, web_app: { url: WEBAPP_URL } }]]
    },
    disable_web_page_preview: true
  });
}

async function handleUpdate(update) {
  if (update.callback_query) {
    const q = update.callback_query;
    await telegramApi("answerCallbackQuery", { callback_query_id: q.id });
    if (q.data === "help_howto" && q.message && q.message.chat) {
      await sendHelp(q.message.chat.id);
    }
    return;
  }

  const message = update.message;
  if (!message || !message.chat || !message.from || message.from.is_bot) return;
  const text = String(message.text || "").trim();
  const chatId = message.chat.id;

  if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    await sendWelcome(chatId, message.from, parseStartParam(text));
    return;
  }
  if (/^\/play(?:@\w+)?$/i.test(text)) {
    await sendWelcome(chatId, message.from, "");
    return;
  }
  if (/^\/help(?:@\w+)?$/i.test(text)) {
    await sendHelp(chatId);
  }
}

async function setupProfile() {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await telegramApi("setMyCommands", {
      commands: [
        { command: "start", description: "Welcome + open MERGE ARENA" },
        { command: "play", description: "Launch the arena" },
        { command: "help", description: "How to play" }
      ]
    });
    await telegramApi("setMyShortDescription", {
      short_description: "Merge heroes, smash arenas, climb ranks. Free Telegram mini-game."
    });
    await telegramApi("setMyDescription", {
      description: [
        "MERGE ARENA — fuse twin heroes, build your squad, and climb Hard Gates.",
        "",
        "Get Hero · fuse · fight",
        "Climb ranks from Recruit to Panda Lord",
        "Earn gems, open Glory Pass, beat Ghost Rivals",
        "",
        "Tap Start, then Play to enter the arena."
      ].join("\n")
    });
  } catch (error) {
    console.warn("Bot profile setup skipped:", error.message);
  }
}

let pollOffset = 0;
let polling = false;

async function pollOnce() {
  const updates = await telegramApi("getUpdates", {
    offset: pollOffset,
    timeout: 25,
    allowed_updates: ["message", "callback_query"]
  });
  for (const update of updates || []) {
    pollOffset = update.update_id + 1;
    try {
      await handleUpdate(update);
    } catch (error) {
      console.warn("BOT_UPDATE_FAIL:", error.message);
    }
  }
}

function startWelcomePolling() {
  if (!TELEGRAM_BOT_TOKEN || DISABLE_BOT_POLLING || polling) return;
  polling = true;
  setupProfile().catch(() => {});
  const loop = async () => {
    try {
      await pollOnce();
    } catch (error) {
      console.warn("BOT_POLL_ERROR:", error.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
    setImmediate(loop);
  };
  console.log("MERGE ARENA bot welcome polling on");
  loop();
}

module.exports = {
  startWelcomePolling,
  setupProfile,
  welcomeText,
  PLAY_BUTTON_TEXT,
  WEBAPP_URL
};
