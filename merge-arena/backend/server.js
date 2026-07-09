const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SESSION_SECRET =
  process.env.SESSION_SECRET || TELEGRAM_BOT_TOKEN || "merge-arena-dev-secret";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INIT_DATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: "256kb" }));

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
    energy: Math.max(0, Math.min(20, Math.floor(Number(raw.energy) || 0))),
    gems: Math.max(0, Math.floor(Number(raw.gems) || 0)),
    trophies: Math.max(0, Math.floor(Number(raw.trophies) || 0)),
    wave: Math.max(1, Math.floor(Number(raw.wave) || 1)),
    bestWave: Math.max(1, Math.floor(Number(raw.bestWave) || 1)),
    wins: Math.max(0, Math.floor(Number(raw.wins) || 0)),
    merges: Math.max(0, Math.floor(Number(raw.merges) || 0)),
    highestPower: Math.max(0, Math.floor(Number(raw.highestPower) || 0)),
    surgeBattles: Math.max(0, Math.floor(Number(raw.surgeBattles) || 0)),
    discovered: Array.isArray(raw.discovered) ? raw.discovered.map(String).slice(0, 32) : [],
    board,
    lastEnergyAt: Math.max(0, Math.floor(Number(raw.lastEnergyAt) || Date.now()))
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
    version: "merge-arena-v3"
  });
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

    // Always create/update a states row on login so Supabase is never empty after session.
    let stateMeta = null;
    try {
      const ensured = await ensureArenaRow(userId, {
        energy: 12,
        gems: 80,
        trophies: 0,
        wave: 1,
        bestWave: 1,
        wins: 0,
        merges: 0,
        highestPower: 0,
        surgeBattles: 0,
        discovered: ["spark", "blade"],
        board: Array(16).fill(null),
        lastEnergyAt: Date.now()
      });
      stateMeta = ensured.data || { user_id: userId };
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
      stateCreated: true,
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
});
