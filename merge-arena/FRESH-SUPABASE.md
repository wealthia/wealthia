# MERGE ARENA — təmiz Supabase (köhnə Wealthia yox)

Köhnə proyektə toxunma. **Yeni boş proyekt** yarat.

## 1) Yeni proyekt
1. https://supabase.com/dashboard
2. **New project**
3. Name: `merge-arena`
4. Password saxla → Create

## 2) SQL
SQL Editor → bu faylı Run et: `supabase/migration-merge-arena.sql`

Table Editor-də yalnız bunlar olmalıdır:
- `users`
- `merge_arena_states`

## 3) Keys
Settings → API:
- **Project URL** → `SUPABASE_URL`
- **service_role** (secret) → `SUPABASE_SERVICE_KEY`

## 4) Render
`wealthia-backend` → Environment:
1. `SUPABASE_URL` = yeni URL
2. `SUPABASE_SERVICE_KEY` = yeni service_role
3. Save → **Manual Deploy**

Köhnə Wealthia Supabase qalsın — oyun artıq yeni proyektə baxacaq.
