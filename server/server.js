const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors());
app.use(express.json());

const MAX_ENERGY = 100;
const ENERGY_RECOVERY_PER_MINUTE = 2;
const OFFLINE_INCOME_PER_BANK_LEVEL_PER_MINUTE = 3;
const TASK_REFRESH_MS = 12 * 60 * 60 * 1000;
const TASKS_PER_CYCLE = 4;
const BOOST_DURATION_MS = 30 * 60 * 1000;
const REFERRAL_BONUS = 500;
const NEW_PLAYER_BONUS = 100;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

const EARN_TASKS = {
  sponsor: { reward: 750, field: "sponsor_done" },
  ad: { reward: 300, field: "ad_done" },
  channel: { reward: 500, field: "channel_done" }
};

const BOOST_OPTIONS = {
  fullEnergy: { cost: 100, type: "energy" },
  tapBoost: { cost: 150, type: "tap" },
  incomeBoost: { cost: 200, type: "income" }
};

function nowMs() {
  return Date.now();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function taskCycleKey(ms = nowMs()) {
  return String(Math.floor(ms / TASK_REFRESH_MS));
}

function nextTaskRefreshMs(ms = nowMs()) {
  const cycle = Math.floor(ms / TASK_REFRESH_MS);
  return (cycle + 1) * TASK_REFRESH_MS;
}

function yesterdayKey() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dailyRewardAmount(row) {
  const streak = nextDailyStreak(row);
  return 100 + Math.max(0, streak - 1) * 50;
}

function nextDailyStreak(row) {
  const today = todayKey();
  const yesterday = yesterdayKey();

  if (row.daily_date === today) {
    return Math.max(1, number(row.daily_streak));
  }

  if (row.daily_date === yesterday) {
    return Math.max(1, number(row.daily_streak)) + 1;
  }

  return 1;
}

function dailyRewardClaimedToday(row) {
  return row.daily_date === todayKey();
}

function parseReferrerId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("ref_")) {
    return raw.slice(4);
  }

  return raw;
}

function number(value) {
  return Number(value || 0);
}

function upgradeCost(building, level) {
  const base = { shop: 50, bank: 120, factory: 200, casino: 300 }[building];
  return Math.floor(base * Math.pow(1.75, Math.max(0, level - 1)));
}

function empireLevel(row) {
  return (
    number(row.shop_level) +
    number(row.bank_level) +
    number(row.factory_level) +
    number(row.casino_level)
  );
}

function casinoSpinReward(level) {
  const lv = Math.max(1, number(level));
  const roll = Math.random();

  if (roll < 0.05) {
    return { reward: 2000 + lv * 500, tier: "jackpot" };
  }
  if (roll < 0.25) {
    return { reward: 500 + lv * 150, tier: "big" };
  }
  if (roll < 0.55) {
    return { reward: 200 + lv * 80, tier: "medium" };
  }
  return { reward: 80 + lv * 40, tier: "small" };
}

function casinoSpunToday(row) {
  return row.casino_date === todayKey();
}

function tapPower(row) {
  const boostActive = number(row.tap_boost_until) > nowMs();
  const base = Math.max(1, number(row.shop_level));
  return boostActive ? base * 2 : base;
}

function incomeMultiplier(row) {
  return number(row.income_boost_until) > nowMs() ? 2 : 1;
}

function buildCityValue(row) {
  return number(row.coins) + number(row.spent);
}

function safeJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value || "");
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

function adminSecretFromRequest(req) {
  return String(
    req.headers["x-admin-secret"] ||
    req.query.secret ||
    req.body.adminSecret ||
    ""
  ).trim();
}

function requireAdmin(req, res) {
  if (!ADMIN_SECRET) {
    res.status(503).json({ error: "ADMIN_NOT_CONFIGURED" });
    return false;
  }

  if (adminSecretFromRequest(req) !== ADMIN_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return false;
  }

  return true;
}

function tournamentIsLive(row, ms = nowMs()) {
  if (!row || row.status !== "active") return false;
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();
  return ms >= starts && ms < ends;
}

async function getActiveTournament() {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  const live = (data || []).find((row) => tournamentIsLive(row));
  return live || null;
}

async function getTournamentEntry(tournamentId, userId) {
  const { data, error } = await supabase
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("user_id", String(userId))
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function incrementTournamentScore(userId, amount = 1) {
  const tournament = await getActiveTournament();
  if (!tournament) return;

  const entry = await getTournamentEntry(tournament.id, userId);
  if (!entry) return;

  await supabase
    .from("tournament_entries")
    .update({
      tap_score: number(entry.tap_score) + number(amount)
    })
    .eq("id", entry.id);
}

async function logMetric(metricType, amount, notes = "", extra = {}) {
  await supabase.from("admin_metrics").insert({
    metric_type: metricType,
    amount: number(amount),
    notes: String(notes || ""),
    user_id: extra.userId || null,
    tournament_id: extra.tournamentId || null
  });
}

function toClientTournament(row, entry = null) {
  if (!row) return null;

  const ms = nowMs();
  const starts = new Date(row.starts_at).getTime();
  const ends = new Date(row.ends_at).getTime();

  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    entryFee: number(row.entry_fee),
    prizePool: number(row.prize_pool),
    prizes: {
      winner: number(row.prize_winner),
      runnerUp: number(row.prize_runner_up),
      third: number(row.prize_third)
    },
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isLive: tournamentIsLive(row, ms),
    hasStarted: ms >= starts,
    hasEnded: ms >= ends,
    joined: Boolean(entry),
    myScore: entry ? number(entry.tap_score) : 0
  };
}

function buildDailyTasks(row) {
  const shop = number(row.shop_level);
  const bank = number(row.bank_level);
  const factory = number(row.factory_level);
  const level = Math.max(1, shop + bank + factory);
  const cycleSeed = Number(taskCycleKey());

  const pool = [
    {
      id: "tap-small",
      title: `Tap ${40 + level * 15} times`,
      type: "taps",
      target: 40 + level * 15,
      reward: 100 + level * 25
    },
    {
      id: "tap-big",
      title: `Tap ${100 + level * 30} times`,
      type: "taps",
      target: 100 + level * 30,
      reward: 200 + level * 40
    },
    {
      id: "earn-coins",
      title: `Reach ${Math.max(500, 200 + level * 150)} city value`,
      type: "city_value",
      target: Math.max(500, 200 + level * 150),
      reward: 180 + level * 45
    }
  ];

  if (shop < 12) {
    pool.push({
      id: "upgrade-shop",
      title: `Upgrade Shop to Lv.${shop + 1}`,
      type: "shop_level",
      target: shop + 1,
      reward: 150 + level * 35
    });
  }

  if (bank < 1) {
    pool.push({
      id: "open-bank",
      title: "Open Bank",
      type: "bank_level",
      target: 1,
      reward: 200 + level * 20
    });
  } else if (bank < 10) {
    pool.push({
      id: "upgrade-bank",
      title: `Upgrade Bank to Lv.${bank + 1}`,
      type: "bank_level",
      target: bank + 1,
      reward: 180 + level * 30
    });
  }

  if (factory < 1) {
    pool.push({
      id: "grow-factory",
      title: "Build Factory",
      type: "factory_level",
      target: 1,
      reward: 250 + level * 35
    });
  } else if (factory < 10) {
    pool.push({
      id: "upgrade-factory",
      title: `Upgrade Factory to Lv.${factory + 1}`,
      type: "factory_level",
      target: factory + 1,
      reward: 220 + level * 40
    });
  }

  const start = pool.length ? cycleSeed % pool.length : 0;
  const picked = [];

  for (let i = 0; i < Math.min(TASKS_PER_CYCLE, pool.length); i += 1) {
    picked.push(pool[(start + i) % pool.length]);
  }

  return picked;
}

function taskProgress(row, task) {
  if (task.type === "taps") return number(row.taps);
  if (task.type === "city_value") return buildCityValue(row);
  if (task.type === "shop_level") return number(row.shop_level);
  if (task.type === "bank_level") return number(row.bank_level);
  if (task.type === "factory_level") return number(row.factory_level);
  return 0;
}

function taskReady(row, task) {
  return taskProgress(row, task) >= number(task.target);
}

function refreshDailyTasks(row) {
  const cycleKey = taskCycleKey();
  const currentTasks = safeJson(row.daily_tasks_json, []);

  const mustCreateTasks =
    row.daily_tasks_date !== cycleKey ||
    !Array.isArray(currentTasks) ||
    currentTasks.length === 0;

  if (!mustCreateTasks) {
    return row;
  }

  row.daily_tasks_date = cycleKey;
  row.daily_tasks_json = buildDailyTasks(row);
  row.daily_tasks_claimed_json = [];

  return row;
}

function applyPassive(row) {
  const current = nowMs();
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : current;
  const minutes = Math.max(0, (current - lastSeen) / 60000);

  const energyGain = Math.floor(minutes * ENERGY_RECOVERY_PER_MINUTE);
  const bankIncome = Math.floor(minutes * number(row.bank_level) * OFFLINE_INCOME_PER_BANK_LEVEL_PER_MINUTE * incomeMultiplier(row));

  row.energy = Math.min(MAX_ENERGY, number(row.energy) + energyGain);
  row.coins = number(row.coins) + bankIncome;
  row.city_value = buildCityValue(row);
  row.last_seen_at = new Date(current).toISOString();

  return row;
}

function toClientUser(row) {
  const tasks = safeJson(row.daily_tasks_json, []);
  const claimed = safeJson(row.daily_tasks_claimed_json, []);

  return {
    userId: row.user_id,
    game: {
      coins: number(row.coins),
      energy: number(row.energy),
      taps: number(row.taps),
      spent: number(row.spent),
      cityValue: buildCityValue(row),
      dailyDate: row.daily_date || "",
      dailyStreak: number(row.daily_streak),
      dailyTasksDate: row.daily_tasks_date || "",
      dailyTasksNextRefresh: new Date(nextTaskRefreshMs()).toISOString(),
      dailyReward: {
        streak: number(row.daily_streak),
        claimedToday: dailyRewardClaimedToday(row),
        nextAmount: dailyRewardAmount(row)
      },
      boosts: {
        tapActive: number(row.tap_boost_until) > nowMs(),
        incomeActive: number(row.income_boost_until) > nowMs(),
        tapUntil: number(row.tap_boost_until),
        incomeUntil: number(row.income_boost_until)
      },
      dailyTasks: tasks.map((task) => ({
        ...task,
        progress: taskProgress(row, task),
        ready: taskReady(row, task),
        claimed: claimed.includes(task.id)
      })),
      tasks: {
        tap100: Boolean(row.tap100_done),
        earn500: Boolean(row.earn500_done),
        shopUpgrade: Boolean(row.shop_upgrade_done),
        bankOpen: Boolean(row.bank_open_done),
        invite: Boolean(row.invite_done),
        sponsor: Boolean(row.sponsor_done),
        ad: Boolean(row.ad_done),
        channel: Boolean(row.channel_done)
      },
      buildings: {
        shop: number(row.shop_level),
        bank: number(row.bank_level),
        factory: number(row.factory_level),
        casino: number(row.casino_level)
      },
      empireLevel: empireLevel(row),
      casino: {
        level: number(row.casino_level),
        spunToday: casinoSpunToday(row),
        canSpin: number(row.casino_level) >= 1 && !casinoSpunToday(row)
      }
    }
  };
}

async function creditReferrer(referrerId, newUserId) {
  const referrer = String(referrerId || "");
  const newbie = String(newUserId || "");

  if (!referrer || !newbie || referrer === newbie) return;

  const { data: refRow } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", referrer)
    .maybeSingle();

  if (!refRow) return;

  const bonus = REFERRAL_BONUS;

  await supabase
    .from("game_states")
    .update({
      coins: number(refRow.coins) + bonus,
      city_value: number(refRow.coins) + bonus + number(refRow.spent),
      invite_done: true,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", referrer);
}

async function getOrCreatePlayer(telegramUser, referrerId = "") {
  const telegramId = String(telegramUser?.id || "web_demo");
  const name = telegramUser?.first_name || "Player";
  const username = telegramUser?.username || "";
  const referrer = parseReferrerId(referrerId);

  await supabase.from("users").upsert({
    id: telegramId,
    telegram_id: telegramId,
    first_name: name,
    username,
    last_seen_at: new Date().toISOString()
  });

  const { data: existing } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", telegramId)
    .maybeSingle();

  if (existing) {
    let row = refreshDailyTasks(applyPassive(existing));

    const { data: saved, error } = await supabase
      .from("game_states")
      .update({
        coins: row.coins,
        energy: row.energy,
        city_value: row.city_value,
        last_seen_at: row.last_seen_at,
        daily_tasks_date: row.daily_tasks_date,
        daily_tasks_json: row.daily_tasks_json,
        daily_tasks_claimed_json: row.daily_tasks_claimed_json,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", telegramId)
      .select("*")
      .single();

    if (error) throw error;
    return saved;
  }

  const fresh = refreshDailyTasks({
    user_id: telegramId,
    coins: NEW_PLAYER_BONUS,
    energy: 100,
    taps: 0,
    spent: 0,
    city_value: NEW_PLAYER_BONUS,
    shop_level: 1,
    bank_level: 0,
    factory_level: 0,
    casino_level: 0,
    casino_date: "",
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const { data, error } = await supabase
    .from("game_states")
    .insert(fresh)
    .select("*")
    .single();

  if (error) throw error;

  if (referrer) {
    await creditReferrer(referrer, telegramId);
  }

  return data;
}

async function loadGame(userId) {
  const { data, error } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", String(userId))
    .single();

  if (error) throw error;

  let row = refreshDailyTasks(applyPassive(data));

  const { data: saved, error: saveError } = await supabase
    .from("game_states")
    .update({
      coins: row.coins,
      energy: row.energy,
      city_value: row.city_value,
      last_seen_at: row.last_seen_at,
      daily_tasks_date: row.daily_tasks_date,
      daily_tasks_json: row.daily_tasks_json,
      daily_tasks_claimed_json: row.daily_tasks_claimed_json,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", String(userId))
    .select("*")
    .single();

  if (saveError) throw saveError;
  return saved;
}

app.get("/", (_req, res) => {
  res.json({ ok: true, app: "Wealthia API", database: true, version: "admin-tournaments-v2" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "Wealthia API", database: true, version: "admin-tournaments-v2" });
});

app.post("/api/session", async (req, res) => {
  try {
    const referrerId = parseReferrerId(req.body.referrerId || req.body.referralId);
    const row = await getOrCreatePlayer(req.body.telegramUser, referrerId);
    res.json(toClientUser(row));
  } catch (error) {
    console.error("SESSION_ERROR:", error);
    res.status(500).json({
      error: error.message,
      details: error.details || "",
      hint: error.hint || "",
      code: error.code || ""
    });
  }
});
app.post("/api/tap", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const row = await loadGame(userId);

    if (number(row.energy) < 1) {
      res.status(400).json({ error: "NO_ENERGY" });
      return;
    }

    const amount = tapPower(row);
    const updated = {
      coins: number(row.coins) + amount,
      energy: Math.max(0, number(row.energy) - 1),
      taps: number(row.taps) + 1,
      city_value: number(row.coins) + amount + number(row.spent),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("game_states")
      .update(updated)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    await incrementTournamentScore(userId, 1);

    res.json({ amount, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/upgrade", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const building = String(req.body.building || "");

    if (!["shop", "bank", "factory", "casino"].includes(building)) {
      res.status(400).json({ error: "BAD_BUILDING" });
      return;
    }

    const row = await loadGame(userId);
    const column = `${building}_level`;
    const level = number(row[column]);
    const cost = upgradeCost(building, building === "shop" ? level : level + 1);

    if (number(row.coins) < cost) {
      res.status(400).json({ error: "NOT_ENOUGH_COINS" });
      return;
    }

    const updated = {
      coins: number(row.coins) - cost,
      spent: number(row.spent) + cost,
      [column]: level + 1,
      city_value: number(row.coins) - cost + number(row.spent) + cost,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("game_states")
      .update(updated)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ cost, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/claim-task", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const taskId = String(req.body.task || "");

    const row = await loadGame(userId);
    const tasks = safeJson(row.daily_tasks_json, []);
    const claimed = safeJson(row.daily_tasks_claimed_json, []);
    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      res.status(404).json({ error: "TASK_NOT_FOUND" });
      return;
    }

    if (claimed.includes(task.id)) {
      res.status(400).json({ error: "TASK_ALREADY_CLAIMED" });
      return;
    }

    if (!taskReady(row, task)) {
      res.status(400).json({ error: "TASK_NOT_READY" });
      return;
    }

    const reward = number(task.reward);
    const updatedClaimed = [...claimed, task.id];

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        daily_tasks_claimed_json: updatedClaimed,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, reward, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/claim-daily", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const row = await loadGame(userId);

    if (dailyRewardClaimedToday(row)) {
      res.status(400).json({ error: "ALREADY_CLAIMED" });
      return;
    }

    const streak = nextDailyStreak(row);
    const reward = dailyRewardAmount(row);

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        daily_date: todayKey(),
        daily_streak: streak,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, reward, streak, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/claim-earn", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const type = String(req.body.type || "");
    const earnTask = EARN_TASKS[type];

    if (!earnTask) {
      res.status(400).json({ error: "BAD_EARN_TYPE" });
      return;
    }

    const row = await loadGame(userId);

    if (Boolean(row[earnTask.field])) {
      res.status(400).json({ error: "ALREADY_CLAIMED" });
      return;
    }

    const reward = earnTask.reward;

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        [earnTask.field]: true,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, reward, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/buy-boost", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const boost = String(req.body.boost || "");
    const option = BOOST_OPTIONS[boost];

    if (!option) {
      res.status(400).json({ error: "BAD_BOOST" });
      return;
    }

    const row = await loadGame(userId);

    if (number(row.coins) < option.cost) {
      res.status(400).json({ error: "NOT_ENOUGH_COINS" });
      return;
    }

    const updated = {
      coins: number(row.coins) - option.cost,
      city_value: number(row.coins) - option.cost + number(row.spent),
      updated_at: new Date().toISOString()
    };

    if (option.type === "energy") {
      updated.energy = MAX_ENERGY;
    }

    if (option.type === "tap") {
      updated.tap_boost_until = nowMs() + BOOST_DURATION_MS;
    }

    if (option.type === "income") {
      updated.income_boost_until = nowMs() + BOOST_DURATION_MS;
    }

    const { data, error } = await supabase
      .from("game_states")
      .update(updated)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, boost, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/casino-spin", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const row = await loadGame(userId);

    if (number(row.casino_level) < 1) {
      res.status(400).json({ error: "CASINO_LOCKED" });
      return;
    }

    if (casinoSpunToday(row)) {
      res.status(400).json({ error: "ALREADY_SPUN" });
      return;
    }

    const spin = casinoSpinReward(row.casino_level);
    const reward = spin.reward;

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + reward,
        city_value: number(row.coins) + reward + number(row.spent),
        casino_date: todayKey(),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    res.json({
      ok: true,
      reward,
      tier: spin.tier,
      user: toClientUser(data)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reset", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: NEW_PLAYER_BONUS,
        energy: MAX_ENERGY,
        taps: 0,
        spent: 0,
        city_value: NEW_PLAYER_BONUS,
        shop_level: 1,
        bank_level: 0,
        factory_level: 0,
        casino_level: 0,
        daily_date: "",
        daily_streak: 0,
        daily_tasks_date: "",
        daily_tasks_json: [],
        daily_tasks_claimed_json: [],
        sponsor_done: false,
        ad_done: false,
        channel_done: false,
        casino_date: "",
        tap_boost_until: 0,
        income_boost_until: 0,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    let row = refreshDailyTasks(applyPassive(data));

    const { data: saved, error: saveError } = await supabase
      .from("game_states")
      .update({
        daily_tasks_date: row.daily_tasks_date,
        daily_tasks_json: row.daily_tasks_json,
        daily_tasks_claimed_json: row.daily_tasks_claimed_json,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (saveError) throw saveError;

    res.json({ ok: true, user: toClientUser(saved) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/leaderboard", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");

    const { data, error } = await supabase
      .from("game_states")
      .select("user_id, city_value")
      .order("city_value", { ascending: false })
      .limit(20);

    if (error) throw error;

    const ids = data.map((row) => row.user_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, first_name, username")
      .in("id", ids);

    const userMap = new Map((users || []).map((user) => [user.id, user]));

    res.json({
      rows: data.map((row, index) => {
        const profile = userMap.get(row.user_id) || {};
        return {
          rank: index + 1,
          userId: row.user_id,
          name: profile.first_name || profile.username || `Player ${String(row.user_id).slice(-4)}`,
          cityValue: number(row.city_value),
          isYou: row.user_id === userId
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/auth", async (req, res) => {
  const secret = String(req.body.adminSecret || req.body.secret || "").trim();

  if (!ADMIN_SECRET) {
    res.status(503).json({ error: "ADMIN_NOT_CONFIGURED" });
    return;
  }

  if (secret !== ADMIN_SECRET) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  res.json({ ok: true });
});

app.get("/api/admin/ping", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ ok: true });
});

app.get("/api/admin/summary", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { count: users } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const { data } = await supabase
      .from("game_states")
      .select("coins, taps, city_value");

    const totals = (data || []).reduce(
      (acc, row) => {
        acc.coins += number(row.coins);
        acc.taps += number(row.taps);
        acc.cityValue += number(row.city_value);
        return acc;
      },
      { coins: 0, taps: 0, cityValue: 0 }
    );

    res.json({ users: users || 0, totals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/dashboard", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { count: totalPlayers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const dayAgo = new Date(nowMs() - 24 * 60 * 60 * 1000).toISOString();

    const { count: activeToday } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", dayAgo);

    const { data: gameRows } = await supabase
      .from("game_states")
      .select("coins, taps, city_value");

    const totals = (gameRows || []).reduce(
      (acc, row) => {
        acc.coins += number(row.coins);
        acc.taps += number(row.taps);
        acc.cityValue += number(row.city_value);
        return acc;
      },
      { coins: 0, taps: 0, cityValue: 0 }
    );

    const { data: metrics, error: metricsError } = await supabase
      .from("admin_metrics")
      .select("metric_type, amount");

    if (metricsError && metricsError.code !== "PGRST205") throw metricsError;

    const revenue = (metrics || []).reduce(
      (acc, row) => {
        const value = number(row.amount);
        acc.total += value;
        if (row.metric_type === "tournament_fee") acc.tournamentFees += value;
        if (row.metric_type === "ad_revenue") acc.adRevenue += value;
        if (row.metric_type === "sponsor") acc.sponsor += value;
        return acc;
      },
      { total: 0, tournamentFees: 0, adRevenue: 0, sponsor: 0 }
    );

    const { count: tournamentEntries, error: entriesError } = await supabase
      .from("tournament_entries")
      .select("*", { count: "exact", head: true });

    if (entriesError && entriesError.code !== "PGRST205") throw entriesError;

    let activeTournament = null;
    try {
      activeTournament = await getActiveTournament();
    } catch {
      activeTournament = null;
    }

    res.json({
      players: {
        total: totalPlayers || 0,
        activeToday: activeToday || 0
      },
      totals,
      revenue,
      tournaments: {
        active: activeTournament ? toClientTournament(activeTournament) : null,
        totalEntries: tournamentEntries || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/players", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const limit = Math.min(100, Math.max(1, number(req.query.limit) || 50));
    const offset = Math.max(0, number(req.query.offset) || 0);
    const search = String(req.query.search || "").trim().toLowerCase();

    const { data: users, error } = await supabase
      .from("users")
      .select("id, first_name, username, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const ids = (users || []).map((user) => user.id);
    const { data: games } = ids.length
      ? await supabase
        .from("game_states")
        .select("user_id, coins, taps, city_value, shop_level, bank_level, factory_level")
        .in("user_id", ids)
      : { data: [] };

    const gameMap = new Map((games || []).map((row) => [row.user_id, row]));

    let rows = (users || []).map((user) => {
      const game = gameMap.get(user.id) || {};
      return {
        userId: user.id,
        name: user.first_name || user.username || `Player ${String(user.id).slice(-4)}`,
        username: user.username || "",
        lastSeenAt: user.last_seen_at,
        coins: number(game.coins),
        taps: number(game.taps),
        cityValue: number(game.city_value),
        level: number(game.shop_level) + number(game.bank_level) + number(game.factory_level)
      };
    });

    if (search) {
      rows = rows.filter((row) =>
        row.name.toLowerCase().includes(search) ||
        row.username.toLowerCase().includes(search) ||
        row.userId.includes(search)
      );
    }

    res.json({ rows, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/grant-coins", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const userId = String(req.body.userId || "");
    const amount = number(req.body.amount);

    if (!userId || amount <= 0) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const row = await loadGame(userId);

    const { data, error } = await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + amount,
        city_value: number(row.coins) + amount + number(row.spent),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    await logMetric("manual_grant", amount, "Admin coin grant", { userId });

    res.json({ ok: true, amount, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/tournaments", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const ids = (data || []).map((row) => row.id);
    const { data: counts } = ids.length
      ? await supabase
        .from("tournament_entries")
        .select("tournament_id")
        .in("tournament_id", ids)
      : { data: [] };

    const entryCounts = (counts || []).reduce((acc, row) => {
      acc[row.tournament_id] = (acc[row.tournament_id] || 0) + 1;
      return acc;
    }, {});

    res.json({
      rows: (data || []).map((row) => ({
        ...toClientTournament(row),
        entries: entryCounts[row.id] || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/tournaments", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const entryFee = Math.max(0, number(req.body.entryFee));
    const prizeWinner = Math.max(0, number(req.body.prizeWinner));
    const prizeRunnerUp = Math.max(0, number(req.body.prizeRunnerUp));
    const prizeThird = Math.max(0, number(req.body.prizeThird));
    const durationHours = Math.max(1, number(req.body.durationHours) || 24);
    const activate = Boolean(req.body.activate);

    if (!title) {
      res.status(400).json({ error: "TITLE_REQUIRED" });
      return;
    }

    const prizePool = prizeWinner + prizeRunnerUp + prizeThird;
    const startsAt = new Date().toISOString();
    const endsAt = new Date(nowMs() + durationHours * 60 * 60 * 1000).toISOString();

    if (activate) {
      await supabase
        .from("tournaments")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("status", "active");
    }

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        title,
        description,
        entry_fee: entryFee,
        prize_pool: prizePool,
        prize_winner: prizeWinner,
        prize_runner_up: prizeRunnerUp,
        prize_third: prizeThird,
        status: activate ? "active" : "draft",
        starts_at: startsAt,
        ends_at: endsAt
      })
      .select("*")
      .single();

    if (error) throw error;

    res.json({ ok: true, tournament: toClientTournament(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/tournaments/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const tournamentId = String(req.body.tournamentId || "");
    const status = String(req.body.status || "");

    if (!tournamentId || !["draft", "active", "ended"].includes(status)) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    if (status === "active") {
      await supabase
        .from("tournaments")
        .update({ status: "ended", updated_at: new Date().toISOString() })
        .eq("status", "active");
    }

    const { data, error } = await supabase
      .from("tournaments")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", tournamentId)
      .select("*")
      .single();

    if (error) throw error;

    if (status === "ended") {
      await distributeTournamentPrizes(data);
    }

    res.json({ ok: true, tournament: toClientTournament(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function distributeTournamentPrizes(tournament) {
  const { data: entries, error } = await supabase
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournament.id)
    .order("tap_score", { ascending: false })
    .limit(3);

  if (error) throw error;

  const prizes = [
    number(tournament.prize_winner),
    number(tournament.prize_runner_up),
    number(tournament.prize_third)
  ];

  for (let i = 0; i < (entries || []).length; i += 1) {
    const entry = entries[i];
    const prize = prizes[i];
    if (!prize) continue;

    const row = await loadGame(entry.user_id);

    await supabase
      .from("game_states")
      .update({
        coins: number(row.coins) + prize,
        city_value: number(row.coins) + prize + number(row.spent),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", entry.user_id);

    await supabase
      .from("tournament_entries")
      .update({ prize_won: prize })
      .eq("id", entry.id);
  }
}

app.post("/api/admin/metrics", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const metricType = String(req.body.metricType || "manual");
    const amount = number(req.body.amount);
    const notes = String(req.body.notes || "");

    if (!amount) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    await logMetric(metricType, amount, notes);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/metrics", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { data, error } = await supabase
      .from("admin_metrics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ rows: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tournaments/active", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const tournament = await getActiveTournament();

    if (!tournament) {
      res.json({ tournament: null });
      return;
    }

    const entry = userId ? await getTournamentEntry(tournament.id, userId) : null;

    res.json({ tournament: toClientTournament(tournament, entry) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tournaments/join", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const tournamentId = String(req.body.tournamentId || "");

    if (!userId || !tournamentId) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (tournamentError) throw tournamentError;

    if (!tournamentIsLive(tournament)) {
      res.status(400).json({ error: "TOURNAMENT_NOT_LIVE" });
      return;
    }

    const existing = await getTournamentEntry(tournamentId, userId);
    if (existing) {
      res.status(400).json({ error: "ALREADY_JOINED" });
      return;
    }

    const row = await loadGame(userId);
    const fee = number(tournament.entry_fee);

    if (fee > 0 && number(row.coins) < fee) {
      res.status(400).json({ error: "NOT_ENOUGH_COINS" });
      return;
    }

    if (fee > 0) {
      await supabase
        .from("game_states")
        .update({
          coins: number(row.coins) - fee,
          city_value: number(row.coins) - fee + number(row.spent),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      await logMetric("tournament_fee", fee, `Entry: ${tournament.title}`, {
        userId,
        tournamentId
      });
    }

    const { error: entryError } = await supabase
      .from("tournament_entries")
      .insert({
        tournament_id: tournamentId,
        user_id: userId,
        entry_paid: fee,
        tap_score: 0
      });

    if (entryError) throw entryError;

    const updatedRow = await loadGame(userId);
    const entry = await getTournamentEntry(tournamentId, userId);

    res.json({
      ok: true,
      fee,
      tournament: toClientTournament(tournament, entry),
      user: toClientUser(updatedRow)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tournaments/leaderboard", async (req, res) => {
  try {
    const tournamentId = String(req.body.tournamentId || "");
    const userId = String(req.body.userId || "");

    if (!tournamentId) {
      res.status(400).json({ error: "BAD_REQUEST" });
      return;
    }

    const { data, error } = await supabase
      .from("tournament_entries")
      .select("user_id, tap_score, prize_won")
      .eq("tournament_id", tournamentId)
      .order("tap_score", { ascending: false })
      .limit(20);

    if (error) throw error;

    const ids = (data || []).map((row) => row.user_id);
    const { data: users } = ids.length
      ? await supabase
        .from("users")
        .select("id, first_name, username")
        .in("id", ids)
      : { data: [] };

    const userMap = new Map((users || []).map((user) => [user.id, user]));

    res.json({
      rows: (data || []).map((row, index) => {
        const profile = userMap.get(row.user_id) || {};
        return {
          rank: index + 1,
          userId: row.user_id,
          name: profile.first_name || profile.username || `Player ${String(row.user_id).slice(-4)}`,
          tapScore: number(row.tap_score),
          prizeWon: number(row.prize_won),
          isYou: row.user_id === userId
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Wealthia backend running on port ${port}`);
});
