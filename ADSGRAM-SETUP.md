# AdsGram Setup — Wealthia

Step-by-step guide to connect rewarded ads and earn money.

**Game URL for AdsGram dashboard:**
```
https://wealthia.github.io/wealthia/v5.html?v=2019
```

**Bot:** @WealthiaGameBot

---

## Step 1 — Register

1. Open https://partner.adsgram.ai
2. Sign up / log in
3. Confirm your email if asked

---

## Step 2 — Create Ad Platform

1. Dashboard → **Create...** → **Ad platform**
2. Fill in:
   - **App name:** `Wealthia`
   - **Telegram direct link:** from BotFather → `/myapps` → your app → Direct Link
   - **Web app url:** `https://wealthia.github.io/wealthia/v5.html?v=2019`
   - **Bot ID:** your bot numeric ID from BotFather

### Get links from BotFather

1. Open **@BotFather**
2. Send `/myapps`
3. Choose **WealthiaGameBot**
4. Copy:
   - Direct Link (t.me/...)
   - Web App URL
   - Bot ID

---

## Step 3 — Create Reward Ad Unit

1. Dashboard → **Create...** → **Ad unit**
2. Settings:
   - **Name:** `Wealthia Reward`
   - **Ad Platform:** Wealthia (from step 2)
   - **Block type:** `Reward`
3. Save

---

## Step 4 — Moderation (required)

AdsGram must approve your app before real ads show.

Send to **@adsgramsupport** or **support@adsgram.ai**:

```
Hello, please moderate my Wealthia Telegram Mini App.

Platform link: https://partner.adsgram.ai/platforms/YOUR_PLATFORM_ID/
Forwarded message from BotFather with Direct Link and Web App URL attached.
```

Attach the BotFather message with your app details.

Approval usually takes 1–3 days.

---

## Step 5 — Copy Block ID

1. Open your ad unit in AdsGram dashboard
2. Click **<> Show code** (top right)
3. Click **Copy BlockID**
4. Example format: `12345` (numeric for Reward blocks)

---

## Step 6 — Add to Wealthia

Edit `config.js`:

```js
ADSGRAM_BLOCK_ID: "12345",
```

Replace `12345` with your real Block ID.

Commit and push to GitHub. Game updates in ~1–2 minutes.

Also bump cache if needed:
- `v5.html` → `config.js?v=3` or higher

---

## Step 7 — Test

1. Open game **inside Telegram** (not desktop browser)
2. Go to **Earn** tab
3. Tap **Rewarded Ad**
4. Watch full ad → get **+300 coins**

### Troubleshooting

| Problem | Fix |
|---------|-----|
| "Demo mode" message | Block ID empty in config.js |
| "Ad not ready" | Open in Telegram app, wait for moderation |
| No reward after ad | Must watch till the end |
| Works in demo only | Moderation not approved yet |

---

## Income tracking

- **AdsGram dashboard** → daily earnings
- **Admin panel** → Revenue tab → log as "Ad Revenue"

---

## Player experience

- One-time reward per account (+300 coins)
- Earn tab → Rewarded Ad
- After claimed, button shows "Claimed"
