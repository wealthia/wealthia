# Wealthia Monetization Setup

Do these steps **before** launching paid tournaments. Order matters.

---

## Quick checklist

| Step | What | Time | Earns money? |
|------|------|------|--------------|
| 1 | Bot profile (photo + description) | 10 min | Trust + clicks |
| 2 | AdsGram rewarded ads | 20 min | Yes — per ad view |
| 3 | Telegram channel | 15 min | Audience + sponsors |
| 4 | Partner links in game | 5 min | Sponsor deals |
| 5 | Daily channel posts | 5 min/day | Retention |
| 6 | Log revenue in admin | 2 min | Track income |

---

## 1. Bot profile (BotFather)

### Profile photo (round icon)
1. Open **@BotFather**
2. `/mybots` → select your bot → **Edit Bot** → **Edit Botpic**
3. Upload: `marketing/assets/wealthia-bot-avatar.png` (square)

### Description picture (640×360 banner)
BotFather → **Edit Description Picture**

Upload: `marketing/assets/wealthia-bot-description-640x360.png`  
Direct link: https://github.com/wealthia/wealthia/raw/main/marketing/assets/wealthia-bot-description-640x360.png

Must be exactly **640×360** pixels — other sizes are rejected.

### Description (shown before user presses Start)
```
/mybots → your bot → Edit Bot → Edit Description
```
Paste:
```
🏙️ Wealthia — Build your wealth empire in Telegram!

Tap for coins, upgrade your city, complete daily missions and climb the leaderboard. Invite friends for bonus coins.

Press Start to play free.
```

### Short description (shown in bot search)
```
/mybots → Edit Bot → Edit About
```
Paste:
```
Tap. Build. Earn. Free city-building clicker game in Telegram.
```

### Menu button (Play)
```
/mybots → Bot Settings → Menu Button → Configure
```
URL: `https://wealthia.github.io/wealthia/merge-arena/`
Text: `Play Wealthia`

---

## 2. AdsGram — rewarded ads (main ad income)

Full guide: **`ADSGRAM-SETUP.md`**. Platform must be created for **@MergeArenaBot**.

### Sign up
1. Go to https://partner.adsgram.ai
2. Create Ad Platform for `@MergeArenaBot`
3. App URL: `https://wealthia.github.io/wealthia/merge-arena/app/`
4. Create 2 Reward units (Watch & Charge + Quick Charge)

### Connect to game
1. Copy both **Block IDs** from AdsGram dashboard
2. Edit `config.js`:
   ```js
   ADSGRAM_BLOCK_ID: "YOUR_MAIN_BLOCK_ID",
   ADSGRAM_BONUS_BLOCK_ID: "YOUR_BONUS_BLOCK_ID",
   ```
3. Push to GitHub — game updates in ~1 minute

### How players see it
- Shop → **Watch & Charge** / **Quick Charge** → watch ad → +energy
- Soft grant stays on until Production ads fill (`ADSGRAM_ALLOW_SOFT_GRANT`)

### Track income
- AdsGram dashboard shows daily earnings
- Log payouts in admin panel → **Revenue** → type **Ad Revenue**

---

## 3. Telegram channel

### Create channel
1. Telegram → **New Channel**
2. Name: `Wealthia` (or your brand)
3. Username: e.g. `@wealthia_official` (must be unique)
4. Public channel recommended for growth

### Channel setup
- **Photo:** use same `wealthia-bot-avatar.png`
- **Description:**
  ```
  Official Wealthia channel. Daily tips, leaderboard updates, tournaments and rewards.
  Play: https://t.me/YOUR_BOT_USERNAME
  ```

### Pin this post
```
🏙️ WEALTHIA — Play free in Telegram

💰 Tap to earn coins
🏪 Upgrade your city
📋 Daily missions every 12 hours
👥 Invite friends → +2,000 coins

🎮 Play now: https://t.me/YOUR_BOT_USERNAME
```

### Connect channel to game
Edit `config.js`:
```js
PARTNER_CHANNEL_URL: "https://t.me/your_channel_username",
```

Players who join channel get +500 coins (Earn tab → Partner Channel).

### Posting schedule
| Day | Post type | File |
|-----|-----------|------|
| Mon | Game intro | `marketing/CHANNEL-POSTS.md` Post 1 |
| Tue | Daily missions | Post 3 |
| Wed | Referral push | Post 2 |
| Thu | Leaderboard | Post 4 |
| Fri | Boost weekend | Post 5 |
| Sat | New player guide | Post 6 |
| Sun | Tournament teaser | Post 7 |

Copy templates from `marketing/CHANNEL-POSTS.md`.

---

## 4. Partner / sponsor links

Edit `config.js`:
```js
BOT_USERNAME: "YourActualBotUsername",
SPONSOR_BOT_URL: "https://t.me/YourSponsorBot",
PARTNER_CHANNEL_URL: "https://t.me/YourChannel",
```

**Sponsor bot task:** player opens your sponsor bot → +750 coins (one time).  
Use this for cross-promotion with other Telegram games.

---

## 5. Revenue tracking (admin panel)

Open: https://wealthia.github.io/wealthia/admin.html

**Revenue** tab → log income:
- **Ad Revenue** — AdsGram payouts (weekly/monthly)
- **Sponsor** — paid partnerships
- **Manual** — other income

Tournament entry fees are logged automatically when players join.

---

## 6. When to start tournaments

Start paid tournaments **after**:
- [ ] AdsGram connected (or another ad network)
- [ ] Channel has 50+ subscribers (or active player base)
- [ ] Bot profile looks professional (photo + description)
- [ ] You post to channel at least 3 times

Tournament income = entry fees from players.  
Ad income = passive, scales with daily active users.

**Recommended first tournament:**
- Entry: 50–100 coins (low barrier)
- Duration: 24 hours
- Prizes: 3000 / 1500 / 500 coins

---

## Income model summary

```
Daily active players
        ↓
   ┌────┴────┐
   ↓         ↓
AdsGram    Tournaments
(per view) (entry fees)
   ↓         ↓
   └────┬────┘
        ↓
  Admin Revenue tab
```

---

## Links

- Game: https://wealthia.github.io/wealthia/merge-arena/
- Admin: https://wealthia.github.io/wealthia/admin.html
- AdsGram: https://partner.adsgram.ai
- Channel posts: `marketing/CHANNEL-POSTS.md`
- Bot avatar: `marketing/assets/wealthia-bot-avatar.png`
