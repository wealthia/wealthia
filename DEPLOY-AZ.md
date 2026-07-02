# Wealthia Backend Deploy (Azərbaycanca)

## Sizin vəziyyət

Backend kodu GitHub-da düzəldilib. Amma **canlı server** (Render) köhnə versiyanı işlədir.
Render panelinə daxil olmaq lazımdır — mən sizin yerinizə daxil ola bilmirəm.

---

## Ən asan yol (5 dəqiqə)

### Addım 1 — Render hesabı

1. https://render.com açın
2. **Get Started** → **Sign in with GitHub**
3. GitHub hesabınızı bağlayın

### Addım 2 — Service tapın və ya yaradın

**Əgər `wealthia-backend` varsa:**
- Üst sağda **Manual Deploy** → **Deploy latest commit**

**Əgər service yoxdursa:**
1. **New +** → **Blueprint**
2. Repo seçin: `wealthia/wealthia`
3. `render.yaml` avtomatik oxunacaq
4. `SUPABASE_URL` və `SUPABASE_SERVICE_KEY` daxil edin
5. **Apply**

### Addım 3 — Supabase açarları

Supabase.com → layihəniz → **Settings** → **API**:
- `SUPABASE_URL` = Project URL
- `SUPABASE_SERVICE_KEY` = `service_role` key (secret)

### Addım 4 — Yoxlama

Brauzerdə açın:
```
https://wealthia-backend.onrender.com/health
```

`"version":"full-v6-fix1"` görməlisiniz.

Sonra oyun:
```
https://wealthia.github.io/wealthia/v5.html
```

---

## Render tapa bilmirsinizsə

Ola bilər backend başqa hesabda yaradılıb (köhnə developer).

**Həll:** Yuxarıdakı kimi **yeni Blueprint** ilə öz hesabınızda yaradın.
Sonra mənə yeni URL yazın — `v5.js`-də API ünvanını dəyişərəm.

---

## Deploy Hook (bir dəfə qurun, sonra avtomatik)

Render → Service → **Settings** → **Deploy Hook** → Copy URL

GitHub repo → **Settings** → **Secrets** → **Actions** → New secret:
- Name: `RENDER_DEPLOY_HOOK`
- Value: (kopyaladığınız URL)

Bundan sonra `server/` dəyişəndə avtomatik deploy olacaq.
