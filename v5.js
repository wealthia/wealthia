const API_URL = "http://localhost:3000";
let backendUserId = "123";
let backendReady = false;

const storageKey = "wealthiaMvpState";

const defaultState = {
  coins: 0,
  energy: 100,
  taps: 0,
  spent: 0,
  lastSeen: Date.now(),
  dailyDate: "",
  dailyStreak: 0,
  tasks: {
    tap100: false,
    earn500: false,
    shopUpgrade: false,
    bankOpen: false,
    invite: false,
    sponsor: false,
    ad: false,
    channel: false,
  },
  boosts: {
    tapUntil: 0,
    incomeUntil: 0,
  },
  buildings: {
    shop: 1,
    bank: 0,
    factory: 0,
  },
};

let state = loadState();

const els = {
  coins: document.getElementById("coins"),
  energy: document.getElementById("energy"),
  cityValue: document.getElementById("cityValue"),
  energyBar: document.getElementById("energyBar"),
  tapPower: document.getElementById("tapPower"),
tapLabel: document.getElementById("tapLabel"),
tapButton: document.getElementById("tapButton"),
  shopLevel: document.getElementById("shopLevel"),
  bankLevel: document.getElementById("bankLevel"),
  factoryLevel: document.getElementById("factoryLevel"),
  shopCost: document.getElementById("shopCost"),
  bankCost: document.getElementById("bankCost"),
  factoryCost: document.getElementById("factoryCost"),
  rankYou: document.getElementById("rankYou"),
  toast: document.getElementById("toast"),
  dailyText: document.getElementById("dailyText"),
  dailyAmount: document.getElementById("dailyAmount"),
  shopBuilding: document.getElementById("shopBuilding"),
  bankBuilding: document.getElementById("bankBuilding"),
  factoryBuilding: document.getElementById("factoryBuilding"),
};

applyOfflineIncome();
render();

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);

  try {
    const parsed = JSON.parse(saved);

    return {
      ...structuredClone(defaultState),
      ...parsed,
      tasks: {
        ...structuredClone(defaultState).tasks,
        ...(parsed.tasks || {}),
      },
      boosts: {
        ...structuredClone(defaultState).boosts,
        ...(parsed.boosts || {}),
      },
      buildings: {
        ...structuredClone(defaultState).buildings,
        ...(parsed.buildings || {}),
      },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  state.lastSeen = Date.now();
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function format(number) {
  return Math.floor(number).toLocaleString("en-US");
}

function isTapBoostActive() {
  return Date.now() < state.boosts.tapUntil;
}

function isIncomeBoostActive() {
  return Date.now() < state.boosts.incomeUntil;
}

function tapPower() {
  return state.buildings.shop * (isTapBoostActive() ? 2 : 1);
}

function hourlyIncome() {
  const baseIncome = state.buildings.bank * 20 * Math.max(1, state.buildings.bank);
  return baseIncome * (isIncomeBoostActive() ? 2 : 1);
}

function energyRecovery() {
  return 1 + state.buildings.factory;
}

function cityValue() {
  return state.coins + state.spent;
}

function dailyRewardAmount() {
  const rewards = [100, 150, 250, 400, 700, 1000, 1500];
  return rewards[Math.min(state.dailyStreak, rewards.length - 1)];
}

function upgradeCost(name) {
  const base = { shop: 50, bank: 120, factory: 200 }[name];
  const level = state.buildings[name];
  return Math.floor(base * Math.pow(1.75, Math.max(0, level - 1)));
}

function applyOfflineIncome() {
  const now = Date.now();
  const secondsAway = Math.max(0, Math.floor((now - state.lastSeen) / 1000));
  const cappedSeconds = Math.min(secondsAway, 8 * 60 * 60);
  const earned = Math.floor((hourlyIncome() / 3600) * cappedSeconds);

  if (earned > 0) {
    state.coins += earned;
    showToast(`Offline income: +${format(earned)} Wealth Coin`);
  }

  state.lastSeen = now;
  saveState();
}

function render() {
  els.coins.textContent = format(state.coins);
  els.energy.textContent = Math.floor(state.energy);
  els.cityValue.textContent = format(cityValue());
  els.energyBar.style.width = `${state.energy}%`;
  els.energyBar.style.background = state.energy < 20 ? "var(--red)" : "var(--green)";
  els.tapPower.textContent = tapPower();
  els.tapLabel.textContent = state.energy < 1 ? "No Energy" : "Tap";
els.tapButton.classList.toggle("no-energy", state.energy < 1);

  els.shopLevel.textContent = state.buildings.shop;
  els.bankLevel.textContent = state.buildings.bank;
  els.factoryLevel.textContent = state.buildings.factory;

  els.shopCost.textContent = format(upgradeCost("shop"));
  els.bankCost.textContent = format(upgradeCost("bank"));
  els.factoryCost.textContent = format(upgradeCost("factory"));
  els.rankYou.textContent = format(cityValue());

  els.dailyText.textContent = `Daily reward · Day ${Math.min(state.dailyStreak + 1, 7)}`;
  els.dailyAmount.textContent = `+${format(dailyRewardAmount())}`;

  document.getElementById("dailyReward").disabled = state.dailyDate === today();
  document.getElementById("tapTask").disabled = state.tasks.tap100 || state.taps < 100;
  document.getElementById("earnTask").disabled = state.tasks.earn500 || cityValue() < 500;
  document.getElementById("shopTask").disabled = state.tasks.shopUpgrade || state.buildings.shop < 2;
  document.getElementById("bankTask").disabled = state.tasks.bankOpen || state.buildings.bank < 1;

  document.getElementById("sponsorTask").disabled = state.tasks.sponsor;
  document.getElementById("adTask").disabled = state.tasks.ad;
  document.getElementById("channelTask").disabled = state.tasks.channel;

  markTask("tapTask", state.tasks.tap100);
  markTask("earnTask", state.tasks.earn500);
  markTask("shopTask", state.tasks.shopUpgrade);
  markTask("bankTask", state.tasks.bankOpen);
  markTask("sponsorTask", state.tasks.sponsor);
  markTask("adTask", state.tasks.ad);
  markTask("channelTask", state.tasks.channel);

  updateCityVisuals();
}

function markTask(id, completed) {
  const task = document.getElementById(id);
  if (task) task.classList.toggle("completed", completed);
}

function updateCityVisuals() {
  els.shopBuilding.style.height = `${78 + Math.min(state.buildings.shop - 1, 8) * 8}px`;
  els.bankBuilding.style.height = `${80 + Math.min(state.buildings.bank, 8) * 10}px`;
  els.factoryBuilding.style.height = `${82 + Math.min(state.buildings.factory, 8) * 8}px`;

  els.shopBuilding.classList.toggle("upgraded", state.buildings.shop > 1);
  els.bankBuilding.classList.toggle("upgraded", state.buildings.bank > 0);
  els.factoryBuilding.classList.toggle("upgraded", state.buildings.factory > 0);
  els.factoryBuilding.classList.toggle("active-smoke", state.buildings.factory > 0);
}

function addCoins(amount) {
  state.coins += amount;
  saveState();
  render();
}

function spendCoins(amount) {
  state.coins -= amount;
  state.spent += amount;
  saveState();
  render();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function coinPop(x, y, amount) {
  const pop = document.createElement("div");
  pop.className = "coin-pop";
  pop.textContent = `+${amount}`;
  pop.style.left = `${x - 14}px`;
  pop.style.top = `${y - 18}px`;
  document.body.appendChild(pop);
  window.setTimeout(() => pop.remove(), 720);
}

function handleTap(event) {
  if (event.cancelable) {
    event.preventDefault();
  }

  if (state.energy < 1) {
    showToast("Energy is empty. Wait a little.");
    return;
  }

  const amount = tapPower();

  state.energy = Math.max(0, state.energy - 1);
  state.taps += 1;

  addCoins(amount);
  coinPop(event.clientX || window.innerWidth / 2, event.clientY || window.innerHeight / 2, amount);
}

els.tapButton.addEventListener("pointerdown", handleTap);

document.querySelectorAll("[data-upgrade]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.upgrade;
    const cost = upgradeCost(name);

    if (state.coins < cost) {
      showToast("Not enough Wealth Coin.");
      return;
    }

    spendCoins(cost);
    state.buildings[name] += 1;
    saveState();
    render();

    showToast(`${name[0].toUpperCase() + name.slice(1)} upgraded.`);
  });
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));

    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

document.getElementById("dailyReward").addEventListener("click", () => {
  if (state.dailyDate === today()) return;

  const amount = dailyRewardAmount();
  state.dailyDate = today();
  state.dailyStreak = Math.min(state.dailyStreak + 1, 7);

  addCoins(amount);
  showToast("Daily reward claimed.");
});

document.getElementById("tapTask").addEventListener("click", () => {
  if (state.tasks.tap100 || state.taps < 100) return;

  state.tasks.tap100 = true;
  addCoins(150);
  showToast("Task completed.");
});

document.getElementById("earnTask").addEventListener("click", () => {
  if (state.tasks.earn500 || cityValue() < 500) return;

  state.tasks.earn500 = true;
  addCoins(250);
  showToast("Task completed.");
});

document.getElementById("shopTask").addEventListener("click", () => {
  if (state.tasks.shopUpgrade || state.buildings.shop < 2) return;

  state.tasks.shopUpgrade = true;
  addCoins(200);
  showToast("Task completed.");
});

document.getElementById("bankTask").addEventListener("click", () => {
  if (state.tasks.bankOpen || state.buildings.bank < 1) return;

  state.tasks.bankOpen = true;
  addCoins(200);
  showToast("Task completed.");
});

document.getElementById("sponsorTask").addEventListener("click", () => {
  if (state.tasks.sponsor) return;

  state.tasks.sponsor = true;
  addCoins(750);
  showToast("Sponsor task completed.");
});

document.getElementById("adTask").addEventListener("click", () => {
  if (state.tasks.ad) return;

  state.tasks.ad = true;
  addCoins(300);
  showToast("Rewarded ad completed.");
});

document.getElementById("channelTask").addEventListener("click", () => {
  if (state.tasks.channel) return;

  state.tasks.channel = true;
  addCoins(500);
  showToast("Partner channel reward claimed.");
});

document.getElementById("fullEnergyBoost").addEventListener("click", () => {
  if (state.coins < 100) {
    showToast("Not enough Wealth Coin.");
    return;
  }

  spendCoins(100);
  state.energy = 100;
  saveState();
  render();
  showToast("Energy filled.");
});

document.getElementById("tapBoost").addEventListener("click", () => {
  if (state.coins < 150) {
    showToast("Not enough Wealth Coin.");
    return;
  }

  spendCoins(150);
  state.boosts.tapUntil = Date.now() + 60 * 1000;
  saveState();
  render();
  showToast("2x Tap active for 60 seconds.");
});

document.getElementById("incomeBoost").addEventListener("click", () => {
  if (state.coins < 200) {
    showToast("Not enough Wealth Coin.");
    return;
  }

  spendCoins(200);
  state.boosts.incomeUntil = Date.now() + 60 * 1000;
  saveState();
  render();
  showToast("2x Income active for 60 seconds.");
});

document.getElementById("inviteButton").addEventListener("click", async () => {
  const link = "https://t.me/wealthia_bot?start=ref_demo";

  try {
    await navigator.clipboard.writeText(link);
  } catch {
    showToast(link);
    return;
  }

  if (!state.tasks.invite) {
    state.tasks.invite = true;
    addCoins(500);
  }

  showToast("Invite link copied.");
});

document.getElementById("resetButton").addEventListener("click", () => {
  if (!confirm("Reset Wealthia preview?")) return;

  state = structuredClone(defaultState);
  saveState();
  render();
  showToast("Preview reset.");
});

window.setInterval(() => {
  state.energy = Math.min(100, state.energy + energyRecovery());
  state.coins += hourlyIncome() / 3600;

  saveState();
  render();
}, 1000);
