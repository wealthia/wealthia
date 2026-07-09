const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
// Hard pin so stale Render env cannot keep Telegram on an old cached URL.
const WEBAPP_URL = "https://wealthia.github.io/wealthia/merge-arena/app/?v=41";
const PLAY_BUTTON_TEXT = process.env.PLAY_BUTTON_TEXT || "Play MERGE ARENA";
const SESSION_SECRET =
  process.env.SESSION_SECRET || TELEGRAM_BOT_TOKEN || "merge-arena-dev-secret";

const STAR_PRODUCTS = {
  energy_refill: { title: "Full Charge", description: "Snap back to 14 energy.", stars: 30 },
  energy_pack: { title: "Energy Sip", description: "+6 energy.", stars: 20 },
  rare_summon: { title: "Rare Drop", description: "Guaranteed Rare on your board.", stars: 40 },
  epic_summon: { title: "Epic Strike", description: "Guaranteed Epic on your board.", stars: 90 },
  legend_summon: { title: "Legend Call", description: "Guaranteed Legendary on your board.", stars: 180 },
  power_surge: { title: "Power Surge", description: "+30% power for 3 fights.", stars: 35 },
  gem_starter: { title: "Gem Cache", description: "+500 gems.", stars: 50 }
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INIT_DATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: "256kb" }));

async function telegramApi(method, body) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("BOT_TOKEN_MISSING");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `${method}_failed`);
  }
  return data.result;
}

async function syncBotMenuButton() {
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, error: "BOT_TOKEN_MISSING" };
  try {
    // Telegram often keeps a stale web_app URL when only ?v=N changes.
    // Clear → pause → set with a versioned label so the button is treated as new.
    await telegramApi("setChatMenuButton", { menu_button: { type: "commands" } });
    await new Promise((r) => setTimeout(r, 400));
    const versionTag = (String(WEBAPP_URL).match(/[?&]v=(\d+)/) || [])[1] || "";
    const label = versionTag ? `${PLAY_BUTTON_TEXT} v${versionTag}` : PLAY_BUTTON_TEXT;
    await telegramApi("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: label.slice(0, 64),
        web_app: { url: WEBAPP_URL }
      }
    });
    await new Promise((r) => setTimeout(r, 300));
    let current = null;
    try {
      current = await telegramApi("getChatMenuButton", {});
    } catch {
      current = null;
    }
    const pinned = current?.web_app?.url || "";
    const matched = pinned === WEBAPP_URL;
    console.log("Menu button synced:", WEBAPP_URL, "telegram:", pinned || "(none)", matched ? "OK" : "MISMATCH");
    return { ok: true, webAppUrl: WEBAPP_URL, menuButton: current, matched, label };
  } catch (error) {
    console.warn("Menu button sync failed:", error.message);
    return { ok: false, error: error.message || "SYNC_FAILED", webAppUrl: WEBAPP_URL };
  }
}

function diagnoseTelegramAuth(initData, botToken) {
  if (!botToken) return { ok: false, reason: "BOT_TOKEN_MISSING" };
  if (!initData) return { ok: false, reason: "INIT_DATA_MISSING" };

  const params = new URLSearchParams(String(initData));
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "INIT_DATA_INVALID" };
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) return { ok: false, reason: "INIT_DATA_HASH_MISMATCH" };

  const authDate = Number(params.get("auth_date") || 0) * 1000;
  if (!authDate || Date.now() - authDate > INIT_DATA_MAX_AGE_MS) {
    return { ok: false, reason: "INIT_DATA_EXPIRED" };
  }

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user || !user.id) return { ok: false, reason: "INIT_DATA_NO_USER" };
    return {
      ok: true,
      user: {
        id: String(user.id),
        first_name: user.first_name || "Player",
        username: user.username || "",
        is_bot: Boolean(user.is_bot)
      }
    };
  } catch {
    return { ok: false, reason: "INIT_DATA_INVALID" };
  }
}

function createSessionToken(userId) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${String(userId)}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return { token: `${payload}.${signature}`, expiresAt };
}

function verifyToken(token) {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  const payload = `${userId}.${expiresAt}`;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  if (signature !== expected) return null;
  if (Number(expiresAt) < Date.now()) return null;
  return String(userId);
}

function bearer(req) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function requirePlayer(req, res, next) {
  const userId = verifyToken(bearer(req));
  if (!userId) {
    res.status(401).json({ error: "SESSION_EXPIRED" });
    return;
  }
  req.playerId = userId;
  next();
}

function sanitizeUnit(unit) {
  if (!unit || typeof unit !== "object") return null;
  return {
    uid: String(unit.uid || ""),
    id: String(unit.id || "spark"),
    level: Math.max(1, Math.min(8, Math.floor(Number(unit.level) || 1))),
    rarity: String(unit.rarity || "common")
  };
}

function sanitizeState(input) {
  const raw = input && typeof input === "object" ? input : {};
  const boardIn = Array.isArray(raw.board) ? raw.board.slice(0, 16) : [];
  const board = [];
  for (let i = 0; i < 16; i += 1) {
    board.push(sanitizeUnit(boardIn[i]));
  }
  return {
    energy: Math.max(0, Math.min(14, Math.floor(Number(raw.energy) || 0))),
    gems: Math.max(0, Math.floor(Number(raw.gems) || 0)),
    trophies: Math.max(0, Math.floor(Number(raw.trophies) || 0)),
    wave: Math.max(1, Math.floor(Number(raw.wave) || 1)),
    bestWave: Math.max(1, Math.floor(Number(raw.bestWave) || 1)),
    wins: Math.max(0, Math.floor(Number(raw.wins) || 0)),
    merges: Math.max(0, Math.floor(Number(raw.merges) || 0)),
    highestPower: Math.max(0, Math.floor(Number(raw.highestPower) || 0)),
    surgeBattles: Math.max(0, Math.floor(Number(raw.surgeBattles) || 0)),
    charmBattles: Math.max(0, Math.floor(Number(raw.charmBattles) || 0)),
    dailyStreak: Math.max(0, Math.floor(Number(raw.dailyStreak) || 0)),
    dailyClaimDate: String(raw.dailyClaimDate || "").slice(0, 16),
    referralCount: Math.max(0, Math.floor(Number(raw.referralCount) || 0)),
    referredBy: String(raw.referredBy || "").slice(0, 32),
    referralClaimed: Boolean(raw.referralClaimed),
    adLastClaimAt: Math.max(0, Math.floor(Number(raw.adLastClaimAt) || 0)),
    soundOn: raw.soundOn !== false,
    discovered: Array.isArray(raw.discovered) ? raw.discovered.map(String).slice(0, 64) : [],
    board,
    lastEnergyAt: Math.max(0, Math.floor(Number(raw.lastEnergyAt) || Date.now())),
    passXp: Math.max(0, Math.floor(Number(raw.passXp) || 0)),
    passClaimed: Array.isArray(raw.passClaimed) ? raw.passClaimed.map((n) => Math.floor(Number(n) || 0)).slice(0, 16) : [],
    questDate: String(raw.questDate || "").slice(0, 16),
    quests: raw.quests && typeof raw.quests === "object" ? raw.quests : {},
    ghostWins: Math.max(0, Math.floor(Number(raw.ghostWins) || 0)),
    lastGhostAt: Math.max(0, Math.floor(Number(raw.lastGhostAt) || 0)),
    lastRankId: String(raw.lastRankId || "recruit").slice(0, 24)
  };
}

async function ensureArenaRow(userId, stateInput) {
  const state = sanitizeState(stateInput || {});
  const payload = {
    user_id: String(userId),
    state,
    trophies: state.trophies,
    best_wave: state.bestWave,
    wins: state.wins,
    merges: state.merges,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("merge_arena_states")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, updated_at")
    .maybeSingle();

  if (error) throw error;
  return { payload, data };
}

async function ensureArenaRowIfMissing(userId) {
  const { data: existing, error: readError } = await supabase
    .from("merge_arena_states")
    .select("user_id, updated_at")
    .eq("user_id", String(userId))
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return { created: false, data: existing };

  const fresh = {
    energy: 10,
    gems: 45,
    trophies: 0,
    wave: 1,
    bestWave: 1,
    wins: 0,
    merges: 0,
    highestPower: 0,
    surgeBattles: 0,
    charmBattles: 0,
    dailyStreak: 0,
    dailyClaimDate: "",
    referralCount: 0,
    referredBy: "",
    referralClaimed: false,
    adLastClaimAt: 0,
    soundOn: true,
    discovered: ["spark", "blade"],
    board: Array(16).fill(null),
    lastEnergyAt: Date.now()
  };
  const ensured = await ensureArenaRow(userId, fresh);
  return { created: true, data: ensured.data || { user_id: String(userId) } };
}

app.get("/ping", (_req, res) => {
  res.json({ ok: true, app: "MERGE ARENA", ts: Date.now() });
});

app.get("/health", async (_req, res) => {
  let database = false;
  let dbError = "";
  try {
    const { error } = await supabase.from("merge_arena_states").select("user_id").limit(1);
    database = !error;
    if (error) dbError = error.message;
  } catch (error) {
    database = false;
    dbError = error.message || "db_error";
  }

  let telegram = { configured: Boolean(TELEGRAM_BOT_TOKEN), ok: false, username: "" };
  if (TELEGRAM_BOT_TOKEN) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
      const data = await response.json();
      telegram = {
        configured: true,
        ok: Boolean(data.ok),
        username: data.ok ? data.result?.username || "" : "",
        error: data.ok ? "" : data.description || "getMe_failed"
      };
    } catch (error) {
      telegram = { configured: true, ok: false, username: "", error: error.message || "getMe_error" };
    }
  }

  res.json({
    ok: true,
    app: "MERGE ARENA API",
    database,
    dbError: dbError || undefined,
    telegram,
    webAppUrl: WEBAPP_URL,
    version: "merge-arena-v7"
  });
});

app.post("/sync-menu", async (_req, res) => {
  const result = await syncBotMenuButton();
  res.status(result.ok ? 200 : 500).json(result);
});

app.get("/sync-menu", async (_req, res) => {
  const result = await syncBotMenuButton();
  res.status(result.ok ? 200 : 500).json(result);
});

app.get("/api/merge-arena/leaderboard", async (req, res) => {
  try {
    const sort = String(req.query.sort || "trophies");
    const column = sort === "best_wave" ? "best_wave" : "trophies";
    const { data, error } = await supabase
      .from("merge_arena_states")
      .select("user_id, trophies, best_wave, wins, merges, updated_at")
      .order(column, { ascending: false })
      .limit(20);
    if (error) throw error;

    const ids = (data || []).map((row) => String(row.user_id));
    let usersById = {};
    if (ids.length) {
      const { data: users } = await supabase
        .from("users")
        .select("id, username, first_name")
        .in("id", ids);
      usersById = Object.fromEntries((users || []).map((u) => [String(u.id), u]));
    }

    res.json({
      ok: true,
      sort: column,
      rows: (data || []).map((row, index) => {
        const user = usersById[String(row.user_id)] || {};
        return {
          rank: index + 1,
          userId: String(row.user_id),
          name: user.username || user.first_name || `Player ${String(row.user_id).slice(-4)}`,
          trophies: row.trophies || 0,
          bestWave: row.best_wave || 1,
          wins: row.wins || 0,
          merges: row.merges || 0
        };
      })
    });
  } catch (error) {
    console.error("LEADERBOARD_ERROR:", error);
    res.status(500).json({ error: error.message || "LEADERBOARD_FAILED" });
  }
});

app.post("/api/merge-arena/stars/invoice", requirePlayer, async (req, res) => {
  try {
    const productId = String(req.body?.productId || "");
    const product = STAR_PRODUCTS[productId];
    if (!product) {
      res.status(400).json({ error: "UNKNOWN_PRODUCT" });
      return;
    }
    if (!TELEGRAM_BOT_TOKEN) {
      res.status(503).json({ error: "BOT_TOKEN_MISSING" });
      return;
    }

    const payload = `ma|${req.playerId}|${productId}|${Date.now()}`;
    const prices = [{ label: product.title, amount: product.stars }];
    const result = await telegramApi("createInvoiceLink", {
      title: product.title,
      description: product.description,
      payload,
      currency: "XTR",
      prices
    });

    res.json({
      ok: true,
      productId,
      stars: product.stars,
      invoiceLink: result
    });
  } catch (error) {
    console.error("STARS_INVOICE_ERROR:", error);
    res.status(500).json({ error: error.message || "INVOICE_FAILED" });
  }
});

app.post("/api/merge-arena/session", async (req, res) => {
  try {
    const diagnosis = diagnoseTelegramAuth(String(req.body?.initData || ""), TELEGRAM_BOT_TOKEN);
    if (!diagnosis.ok) {
      res.status(401).json({ error: "INVALID_TELEGRAM_AUTH", reason: diagnosis.reason });
      return;
    }
    if (diagnosis.user.is_bot) {
      res.status(403).json({ error: "BOTS_NOT_ALLOWED" });
      return;
    }

    const userId = String(diagnosis.user.id);
    const { error: userError } = await supabase.from("users").upsert(
      {
        id: userId,
        username: diagnosis.user.username || "",
        first_name: diagnosis.user.first_name || "Player"
      },
      { onConflict: "id" }
    );
    if (userError) console.warn("USER_UPSERT:", userError.message);

    // Create a states row only for brand-new players — never wipe existing progress on login.
    let stateMeta = null;
    try {
      const ensured = await ensureArenaRowIfMissing(userId);
      stateMeta = { ...(ensured.data || { user_id: userId }), created: ensured.created };
    } catch (stateError) {
      console.error("STATE_ENSURE_ERROR:", stateError);
      res.status(500).json({
        error: "STATE_ENSURE_FAILED",
        message: stateError.message || "Could not create merge_arena_states row"
      });
      return;
    }

    const session = createSessionToken(userId);
    res.json({
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt,
      stateCreated: Boolean(stateMeta?.created),
      stateMeta,
      user: {
        id: userId,
        username: diagnosis.user.username || "",
        first_name: diagnosis.user.first_name || "Player"
      }
    });
  } catch (error) {
    console.error("SESSION_ERROR:", error);
    res.status(500).json({ error: error.message || "SESSION_FAILED" });
  }
});

app.get("/api/merge-arena/state", requirePlayer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("merge_arena_states")
      .select("state, trophies, best_wave, wins, merges, updated_at")
      .eq("user_id", String(req.playerId))
      .maybeSingle();

    if (error) throw error;
    res.json({
      ok: true,
      state: data?.state || null,
      meta: data
        ? {
            trophies: data.trophies,
            bestWave: data.best_wave,
            wins: data.wins,
            merges: data.merges,
            updatedAt: data.updated_at
          }
        : null
    });
  } catch (error) {
    console.error("LOAD_ERROR:", error);
    res.status(500).json({ error: error.message || "LOAD_FAILED" });
  }
});

app.post("/api/merge-arena/state", requirePlayer, async (req, res) => {
  try {
    const { data, payload } = await ensureArenaRow(req.playerId, req.body?.state);
    res.json({ ok: true, updatedAt: data?.updated_at || payload.updated_at });
  } catch (error) {
    console.error("SAVE_ERROR:", error);
    res.status(500).json({
      error: error.message || "SAVE_FAILED",
      code: error.code || undefined,
      details: error.details || undefined,
      hint: error.hint || undefined
    });
  }
});

app.listen(port, () => {
  console.log(`MERGE ARENA API on :${port}`);
  console.log(`WEBAPP_URL: ${WEBAPP_URL}`);
  syncBotMenuButton().then((result) => {
    if (!result.ok) console.warn("Boot menu sync failed:", result.error);
  });
});
