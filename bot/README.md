# MERGE ARENA Telegram Bot

## Setup (5 minutes)

### 1. Create bot via BotFather
1. Open **@BotFather** in Telegram
2. Send `/newbot`
3. Name: `MERGE ARENA`
4. Username: your unique bot name
5. Copy the **token**

### 2. Connect Mini App (Menu Button)
BotFather:
```
/mybots → your bot → Bot Settings → Menu Button → Configure
```
URL:
```
https://wealthia.github.io/wealthia/merge-arena/
```

Or set Web App:
```
/mybots → your bot → Bot Settings → Configure Mini App
```
Same URL.

### 3. Run the bot

**On Render (recommended):**
- Worker service: `wealthia-bot` (see `render.yaml`)
- Environment variables:
  - `TELEGRAM_BOT_TOKEN` — from BotFather
  - `WEBAPP_URL` — `https://wealthia.github.io/wealthia/merge-arena/`
  - `BOT_USERNAME` — your bot username without @
  - `CHANNEL_URL` — `https://t.me/your_channel` (optional)

**Locally:**
```bash
cd bot
cp .env.example .env
# edit .env with your token
npm start
```

### 4. Test
Send `/start` to your bot — Play button should open MERGE ARENA.

Commands: `/start` `/play` `/channel` `/help`

## Live game
https://wealthia.github.io/wealthia/merge-arena/
