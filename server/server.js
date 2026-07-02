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

function nowMs() {
  return Date.now();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function number(value) {
  return Number(value || 0);
}

function upgradeCost(building, level) {
  const base = { shop: 50, bank: 120, factory: 200 }[building];
  return Math.floor(base * Math.pow(1.75, Math.max(0, level - 1)));
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

function buildDailyTasks(row) {
  const level = Math.max(1, number(row.shop_level) + number(row.bank_level) + number(row.factory_level));
  const daySeed = Number(todayKey().replaceAll("-", ""));

  const pool = [
    {
      id: "tap-small",
      title: `Tap ${50 + (daySeed % 3) * 25} times`,
      type: "taps",
      target: 50 + (daySeed % 3) * 25,
      reward: 120 + level * 20
    },
    {
      id: "tap-big",
      title: `Tap ${120 + (daySeed % 4) * 40} times`,
      type: "taps",
      target: 120 + (daySeed % 4) * 40,
      reward: 220 + level * 35
    },
    {
      id: "earn-coins",
      title: `Reach ${300 + level * 100} city value`,
      type: "city_value",
      target: 300 + level * 100,
      reward: 250 + level * 40
    },
    {
      id: "upgrade-shop",
      title: "Upgrade Shop",
      type: "shop_level",
      target: Math.max(2, number(row.shop_level)),
      reward: 200 + level * 30
    },
    {
      id: "open-bank",
      title: "Open Bank",
      type: "bank_level",
      target: 1,
      reward: 220
    },
    {
      id: "grow-factory",
      title: "Build Factory",
      type: "factory_level",
      target: 1,
      reward: 300
    }
  ];

  const start = daySeed % pool.length;
  const picked = [];

  for (let i = 0; i < 4; i += 1) {
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
  const date = todayKey();
  const currentTasks = safeJson(row.daily_tasks_json, []);

  const mustCreateTasks =
    row.daily_tasks_date !== date ||
    !Array.isArray(currentTasks) ||
    currentTasks.length === 0;

  if (!mustCreateTasks) {
    return row;
  }

  row.daily_tasks_date = date;
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
        factory: number(row.factory_level)
      }
    }
  };
}

async function getOrCreatePlayer(telegramUser) {
  const telegramId = String(telegramUser?.id || "web_demo");
  const name = telegramUser?.first_name || "Player";
  const username = telegramUser?.username || "";

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
    coins: 0,
    energy: 100,
    taps: 0,
    spent: 0,
    city_value: 0,
    shop_level: 1,
    bank_level: 0,
    factory_level: 0,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const { data, error } = await supabase
    .from("game_states")
    .insert(fresh)
    .select("*")
    .single();

  if (error) throw error;
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
  res.json({ ok: true, app: "Wealthia API", database: true, version: "daily-tasks-v4" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "Wealthia API", database: true, version: "daily-tasks-v4" });
});

app.post("/api/session", async (req, res) => {
  try {
    const row = await getOrCreatePlayer(req.body.telegramUser);
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

    res.json({ amount, user: toClientUser(data) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/upgrade", async (req, res) => {
  try {
    const userId = String(req.body.userId || "");
    const building = String(req.body.building || "");

    if (!["shop", "bank", "factory"].includes(building)) {
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

app.post("/api/leaderboard", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("game_states")
      .select("user_id, city_value")
      .order("city_value", { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json({
      rows: data.map((row) => ({
        userId: row.user_id,
        cityValue: number(row.city_value)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/summary", async (_req, res) => {
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

app.listen(port, () => {
  console.log(`Wealthia backend running on port ${port}`);
});
