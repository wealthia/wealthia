const FLUSH_INTERVAL_MS = Number(process.env.TAP_FLUSH_INTERVAL_MS || 25000);
const TAP_RATE_WINDOW_MS = 1000;
const MAX_TAPS_PER_WINDOW = Number(process.env.MAX_TAPS_PER_SECOND || 15);
const MAX_TAPS_PER_REQUEST = Number(process.env.MAX_TAPS_PER_REQUEST || 20);
const TAP_CACHE_TTL_SEC = Number(process.env.TAP_CACHE_TTL_SEC || 3600);

function number(value) {
  return Number(value || 0);
}

function cloneRow(row) {
  return row ? { ...row } : null;
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
    if (memory.has(userId)) {
      return memory.get(userId);
    }

    if (!redisReady) return null;

    try {
      const raw = await redis.get(redisKey(userId));
      if (!raw) return null;
      const state = JSON.parse(raw);
      memory.set(userId, state);
      return state;
    } catch (error) {
      console.warn("TAP_CACHE_READ_FAILED:", userId, error.message);
      return null;
    }
  }

  async function writeState(userId, state) {
    memory.set(userId, state);
    if (!redisReady) return;

    try {
      if (state.dirty) {
        await redis.set(redisKey(userId), JSON.stringify(state));
        await redis.sadd("wealthia:tap:dirty", userId);
      } else {
        await redis.set(redisKey(userId), JSON.stringify(state), "EX", TAP_CACHE_TTL_SEC);
      }
    } catch (error) {
      console.warn("TAP_CACHE_WRITE_FAILED:", userId, error.message);
    }
  }

  async function withUserLock(userId, task) {
    const key = String(userId);
    const previous = locks.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
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

  function hydrate(userId, dbRow) {
    const state = {
      row: cloneRow(dbRow),
      dirty: false,
      rateWindowStart: number(dbRow.tap_window_start),
      rateWindowCount: number(dbRow.tap_window_count),
      tapViolations: number(dbRow.tap_violations),
      pendingTournamentTaps: 0,
      lastActivity: Date.now()
    };
    memory.set(userId, state);
    void writeState(userId, state);
    return state;
  }

  async function ensureHydrated(userId, loadRow) {
    const existing = await readState(userId);
    if (existing) return existing;

    const row = await loadRow();
    return hydrate(userId, row);
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
    const row = state.row;
    const endless = helpers.hasEndlessEnergy(row);
    const tapCost = helpers.economy.tapValue(row);
    const amount = helpers.tapPower(row);

    const energySnapshot = {
      energy: row.energy,
      max_energy: row.max_energy,
      energy_regen_rate: row.energy_regen_rate,
      last_energy_updated_at: row.last_energy_updated_at
    };
    helpers.economy.applyEnergyRegen(row, { nowMs: now });

    let applied = count;
    if (!endless) {
      const maxByEnergy = Math.floor(number(row.energy) / tapCost);
      if (maxByEnergy <= 0) {
        state.dirty = true;
        state.lastActivity = now;
        await writeState(userId, state);
        return { ok: false, error: "NO_ENERGY" };
      }
      applied = Math.min(count, maxByEnergy);
    }

    const rate = checkRate(state, applied, now);
    if (!rate.allowed) {
      Object.assign(row, energySnapshot);
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
    if (!endless && totalEnergyCost > 0) {
      helpers.economy.touchEnergyTimestamp(row, now);
    }
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
      taps: number(state.row.taps),
      daily_contest_score: number(contest.daily_contest_score),
      contest_date: contest.contest_date,
      contest_baseline_city: number(contest.contest_baseline_city),
      city_value: number(state.row.city_value),
      tap_window_start: number(state.row.tap_window_start),
      tap_window_count: number(state.row.tap_window_count),
      tap_violations: number(state.row.tap_violations),
      energy_regen_rate: helpers.economy.energyRegenRate(state.row),
      last_energy_updated_at: number(state.row.last_energy_updated_at),
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

    await writeState(userId, state);

    if (redisReady) {
      await redis.srem("wealthia:tap:dirty", String(userId));
    }

    if (tournamentTaps > 0 && typeof helpers.incrementTournamentScore === "function") {
      await helpers.incrementTournamentScore(userId, tournamentTaps);
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
      hydrate(userId, row);
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
      hydrate(userId, fallbackRow);
      return cloneRow(fallbackRow);
    }
    return null;
  }

  return {
    initRedis,
    hydrate,
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
