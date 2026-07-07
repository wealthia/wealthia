const FLUSH_INTERVAL_MS = Number(process.env.TAP_FLUSH_INTERVAL_MS || 25000);
const TAP_RATE_WINDOW_MS = 1000;
const MAX_TAPS_PER_WINDOW = Number(process.env.MAX_TAPS_PER_SECOND || 15);
const MAX_TAPS_PER_REQUEST = Number(process.env.MAX_TAPS_PER_REQUEST || 20);
const TAP_CACHE_TTL_SEC = Number(process.env.TAP_CACHE_TTL_SEC || 3600);
const REDIS_LOCK_TTL_MS = Number(process.env.TAP_REDIS_LOCK_TTL_MS || 30000);
const REDIS_LOCK_WAIT_MS = Number(process.env.TAP_REDIS_LOCK_WAIT_MS || 5000);

const MERGE_DELTA_FIELDS = [
  "coins",
  "energy",
  "max_energy",
  "spent",
  "shop_level",
  "bank_level",
  "factory_level",
  "casino_level",
  "taps",
  "daily_contest_score",
  "city_value",
  "tap_window_count",
  "tap_violations"
];

const MERGE_PRESERVE_FIELDS = [
  "contest_date",
  "contest_baseline_city",
  "tap_window_start",
  "daily_tasks_date",
  "daily_tasks_json",
  "daily_tasks_claimed_json"
];

function number(value) {
  return Number(value || 0);
}

function cloneRow(row) {
  return row ? { ...row } : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function latestIso(a, b) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return aTime >= bTime ? a : b;
}

function dirtyChanged(state, field) {
  const base = state.baseRow || {};
  const row = state.row || {};
  return !sameValue(row[field], base[field]);
}

function createTapPipeline({ supabase }) {
  const memory = new Map();
  const locks = new Map();
  let redis = null;
  let redisReady = false;

  async function initRedis() {
    const url = String(process.env.REDIS_URL || "").trim();
    if (!url) {
      console.log("Tap pipeline: in-memory cache (set REDIS_URL for Redis)");
      return false;
    }

    try {
      const Redis = require("ioredis");
      redis = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true
      });
      await redis.connect();
      redisReady = true;
      console.log("Tap pipeline: Redis connected");
      return true;
    } catch (error) {
      console.warn("Tap pipeline: Redis unavailable, using in-memory cache:", error.message);
      redis = null;
      redisReady = false;
      return false;
    }
  }

  function redisKey(userId) {
    return `wealthia:tap:${userId}`;
  }

  async function readState(userId) {
    if (!redisReady) {
      return memory.get(userId) || null;
    }

    try {
      const raw = await redis.get(redisKey(userId));
      if (!raw) {
        memory.delete(userId);
        return null;
      }
      const state = JSON.parse(raw);
      if (state && state.row && !state.baseRow) {
        state.baseRow = cloneRow(state.row);
      }
      memory.set(userId, state);
      return state;
    } catch (error) {
      console.warn("TAP_CACHE_READ_FAILED:", userId, error.message);
      return memory.get(userId) || null;
    }
  }

  async function writeState(userId, state) {
    memory.set(userId, state);
    if (!redisReady) return;

    try {
      if (state.dirty) {
        await redis
          .multi()
          .set(redisKey(userId), JSON.stringify(state))
          .sadd("wealthia:tap:dirty", userId)
          .exec();
      } else {
        await redis
          .multi()
          .set(redisKey(userId), JSON.stringify(state), "EX", TAP_CACHE_TTL_SEC)
          .srem("wealthia:tap:dirty", userId)
          .exec();
      }
    } catch (error) {
      console.warn("TAP_CACHE_WRITE_FAILED:", userId, error.message);
    }
  }

  async function acquireRedisLock(userId) {
    if (!redisReady) return null;

    const key = `${redisKey(userId)}:lock`;
    const token = `${process.pid}:${Date.now()}:${Math.random()}`;
    const deadline = Date.now() + REDIS_LOCK_WAIT_MS;

    while (Date.now() <= deadline) {
      const locked = await redis.set(key, token, "PX", REDIS_LOCK_TTL_MS, "NX");
      if (locked) {
        return async () => {
          try {
            await redis.eval(
              "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
              1,
              key,
              token
            );
          } catch (error) {
            console.warn("TAP_LOCK_RELEASE_FAILED:", userId, error.message);
          }
        };
      }

      await sleep(25 + Math.floor(Math.random() * 25));
    }

    throw new Error("TAP_LOCK_TIMEOUT");
  }

  async function withUserLock(userId, task) {
    const key = String(userId);
    const previous = locks.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      const release = await acquireRedisLock(key);
      try {
        return await task();
      } finally {
        if (release) await release();
      }
    });
    locks.set(key, current);

    try {
      return await current;
    } finally {
      if (locks.get(key) === current) {
        locks.delete(key);
      }
    }
  }

  async function clearState(userId) {
    memory.delete(userId);
    if (!redisReady) return;
    try {
      await redis.del(redisKey(userId));
      await redis.srem("wealthia:tap:dirty", userId);
    } catch {
      // ignore
    }
  }

  function hydrateUnlocked(userId, dbRow) {
    const state = {
      row: cloneRow(dbRow),
      baseRow: cloneRow(dbRow),
      dirty: false,
      rateWindowStart: number(dbRow.tap_window_start),
      rateWindowCount: number(dbRow.tap_window_count),
      tapViolations: number(dbRow.tap_violations),
      pendingTournamentTaps: 0,
      lastActivity: Date.now()
    };
    memory.set(userId, state);
    return state;
  }

  function hydrate(userId, dbRow) {
    const state = hydrateUnlocked(userId, dbRow);
    void writeState(userId, state);
    return state;
  }

  function mergeDbRowIntoDirtyState(state, dbRow) {
    const merged = cloneRow(dbRow);
    const base = state.baseRow || {};
    const dirtyRow = state.row || {};

    for (const field of MERGE_DELTA_FIELDS) {
      if (!dirtyChanged(state, field)) continue;
      merged[field] = number(dbRow[field]) + (number(dirtyRow[field]) - number(base[field]));
    }

    for (const field of MERGE_PRESERVE_FIELDS) {
      if (dirtyChanged(state, field) && sameValue(dbRow[field], base[field])) {
        merged[field] = dirtyRow[field];
      }
    }

    if (dirtyChanged(state, "last_seen_at")) {
      merged.last_seen_at = latestIso(dirtyRow.last_seen_at, dbRow.last_seen_at);
    }

    if (dirtyChanged(state, "updated_at")) {
      merged.updated_at = latestIso(dirtyRow.updated_at, dbRow.updated_at);
    }

    return merged;
  }

  async function syncRow(userId, dbRow) {
    if (!dbRow) return null;

    return withUserLock(userId, async () => {
      const state = await readState(userId);
      if (state?.dirty && state.row) {
        state.row = mergeDbRowIntoDirtyState(state, dbRow);
        state.rateWindowStart = number(state.row.tap_window_start);
        state.rateWindowCount = number(state.row.tap_window_count);
        state.tapViolations = number(state.row.tap_violations);
        state.lastActivity = Date.now();
        await writeState(userId, state);
        return cloneRow(state.row);
      }

      const hydrated = hydrateUnlocked(userId, dbRow);
      await writeState(userId, hydrated);
      return cloneRow(dbRow);
    });
  }

  async function ensureHydrated(userId, loadRow) {
    return withUserLock(userId, async () => {
      const existing = await readState(userId);
      if (existing) return existing;

      const row = await loadRow();
      const hydrated = hydrateUnlocked(userId, row);
      await writeState(userId, hydrated);
      return hydrated;
    });
  }

  function getRow(userId) {
    const state = memory.get(userId);
    return state ? cloneRow(state.row) : null;
  }

  function has(userId) {
    return memory.has(userId);
  }

  function checkRate(state, count, now) {
    let windowStart = number(state.rateWindowStart);
    let windowCount = number(state.rateWindowCount);

    if (!windowStart || now - windowStart >= TAP_RATE_WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }

    if (windowCount + count > MAX_TAPS_PER_WINDOW) {
      state.tapViolations = number(state.tapViolations) + 1;
      state.rateWindowStart = windowStart;
      state.rateWindowCount = windowCount;
      return {
        allowed: false,
        retryAfterMs: Math.max(50, TAP_RATE_WINDOW_MS - (now - windowStart))
      };
    }

    state.rateWindowStart = windowStart;
    state.rateWindowCount = windowCount + count;
    return { allowed: true };
  }

  async function applyBatchUnlocked(userId, rawCount, helpers) {
    const count = Math.min(MAX_TAPS_PER_REQUEST, Math.max(1, Math.floor(number(rawCount) || 1)));
    const state = await readState(userId);

    if (!state || !state.row) {
      return { ok: false, error: "NOT_HYDRATED" };
    }

    const now = helpers.nowMs();
    let row = state.row;

    if (typeof helpers.applyPassive === "function") {
      row = helpers.applyPassive(row);
      if (typeof helpers.refreshDailyTasks === "function") {
        row = helpers.refreshDailyTasks(row);
      }
      state.row = row;
      state.dirty = true;
    }

    const endless = helpers.hasEndlessEnergy(row);
    const tapCost = helpers.economy.tapValue(row);
    const amount = helpers.tapPower(row);

    let applied = count;
    if (!endless) {
      const maxByEnergy = Math.floor(number(row.energy) / tapCost);
      if (maxByEnergy <= 0) {
        await writeState(userId, state);
        return { ok: false, error: "NO_ENERGY" };
      }
      applied = Math.min(count, maxByEnergy);
    }

    const rate = checkRate(state, applied, now);
    if (!rate.allowed) {
      state.row.tap_window_start = state.rateWindowStart;
      state.row.tap_window_count = state.rateWindowCount;
      state.row.tap_violations = state.tapViolations;
      state.dirty = true;
      await writeState(userId, state);
      return {
        ok: false,
        error: "TOO_FAST",
        retryAfterMs: rate.retryAfterMs,
        violations: state.tapViolations
      };
    }

    const totalCoins = amount * applied;
    const totalEnergyCost = endless ? 0 : tapCost * applied;
    const today = helpers.todayKey();
    const contestDate = String(row.contest_date || "");
    let dailyScore = number(row.daily_contest_score);

    if (contestDate !== today) {
      dailyScore = 0;
    }

    row.coins = number(row.coins) + totalCoins;
    row.energy = endless ? number(row.energy) : Math.max(0, number(row.energy) - totalEnergyCost);
    row.taps = number(row.taps) + applied;
    row.daily_contest_score = dailyScore + totalCoins;
    row.contest_date = today;
    row.contest_baseline_city = contestDate === today
      ? number(row.contest_baseline_city)
      : helpers.buildCityValue(row);
    row.city_value = number(row.coins) + number(row.spent);
    row.tap_window_start = state.rateWindowStart;
    row.tap_window_count = state.rateWindowCount;
    row.tap_violations = state.tapViolations;
    row.updated_at = new Date().toISOString();

    state.dirty = true;
    state.pendingTournamentTaps = number(state.pendingTournamentTaps) + applied;
    state.lastActivity = now;

    await writeState(userId, state);

    return {
      ok: true,
      amount,
      applied,
      count,
      row: cloneRow(row),
      violations: state.tapViolations
    };
  }

  async function applyBatch(userId, rawCount, helpers) {
    return withUserLock(userId, () => applyBatchUnlocked(userId, rawCount, helpers));
  }

  async function flushUserUnlocked(userId, helpers) {
    const state = await readState(userId);
    if (!state || !state.row) {
      if (redisReady) {
        await redis.srem("wealthia:tap:dirty", String(userId));
      }
      return false;
    }

    if (!state.dirty) return false;

    const contest = helpers.syncDailyContest(state.row);
    const patch = {
      coins: number(state.row.coins),
      energy: number(state.row.energy),
      max_energy: number(state.row.max_energy),
      taps: number(state.row.taps),
      spent: number(state.row.spent),
      shop_level: number(state.row.shop_level),
      bank_level: number(state.row.bank_level),
      factory_level: number(state.row.factory_level),
      casino_level: number(state.row.casino_level),
      daily_contest_score: number(contest.daily_contest_score),
      contest_date: contest.contest_date,
      contest_baseline_city: number(contest.contest_baseline_city),
      city_value: number(state.row.city_value),
      last_seen_at: state.row.last_seen_at,
      daily_tasks_date: state.row.daily_tasks_date,
      daily_tasks_json: state.row.daily_tasks_json,
      daily_tasks_claimed_json: state.row.daily_tasks_claimed_json,
      tap_window_start: number(state.row.tap_window_start),
      tap_window_count: number(state.row.tap_window_count),
      tap_violations: number(state.row.tap_violations),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("game_states")
      .update(patch)
      .eq("user_id", String(userId));

    if (error) throw error;

    const tournamentTaps = number(state.pendingTournamentTaps);
    state.pendingTournamentTaps = 0;
    state.dirty = false;
    state.row = { ...state.row, ...patch };
    state.baseRow = cloneRow(state.row);

    await writeState(userId, state);

    if (redisReady) {
      await redis.srem("wealthia:tap:dirty", String(userId));
    }

    if (tournamentTaps > 0 && typeof helpers.incrementTournamentScore === "function") {
      await helpers.incrementTournamentScore(userId, tournamentTaps, state.row);
    }

    return true;
  }

  async function flushUser(userId, helpers) {
    return withUserLock(userId, () => flushUserUnlocked(userId, helpers));
  }

  async function reload(userId, loadRow, helpers) {
    return withUserLock(userId, async () => {
      await flushUserUnlocked(userId, helpers);
      const row = await loadRow();
      const hydrated = hydrateUnlocked(userId, row);
      await writeState(userId, hydrated);
      return row;
    });
  }

  async function flushAll(helpers) {
    const userIds = new Set();

    for (const [userId, state] of memory.entries()) {
      if (state?.dirty) userIds.add(userId);
    }

    if (redisReady) {
      try {
        const redisDirty = await redis.smembers("wealthia:tap:dirty");
        for (const userId of redisDirty) userIds.add(userId);
      } catch (error) {
        console.warn("TAP_FLUSH_DIRTY_READ_FAILED:", error.message);
      }
    }

    for (const userId of userIds) {
      try {
        await flushUser(userId, helpers);
      } catch (error) {
        console.error("TAP_FLUSH_FAILED:", userId, error.message);
      }
    }
  }

  function startFlushLoop(helpers) {
    return setInterval(() => {
      flushAll(helpers).catch((error) => {
        console.error("TAP_FLUSH_LOOP:", error.message);
      });
    }, FLUSH_INTERVAL_MS);
  }

  function stats() {
    let dirty = 0;
    for (const state of memory.values()) {
      if (state?.dirty) dirty += 1;
    }
    return {
      cachedUsers: memory.size,
      dirtyUsers: dirty,
      redis: redisReady,
      flushIntervalMs: FLUSH_INTERVAL_MS,
      maxTapsPerSecond: MAX_TAPS_PER_WINDOW
    };
  }

  async function getLiveRow(userId, fallbackRow) {
    const state = await readState(userId);
    if (state?.row) return cloneRow(state.row);
    if (fallbackRow) {
      const hydrated = hydrateUnlocked(userId, fallbackRow);
      await writeState(userId, hydrated);
      return cloneRow(fallbackRow);
    }
    return null;
  }

  return {
    initRedis,
    hydrate,
    syncRow,
    ensureHydrated,
    getRow,
    getLiveRow,
    has,
    applyBatch,
    reload,
    flushUser,
    flushAll,
    startFlushLoop,
    clearState,
    stats
  };
}

module.exports = {
  createTapPipeline,
  FLUSH_INTERVAL_MS,
  MAX_TAPS_PER_WINDOW,
  MAX_TAPS_PER_REQUEST
};
