const BUILDING_BASES = {
  shop: 15,
  bank: 70,
  factory: 45,
  casino: 60
};

const BUILDING_GROWTH = 1.15;
const UPGRADE_BASES = { shop: 50, bank: 120, factory: 200, casino: 300 };
const UPGRADE_GROWTH = 1.75;
const OFFLINE_CAP_SECONDS = 4 * 60 * 60;
const DEFAULT_MAX_ENERGY = 1000;
const TICKETS_PER_SCORE = 1000;
const AUTO_BUY_MIN_BANK_LEVEL = 7;
const AUTO_BUY_BUDGET_RATIO = 0.2;
const BUILDING_KEYS = ["shop", "bank", "factory", "casino"];

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

function scoreProgressToNextTicket(dailyScore) {
  const score = number(dailyScore);
  const current = score % TICKETS_PER_SCORE;

  return {
    current,
    target: TICKETS_PER_SCORE,
    percent: Math.min(100, Math.round((current / TICKETS_PER_SCORE) * 100))
  };
}

function upgradeCost(building, level) {
  const base = UPGRADE_BASES[building] || 50;
  return Math.floor(base * Math.pow(UPGRADE_GROWTH, Math.max(0, number(level) - 1)));
}

function nextUpgradeCost(row, building) {
  const level = number(row[`${building}_level`]);
  const costLevel = building === "shop" ? level : level + 1;
  return upgradeCost(building, costLevel);
}

function cheapestUpgrade(row) {
  let cheapest = null;

  for (const building of BUILDING_KEYS) {
    const cost = nextUpgradeCost(row, building);
    if (!cheapest || cost < cheapest.cost) {
      cheapest = { building, cost };
    }
  }

  return cheapest;
}

function applyAutoBuy(row, offlineEarnings) {
  const upgrades = [];
  const gross = Math.floor(number(offlineEarnings));

  if (gross <= 0 || number(row.bank_level) < AUTO_BUY_MIN_BANK_LEVEL) {
    row.coins = number(row.coins) + gross;
    return {
      upgrades,
      coinsAdded: gross,
      autoBuyBudget: 0,
      autoBuySpent: 0
    };
  }

  let budget = Math.floor(gross * AUTO_BUY_BUDGET_RATIO);
  let coinsAdded = gross - budget;
  let autoBuySpent = 0;

  while (budget > 0) {
    const option = cheapestUpgrade(row);
    if (!option || budget < option.cost) break;

    const column = `${option.building}_level`;
    const nextLevel = number(row[column]) + 1;

    budget -= option.cost;
    autoBuySpent += option.cost;
    row[column] = nextLevel;
    row.spent = number(row.spent) + option.cost;
    upgrades.push({
      building: option.building,
      level: nextLevel,
      cost: option.cost
    });
  }

  coinsAdded += budget;
  row.coins = number(row.coins) + coinsAdded;

  return {
    upgrades,
    coinsAdded,
    autoBuyBudget: Math.floor(gross * AUTO_BUY_BUDGET_RATIO),
    autoBuySpent
  };
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

  const autoBuy = applyAutoBuy(row, offlineEarnings);

  row.energy = Math.min(energyCap, number(row.energy) + energyGain);
  row.max_energy = energyCap;
  row.last_seen_at = new Date(current).toISOString();
  row.__offlineEarnings = offlineEarnings;
  row.__offlineCashAdded = autoBuy.coinsAdded;
  row.__energyRecovered = energyGain;
  row.__autoUpgrades = autoBuy.upgrades;

  return {
    row,
    offlineEarnings,
    offlineCashAdded: autoBuy.coinsAdded,
    autoUpgrades: autoBuy.upgrades,
    energyGain,
    elapsedSeconds: cappedSeconds
  };
}

module.exports = {
  AUTO_BUY_MIN_BANK_LEVEL,
  BUILDING_BASES,
  BUILDING_GROWTH,
  DEFAULT_MAX_ENERGY,
  OFFLINE_CAP_SECONDS,
  TICKETS_PER_SCORE,
  applyAutoBuy,
  applyOfflineProgress,
  buildingHourlyProfit,
  computeTickets,
  factoryEnergyRegenPerSecond,
  maxEnergy,
  nextUpgradeCost,
  scoreProgressToNextTicket,
  tapValue,
  totalHourlyProfit,
  upgradeCost
};
