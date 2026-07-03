const { startBotPolling } = require("./runner");

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}

console.log("Wealthia bot running...");
startBotPolling();
