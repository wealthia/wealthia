# Wealthia Backend Deploy Guide

## Current situation

Backend code is fixed on GitHub. The **live server** on Render may still run an old version until you redeploy.

---

## Easiest way (5 minutes)

### Step 1 — Render account

1. Open https://render.com
2. **Get Started** → **Sign in with GitHub**

### Step 2 — Find or create the service

**If `wealthia-backend` already exists:**
- Top right → **Manual Deploy** → **Deploy latest commit**

**If no service exists:**
1. **New +** → **Blueprint**
2. Select repo: `wealthia/wealthia`
3. `render.yaml` will load automatically
4. Enter `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
5. Click **Apply**

### Step 3 — Supabase keys

Supabase.com → your project → **Settings** → **API**:
- `SUPABASE_URL` = Project URL
- `SUPABASE_SERVICE_KEY` = `service_role` key (keep secret)

### Step 4 — Verify

Open in browser:
```
https://wealthia-backend.onrender.com/health
```

You should see `"version":"full-v6-fix1"` or newer.

Then refresh the game:
```
https://wealthia.github.io/wealthia/v5.html
```

---

## Can't find Render?

The backend may have been created on another account.

**Solution:** Create a new Blueprint on your own account (steps above).
Send us the new URL and we'll update `v5.js` if needed.

---

## Deploy Hook (set once, auto-deploy forever)

Render → Service → **Settings** → **Deploy Hook** → Copy URL

GitHub repo → **Settings** → **Secrets** → **Actions** → New secret:
- Name: `RENDER_DEPLOY_HOOK`
- Value: (paste the URL)

After this, every `server/` change deploys automatically.
