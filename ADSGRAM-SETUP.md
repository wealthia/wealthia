# AdsGram Setup — MERGE ARENA (@MergeArenaBot)

Rewarded ads power Shop → **Watch & Charge** (+4⚡) and **Quick Charge** (+3⚡).

**Live game URL**
```
https://wealthia.github.io/wealthia/merge-arena/app/
```

**Bot:** `@MergeArenaBot`

> Platform **Bot ID / Direct Link / Web App URL** must match **@MergeArenaBot** exactly.
> Blocks created for `@WealthiaGameBot` will not fill inside Merge Arena.

---

## Step 1 — Register

1. Open https://partner.adsgram.ai
2. Sign up / log in
3. Confirm email if asked

---

## Step 2 — Copy BotFather values (do not type by hand)

1. Telegram → **@BotFather**
2. `/myapps` → choose the **Merge Arena** mini app on **@MergeArenaBot**
3. Copy these three values:

| AdsGram field | From BotFather |
|---------------|----------------|
| Telegram direct link | Direct Link (`https://t.me/MergeArenaBot/...`) |
| Web app url | Web App URL (must match character-for-character) |
| Bot ID | `/mybots` → MergeArenaBot → **API Token** → digits **before** `:` |

**Bot ID example:** token `7123456789:AAHxxx...` → Bot ID = `7123456789`

- Wrong: `@MergeArenaBot` as Bot ID  
- Right: numbers only

If BotFather Web App URL has no `?v=`, use that exact URL in AdsGram too.

---

## Step 3 — Create Ad Platform

1. AdsGram → **Create...** → **Ad platform**
2. Fill in:
   - **App name:** `MERGE ARENA`
   - **Telegram direct link:** paste from BotFather
   - **Web app url:** paste from BotFather (usually `https://wealthia.github.io/wealthia/merge-arena/app/`)
   - **Bot ID:** numeric ID from token

### Fast path: Test platform first

If Production verify is slow:

1. Create platform type **Test** (not Production)
2. Same BotFather values
3. Status becomes **Active** without moderation
4. Create Reward units → copy Block IDs → put in `config.js`
5. Test inside Telegram (test impressions do not pay)

Then create a **Production** platform and ask moderation.

---

## Step 4 — Create 2 Reward Ad Units

### Main — Watch & Charge

1. **Create...** → **Ad unit**
2. Settings:
   - **Name:** `MERGE ARENA Energy`
   - **Ad Platform:** MERGE ARENA
   - **Block type:** `Reward`
   - **Reward URL (optional):**  
     `https://merge-arena-api.onrender.com/api/adsgram/reward?userid=[userId]`
3. Save → **<> Show code** → **Copy BlockID**

### Bonus — Quick Charge

1. **Create...** → **Ad unit**
2. Settings:
   - **Name:** `MERGE ARENA Quick Charge`
   - **Ad Platform:** MERGE ARENA
   - **Block type:** `Reward`
   - **Reward URL:** same as above
3. Copy Block ID

---

## Step 5 — Put Block IDs in the game

Edit root `config.js`:

```js
ADSGRAM_BLOCK_ID: "YOUR_MAIN_BLOCK_ID",
ADSGRAM_BONUS_BLOCK_ID: "YOUR_BONUS_BLOCK_ID",
ADSGRAM_DEBUG: false,
ADSGRAM_ALLOW_SOFT_GRANT: false,
```

Then bump cache (`?v=48` in app HTML / menu URL) and deploy.

---

## Step 6 — Production moderation

Send to **@adsgramsupport** or **support@adsgram.ai**:

```
Hello,

Please moderate my MERGE ARENA Telegram Mini App (@MergeArenaBot).

Platform: https://partner.adsgram.ai/platforms/YOUR_PLATFORM_ID/

[Forward BotFather message with Direct Link + Web App URL]

Game is live and playable in Telegram.
Shop has two rewarded slots: Watch & Charge and Quick Charge.
```

- Weekday: often a few hours  
- Weekend: longer  
- App must open in Telegram during review

---

## Step 7 — Test (Telegram only)

1. Open `@MergeArenaBot` → Play
2. Shop → **Watch** / **Quick Charge**
3. Watch full ad → energy should rise

| Problem | Fix |
|---------|-----|
| No fill / error | Wrong bot platform, or still pending moderation |
| Works only with soft grant | Production not approved yet — use Test platform IDs |
| Demo confirm dialog | Block ID empty, or soft-grant still on |
| Browser test | Must open inside Telegram |

---

## Income

- AdsGram dashboard → daily earnings  
- Soft grant (`ADSGRAM_ALLOW_SOFT_GRANT`) must be **false** once live ads fill, or free energy bypasses monetization
