const BUILDING_BASES = {
  shop: 15,
  bank: 70,
  factory: 45,
  casino: 60
};

const BUILDING_GROWTH = 1.15;
const OFFLINE_CAP_SECONDS = 4 * 60 * 60;
const DEFAULT_MAX_ENERGY = 1000;
const TICKETS_PER_SCORE = 1000;

function number(value) {
  return Number(value || 0);
}

function buildingHourlyProfit(building, level) {
  const lv = number(level);
  if (lv < 1) return 0;
  const base = BUILDING_BASES[building] || 0;
  return base * Math.pow(BUILDING_GROWTH, lv - 1);
}

function totalHourlyProfit(row, incomeMultiplier = 1) {
  const mult = number(incomeMultiplier) || 1;
  return (
    buildingHourlyProfit("shop", row.shop_level) +
    buildingHourlyProfit("bank", row.bank_level) +
    buildingHourlyProfit("factory", row.factory_level) +
    buildingHourlyProfit("casino", row.casino_level)
  ) * mult;
}

function factoryEnergyRegenPerSecond(level) {
  return number(level) * 0.5;
}

function maxEnergy(row) {
  const stored = number(row.max_energy);
  return stored > 0 ? stored : DEFAULT_MAX_ENERGY;
}

function tapValue(row) {
  return Math.max(1, number(row.shop_level));
}

function computeTickets(dailyScore) {
  return Math.floor(number(dailyScore) / TICKETS_PER_SCORE);
}

function applyOfflineProgress(row, options = {}) {
  const current = options.nowMs || Date.now();
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : current;
  const elapsedSeconds = Math.max(0, (current - lastSeen) / 1000);
  const cappedSeconds = Math.min(elapsedSeconds, OFFLINE_CAP_SECONDS);
  const incomeMult = number(options.incomeMultiplier) || 1;
  const hourlyProfit = totalHourlyProfit(row, incomeMult);
  const offlineEarnings = cappedSeconds > 0
    ? Math.floor((hourlyProfit / 3600) * cappedSeconds)
    : 0;
  const energyCap = maxEnergy(row);
  const energyGain = cappedSeconds > 0
    ? Math.floor(factoryEnergyRegenPerSecond(row.factory_level) * cappedSeconds)
    : 0;

  row.coins = number(row.coins) + offlineEarnings;
  row.energy = Math.min(energyCap, number(row.energy) + energyGain);
  row.max_energy = energyCap;
  row.last_seen_at = new Date(current).toISOString();
  row.__offlineEarnings = offlineEarnings;
  row.__energyRecovered = energyGain;

  return {
    row,
    offlineEarnings,
    energyGain,
    elapsedSeconds: cappedSeconds
  };
}

module.exports = {
  BUILDING_BASES,
  BUILDING_GROWTH,
  DEFAULT_MAX_ENERGY,
  OFFLINE_CAP_SECONDS,
  TICKETS_PER_SCORE,
  applyOfflineProgress,
  buildingHourlyProfit,
  computeTickets,
  factoryEnergyRegenPerSecond,
  maxEnergy,
  tapValue,
  totalHourlyProfit
};
