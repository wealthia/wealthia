# MERGE ARENA Telegram Bot

## Setup

### 1. BotFather
1. Open **@BotFather**
2. Create Mini App (needed for AdsGram Direct Link):
   - `/newapp` → choose `@MergeArenaBot`
   - Title: `MERGE ARENA`
   - Description: `Fuse twin heroes, build your squad, climb arenas.`
   - Photo: `merge-arena/assets/merge-arena-app-icon-640.png`
   - GIF: `/empty`
   - Web App URL: `https://wealthia.github.io/wealthia/merge-arena/app/`
   - Short name: `arena`
3. Menu Button:
   - `/mybots` → `@MergeArenaBot` → Bot Settings → Menu Button
```
https://wealthia.github.io/wealthia/merge-arena/app/?v=48
```
4. After `/newapp`, `/myapps` should list MERGE ARENA with Direct Link `t.me/MergeArenaBot/arena`

### 2. Render worker / API
Environment:
- `TELEGRAM_BOT_TOKEN` — MergeArenaBot token
- `WEBAPP_URL` — `https://wealthia.github.io/wealthia/merge-arena/app/?v=48`
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
