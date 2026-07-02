# Wealthia Telegram Bot

## Setup (5 minutes)

### 1. Create bot via BotFather
1. Open **@BotFather** in Telegram
2. Send `/newbot`
3. Name: `Wealthia`
4. Username: `WealthiaGameBot` (or any available name)
5. Copy the **token**

### 2. Connect Mini App
In BotFather:
```
/mybots → your bot → Bot Settings → Menu Button → Configure
```
URL: `https://wealthia.github.io/wealthia/v5.html`

### 3. Run the bot

**On Render (recommended):**
- New → Background Worker
- Root directory: `bot`
- Start command: `node bot.js`
- Environment: `TELEGRAM_BOT_TOKEN`, `WEBAPP_URL`

**Locally:**
```bash
cd bot
export TELEGRAM_BOT_TOKEN="your_token"
npm start
```

### 4. Test
Send `/start` to your bot — the Play button should appear.
