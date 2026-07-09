# Wealthia — Launch Checklist

Everything is ready in code. Complete these steps once:

**Monetization (do before tournaments):** see `MONETIZATION.md`

---

## 1. Telegram Bot (5 min)

1. Open @BotFather → `/newbot` → get your token
2. Render → **New Worker** → root folder `bot/` → start `node bot.js`
3. Set env: `TELEGRAM_BOT_TOKEN=...`
4. Message your bot `/start` — you should see the Play button

Details: `bot/README.md`

---

## 2. AdsGram Ads (monetization)

1. Sign up at https://partner.adsgram.ai
2. Create a Rewarded ad block and copy the block ID
3. Edit `config.js`:
   ```js
   ADSGRAM_BLOCK_ID: "12345",
   ```
4. Push to GitHub → site updates automatically

---

## 3. Partner links

Edit `config.js`:
```js
SPONSOR_BOT_URL: "https://t.me/YourSponsorBot",
PARTNER_CHANNEL_URL: "https://t.me/YourChannel",
```

---

## 4. Telegram Channel

Copy posts from `marketing/CHANNEL-POSTS.md`.

Post once per day with the game link.

---

## 5. Onboarding

New players see a 3-step tutorial on first launch.
To show it again, change `ONBOARDING_VERSION` in `config.js`.

---

## 6. Admin Panel + Tournaments

### Supabase migration

1. Supabase → **SQL Editor** → New query
2. Paste and run `supabase/migration-admin-tournaments.sql`
3. Paste and run `supabase/migration-casino-level.sql` (Casino + Empire Level)

### Backend env (Render)

Add to **wealthia-backend** environment variables:

```
ADMIN_SECRET=your-long-random-secret-here
```

Then **Manual Deploy** the backend.

### Admin panel

Open: https://wealthia.github.io/wealthia/admin.html

Sign in with your `ADMIN_SECRET`. From there you can:

- View player stats and revenue
- Grant coins to players
- Create tap tournaments (entry fee + prizes)
- Log ad/sponsor revenue

### Tournaments in game

Players see live tournaments on the **Rank** tab. They pay the entry fee in coins, tap to score, and top 3 win prizes when you end the tournament from admin.

---

## Links

- Game: https://wealthia.github.io/wealthia/merge-arena/
- Backend health: https://wealthia-backend.onrender.com/health

## 7. MERGE ARENA cloud save (Supabase)

1. Supabase → **SQL Editor**
2. Run `supabase/migration-merge-arena.sql`
3. Render → redeploy `wealthia-backend`
4. Open game in Telegram — progress syncs to cloud

Details: `merge-arena/BACKEND.md`
