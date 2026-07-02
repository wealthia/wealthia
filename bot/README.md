# Wealthia Telegram Bot

## Setup (5 minutes)

### 1. Create bot via BotFather
1. Open **@BotFather** in Telegram
2. Send `/newbot`
3. Name: `Wealthia`
4. Username: your unique bot name
5. Copy the **token**

### 2. Bot profile (photo + description)
See `MONETIZATION.md` section 1.

**Profile photo:** upload `marketing/assets/wealthia-bot-avatar.png` via BotFather → Edit Botpic

The bot auto-sets description and menu button on startup when deployed.

### 3. Connect Mini App
BotFather:
```
/mybots → your bot → Bot Settings → Menu Button → Configure
```
URL: `https://wealthia.github.io/wealthia/v5.html`

### 4. Run the bot

**On Render (recommended):**
- Worker service: `wealthia-bot` (see `render.yaml`)
- Environment variables:
  - `TELEGRAM_BOT_TOKEN` — from BotFather
  - `WEBAPP_URL` — game URL
  - `BOT_USERNAME` — your bot username without @
  - `CHANNEL_URL` — `https://t.me/your_channel` (optional)

**Locally:**
```bash
cd bot
cp .env.example .env
# edit .env with your token
npm start
```

### 5. Test
Send `/start` to your bot — Play button and channel link should appear.

Commands: `/start` `/play` `/channel` `/help`

Full monetization guide: `MONETIZATION.md`
