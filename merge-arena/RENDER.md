# MERGE ARENA — yeni Render (köhnə Wealthia-ya toxunma)

## 1) Render-də yeni Web Service
1. https://dashboard.render.com
2. **New +** → **Web Service**
3. GitHub repo: `wealthia/wealthia`
4. Settings:
   - **Name:** `merge-arena-api`
   - **Root Directory:** `merge-arena/backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance:** Free

## 2) Environment variables
| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://sxvkdamiffwrvbykswrr.supabase.co` |
| `SUPABASE_SERVICE_KEY` | (service_role secret) |
| `TELEGRAM_BOT_TOKEN` | (yeni bot token) |
| `SESSION_SECRET` | istənilən uzun random mətn |
| `WEBAPP_URL` | `https://wealthia.github.io/wealthia/merge-arena/app/?v=29` |

## 3) Deploy
**Create Web Service** → gözlə → URL belə olacaq:
```
https://merge-arena-api.onrender.com
```

Test:
```
https://merge-arena-api.onrender.com/health
```
`database: true` görməlisən.

## 4) Mənə yaz
Deploy URL-i göndər — oyunun `API_URL`-ini ora bağlayaram.
