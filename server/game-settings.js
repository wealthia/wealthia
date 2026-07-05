const DEFAULT_SETTINGS = {
  premium_spin_stars: 30,
  cash_10_interval: 150,
  cash_5_interval: 70,
  cash_2_interval: 30
};

let cachedSettings = { ...DEFAULT_SETTINGS };
let cacheLoadedAt = 0;
const CACHE_MS = 5000;

function number(value) {
  return Number(value || 0);
}

function normalizeSettings(row = {}) {
  return {
    premium_spin_stars: Math.max(1, Math.min(10000, number(row.premium_spin_stars) || DEFAULT_SETTINGS.premium_spin_stars)),
    cash_10_interval: Math.max(1, Math.min(100000, number(row.cash_10_interval) || DEFAULT_SETTINGS.cash_10_interval)),
    cash_5_interval: Math.max(1, Math.min(100000, number(row.cash_5_interval) || DEFAULT_SETTINGS.cash_5_interval)),
    cash_2_interval: Math.max(1, Math.min(100000, number(row.cash_2_interval) || DEFAULT_SETTINGS.cash_2_interval)),
    updated_at: row.updated_at || null
  };
}

function getSettingsSync() {
  return { ...cachedSettings };
}

async function loadSettings(supabase, { force = false } = {}) {
  const now = Date.now();
  if (!force && cacheLoadedAt && now - cacheLoadedAt < CACHE_MS) {
    return getSettingsSync();
  }

  try {
    const { data, error } = await supabase
      .from("game_settings")
      .select("premium_spin_stars, cash_10_interval, cash_5_interval, cash_2_interval, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error && error.code !== "PGRST205") {
      console.warn("GAME_SETTINGS_LOAD_FAILED:", error.message);
      return getSettingsSync();
    }

    cachedSettings = normalizeSettings(data || DEFAULT_SETTINGS);
    cacheLoadedAt = now;
    return getSettingsSync();
  } catch (error) {
    console.warn("GAME_SETTINGS_LOAD_EXCEPTION:", error.message);
    return getSettingsSync();
  }
}

async function saveSettings(supabase, input = {}) {
  const next = normalizeSettings({
    premium_spin_stars: input.premium_spin_stars ?? cachedSettings.premium_spin_stars,
    cash_10_interval: input.cash_10_interval ?? cachedSettings.cash_10_interval,
    cash_5_interval: input.cash_5_interval ?? cachedSettings.cash_5_interval,
    cash_2_interval: input.cash_2_interval ?? cachedSettings.cash_2_interval,
    updated_at: new Date().toISOString()
  });

  const { data, error } = await supabase
    .from("game_settings")
    .upsert({
      id: 1,
      ...next,
      updated_at: new Date().toISOString()
    })
    .select("premium_spin_stars, cash_10_interval, cash_5_interval, cash_2_interval, updated_at")
    .single();

  if (error) throw error;

  cachedSettings = normalizeSettings(data);
  cacheLoadedAt = Date.now();
  return getSettingsSync();
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettingsSync,
  loadSettings,
  saveSettings,
  normalizeSettings
};
