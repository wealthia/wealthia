# MERGE ARENA Telegram Bot

## Setup

### 1. BotFather
1. Open **@BotFather**
2. `/mybots` → `@MergeArenaBot`
3. Menu Button / Mini App URL:
```
https://wealthia.github.io/wealthia/merge-arena/app/?v=47
```

### 2. Render worker / API
Environment:
- `TELEGRAM_BOT_TOKEN` — MergeArenaBot token
- `WEBAPP_URL` — `https://wealthia.github.io/wealthia/merge-arena/app/?v=47`
- `BOT_USERNAME` — `MergeArenaBot`
- `PLAY_BUTTON_TEXT` — `Play MERGE ARENA`
- `DISABLE_BOT_POLLING` — `true` when merge-arena-api owns `/start` polling (default for this worker)

### 3. Test
Send `/start` to `@MergeArenaBot`.

You should see:
- English welcome explaining the game
- **Play MERGE ARENA** button (opens the mini app)
- How to play / Invite / Channel buttons

Commands: `/start` `/play` `/help`
