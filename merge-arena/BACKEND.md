# MERGE ARENA — Render + Supabase

Backend artıq işləyir:
https://wealthia-backend.onrender.com/health

## 1) Supabase (1 dəqiqə)

1. Aç: https://supabase.com/dashboard
2. Öz proyektini seç
3. **SQL Editor** → New query
4. `supabase/migration-merge-arena.sql` faylının içini yapışdır → **Run**

Bu cədvəl yaranır: `merge_arena_states`

## 2) Render (əgər env yoxdursa)

Service: **wealthia-backend**

Lazımi env-lər (artıq varsa toxunma):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `TELEGRAM_BOT_TOKEN` (yeni bot tokeni)
- `SESSION_SECRET`
- `WEBAPP_URL` = `https://wealthia.github.io/wealthia/merge-arena/`

Sonra: **Manual Deploy** → Deploy latest commit

## 3) Bot

BotFather Menu Button URL:
```
https://wealthia.github.io/wealthia/merge-arena/
```

Render worker `wealthia-bot` üçün:
- `TELEGRAM_BOT_TOKEN` = yeni bot tokeni
- `WEBAPP_URL` = eyni link
- `BOT_USERNAME` = bot username (@ olmadan)

## 4) Test

1. Botda `/start` → Play
2. Oyunda "Cloud save on" toast görünməlidir
3. Supabase → Table Editor → `merge_arena_states` → sətir yaranır

## API
- `POST /api/session` — Telegram auth
- `GET /api/merge-arena/state` — load
- `POST /api/merge-arena/state` — save
