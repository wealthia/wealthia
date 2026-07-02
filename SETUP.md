# Wealthia — Launch Checklist

Everything is ready in code. Complete these steps once:

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

## Links

- Game: https://wealthia.github.io/wealthia/v5.html
- Backend health: https://wealthia-backend.onrender.com/health
