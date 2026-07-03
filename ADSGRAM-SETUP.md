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
   - **Reward URL:** `https://wealthia-backend.onrender.com/api/adsgram/reward?userid=[userId]`
3. Save

### Bonus Ad (2nd rewarded slot — replaces Partner Bot)

1. Dashboard → **Create...** → **Ad unit**
2. Settings:
   - **Name:** `Wealthia Bonus`
   - **Ad Platform:** Wealthia
   - **Block type:** `Reward`
   - **Reward URL:** same as above
3. Copy **Block ID** → `config.js`:
   ```js
   ADSGRAM_BONUS_BLOCK_ID: "YOUR_BONUS_BLOCK_ID",
   ```
4. Players get **+150 coins** every **15 minutes** (main ad: +300 every 5 min)

---

## Verification failed? (platform yaradılmır / verify etmir)

AdsGram avtomatik yoxlayır: **Bot ID**, **Direct Link** və **Web App URL** BotFather ilə **tam eyni** olmalıdır.

### Düzgün məlumatları BotFather-dan al

1. **@BotFather** → `/myapps`
2. **WealthiaGameBot** (və ya app adın) seç
3. Bu 3 dəyəri **kopyala-yapışdır** (əl ilə yazma):

| AdsGram sahəsi | BotFather-dan |
|----------------|---------------|
| Telegram direct link | **Direct Link** (məs: `https://t.me/WealthiaGameBot/wealthia`) |
| Web app url | **Web App URL** (məs: `https://wealthia.github.io/wealthia/v5.html`) |
| Bot ID | `/mybots` → bot → **API Token** → `:` işarəsindən **əvvəl** olan rəqəm |

**Bot ID nümunəsi:** Token `7123456789:AAHxxx...` → Bot ID = `7123456789`

❌ **Səhv:** `@WealthiaGameBot` və ya bot username Bot ID kimi yazmaq  
✅ **Düzgün:** yalnız rəqəmlər

### Web App URL uyğunluğu

BotFather-dakı URL ilə AdsGram-dakı **simvol-simvol eyni** olmalıdır:

```
https://wealthia.github.io/wealthia/v5.html?v=2019
```

Əgər BotFather-da `?v=` yoxdursa, **BotFather-da da eyni URL-i təyin et** (Edit Web App URL).

### Tez həll: Test Platform (moderasiya gözləmədən)

Real verify uzun çəkirsə, əvvəlcə **Test** platform yarat:

1. AdsGram → **Create...** → **Ad platform**
2. Tip: **Test** (Production yox)
3. Eyni BotFather məlumatlarını yapışdır
4. Status **Active** olur — moderasiya lazım deyil
5. Reward Ad Unit yarat → Block ID götür → `config.js`-ə yaz
6. Telegram-da test et (real pul sayılmır, amma inteqrasiya işləyir)

Sonra Production platform üçün @adsgramsupport-a moderasiya istə.

### Moderasiya (Production üçün)

Platform yaranır amma reklam gəlmirsə — bu **avtomatik verify deyil**, manual moderasiyadır:

**@adsgramsupport**-a yaz:

```
Hello,

Please moderate my Wealthia Mini App.

Platform: https://partner.adsgram.ai/platforms/SENIN_PLATFORM_ID/

[BotFather mesajını FORWARD et — Direct Link + Web App URL görünsün]

Game is live and playable in Telegram.
Rewarded ad is optional (+300 coins one-time in Earn tab).
```

- Moderasiya: həftə içi 4–6 saat, həftə sonu 6–10 saat (08:00–22:00 UTC)
- Oyun **Telegram-da açıq və işlək** olmalıdır moderasiya vaxtı

### Tez-tez səhvlər

| Problem | Həll |
|---------|------|
| Verify / create error | Bot ID rəqəm deyil; URL uyğun gəlmir |
| Platform pending | @adsgramsupport moderasiya |
| Reklam yoxdur | Test platform + Block ID config.js-də |
| Brauzerdə açırsan | Yalnız **Telegram içində** test et |

---

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
- Repeatable every **5 minutes** (+300 coins per ad)
- Earn tab → Rewarded Ad shows countdown until next ad
