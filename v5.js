const API_URL = "https://wealthia-backend.onrender.com";
let backendUserId = "web_demo";
let backendReady = false;

const storageKey = "wealthiaV5State";

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
    channel: false
  },
  boosts: {
    tapUntil: 0,
    incomeUntil: 0
  },
  buildings: {
    shop: 1,
    bank: 0,
    factory: 0
  }
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
  factoryBuilding: document.getElementById("factoryBuilding")
};

connectBackend();
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
        ...(parsed.tasks || {})
      },
      boosts: {
        ...structuredClone(defaultState).boosts,
        ...(parsed.boosts || {})
      },
      buildings: {
        ...structuredClone(defaultState).buildings,
        ...(parsed.buildings || {})
      }
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
  return Math.floor(Number(number || 0)).toLocaleString("en-US");
}

function tapPower() {
  return state.buildings.shop;
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

function render() {
  els.coins.textContent = format(state.coins);
  els.energy.textContent = Math.floor(state.energy);
  els.cityValue.textContent = format(cityValue());
  els.energyBar.style.width = `${Math.max(0, Math.min(100, state.energy))}%`;
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

  els.dailyText.textContent = `Daily reward - Day ${Math.min(state.dailyStreak + 1, 7)}`;
  els.dailyAmount.textContent = `+${format(dailyRewardAmount())}`;

  setDisabled("dailyReward", state.dailyDate === today());
  setDisabled("tapTask", state.tasks.tap100 || state.taps < 100);
  setDisabled("earnTask", state.tasks.earn500 || cityValue() < 500);
  setDisabled("shopTask", state.tasks.shopUpgrade || state.buildings.shop < 2);
  setDisabled("bankTask", state.tasks.bankOpen || state.buildings.bank < 1);

  setDisabled("sponsorTask", state.tasks.sponsor);
  setDisabled("adTask", state.tasks.ad);
  setDisabled("channelTask", state.tasks.channel);

  markTask("tapTask", state.tasks.tap100);
  markTask("earnTask", state.tasks.earn500);
  markTask("shopTask", state.tasks.shopUpgrade);
  markTask("bankTask", state.tasks.bankOpen);
  markTask("sponsorTask", state.tasks.sponsor);
  markTask("adTask", state.tasks.ad);
  markTask("channelTask", state.tasks.channel);

  updateCityVisuals();
}

function setDisabled(id, disabled) {
  const item = document.getElementById(id);
  if (item) item.disabled = disabled;
}

function markTask(id, completed) {
  const item = document.getElementById(id);
  if (item) item.classList.toggle("completed", completed);
}

function updateCityVisuals() {
  if (!els.shopBuilding || !els.bankBuilding || !els.factoryBuilding) return;

  els.shopBuilding.style.height = `${78 + Math.min(state.buildings.shop - 1, 8) * 8}px`;
  els.bankBuilding.style.height = `${80 + Math.min(state.buildings.bank, 8) * 10}px`;
  els.factoryBuilding.style.height = `${82 + Math.min(state.buildings.factory, 8) * 8}px`;

  els.shopBuilding.classList.toggle("upgraded", state.buildings.shop > 1);
  els.bankBuilding.classList.toggle("upgraded", state.buildings.bank > 0);
  els.factoryBuilding.classList.toggle("upgraded", state.buildings.factory > 0);
}

function showToast(message) {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
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

function syncFromBackend(user) {
  if (!user || !user.game) return;

  state.coins = Number(user.game.coins || 0);
  state.energy = Number(user.game.energy || 0);
  state.taps = Number(user.game.taps || 0);
  state.spent = Number(user.game.spent || 0);
  state.dailyDate = user.game.dailyDate || "";
  state.dailyStreak = Number(user.game.dailyStreak || 0);

  if (user.game.tasks) {
    state.tasks = {
      ...state.tasks,
      ...user.game.tasks
    };
  }

  if (user.game.buildings) {
    state.buildings = {
      shop: Number(user.game.buildings.shop || 1),
      bank: Number(user.game.buildings.bank || 0),
      factory: Number(user.game.buildings.factory || 0)
    };
  }
}

function getTelegramUser() {
  const tg = window.Telegram && window.Telegram.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;

  if (user && user.id) {
    return {
      id: user.id,
      first_name: user.first_name || "Player",
      username: user.username || ""
    };
  }

  return {
    id: "web_demo",
    first_name: "Web Demo",
    username: ""
  };
}

async function connectBackend() {
  try {
    const response = await fetch(`${API_URL}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramUser: getTelegramUser() })
    });

    const user = await response.json();

    if (!response.ok) throw new Error("Session failed");

    backendUserId = user.userId;
    syncFromBackend(user);

    backendReady = true;
    saveState();
    render();
    showToast("Backend connected.");
  } catch {
    backendReady = false;
    showToast("Backend offline.");
  }
}

async function backendTap(event) {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  if (event.cancelable) event.preventDefault();

  try {
    const response = await fetch(`${API_URL}/api/tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: backendUserId })
    });

    const result = await response.json();

    if (!response.ok) {
      showToast("No energy.");
      return;
    }

    syncFromBackend(result.user);
    saveState();
    render();

    coinPop(
      event.clientX || window.innerWidth / 2,
      event.clientY || window.innerHeight / 2,
      result.amount
    );
  } catch {
    showToast("Backend error.");
  }
}

async function backendUpgrade(name) {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: backendUserId,
        building: name
      })
    });

    const result = await response.json();

    if (!response.ok) {
      showToast("Not enough Wealth Coin.");
      return;
    }

    syncFromBackend(result.user);
    saveState();
    render();
    showToast(`${name[0].toUpperCase() + name.slice(1)} upgraded.`);
  } catch {
    showToast("Upgrade error.");
  }
}

async function claimBackendTask(task) {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/claim-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: backendUserId,
        task
      })
    });

    const result = await response.json();

    if (!response.ok) {
      showToast("Task locked or already claimed.");
      return;
    }

    syncFromBackend(result.user);
    saveState();
    render();
    showToast(`Reward claimed: +${format(result.reward)}`);
  } catch {
    showToast("Task error.");
  }
}

async function refreshBackendState() {
  if (!backendReady) return;

  try {
    const response = await fetch(`${API_URL}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramUser: getTelegramUser() })
    });

    const user = await response.json();
    if (!response.ok) return;

    syncFromBackend(user);
    saveState();
    render();
  } catch {
    // silent refresh fail
  }
}

els.tapButton.addEventListener("pointerdown", backendTap);

document.querySelectorAll("[data-upgrade]").forEach((button) => {
  button.addEventListener("click", () => {
    backendUpgrade(button.dataset.upgrade);
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
  claimBackendTask("daily");
});

document.getElementById("tapTask").addEventListener("click", () => {
  claimBackendTask("tap100");
});

document.getElementById("earnTask").addEventListener("click", () => {
  claimBackendTask("earn500");
});

document.getElementById("shopTask").addEventListener("click", () => {
  claimBackendTask("shopUpgrade");
});

document.getElementById("bankTask").addEventListener("click", () => {
  claimBackendTask("bankOpen");
});

document.getElementById("sponsorTask").addEventListener("click", () => {
  showToast("Sponsor tasks will connect next.");
});

document.getElementById("adTask").addEventListener("click", () => {
  showToast("Ads will connect next.");
});

document.getElementById("channelTask").addEventListener("click", () => {
  showToast("Channels will connect next.");
});

document.getElementById("fullEnergyBoost").addEventListener("click", () => {
  showToast("Boosts will connect next.");
});

document.getElementById("tapBoost").addEventListener("click", () => {
  showToast("Boosts will connect next.");
});

document.getElementById("incomeBoost").addEventListener("click", () => {
  showToast("Boosts will connect next.");
});

document.getElementById("inviteButton").addEventListener("click", async () => {
  const link = `https://t.me/WealthiaGameBot?start=ref_${backendUserId}`;

  try {
    await navigator.clipboard.writeText(link);
    showToast("Invite link copied.");
  } catch {
    showToast(link);
  }
});

document.getElementById("resetButton").addEventListener("click", () => {
  showToast("Reset disabled on backend version.");
});

window.setInterval(refreshBackendState, 10000);
