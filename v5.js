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
  dailyTasks: [],
  dailyTasksNextRefresh: "",
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
      dailyTasks: Array.isArray(parsed.dailyTasks) ? parsed.dailyTasks : [],
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

function format(number) {
  return Math.floor(Number(number || 0)).toLocaleString("en-US");
}

function tapPower() {
  return Math.max(1, Number(state.buildings.shop || 1));
}

function cityValue() {
  return Number(state.coins || 0) + Number(state.spent || 0);
}

function upgradeCost(name) {
  const base = { shop: 50, bank: 120, factory: 200 }[name];
  const level = Number(state.buildings[name] || 0);
  return Math.floor(base * Math.pow(1.75, Math.max(0, level - 1)));
}

function render() {
  if (els.coins) els.coins.textContent = format(state.coins);
  if (els.energy) els.energy.textContent = Math.floor(state.energy);
  if (els.cityValue) els.cityValue.textContent = format(cityValue());

  if (els.energyBar) {
    els.energyBar.style.width = `${Math.max(0, Math.min(100, state.energy))}%`;
    els.energyBar.style.background = state.energy < 20 ? "var(--red)" : "var(--green)";
  }

  if (els.tapPower) els.tapPower.textContent = tapPower();
  if (els.tapLabel) els.tapLabel.textContent = state.energy < 1 ? "No Energy" : "Tap";
  if (els.tapButton) els.tapButton.classList.toggle("no-energy", state.energy < 1);

  if (els.shopLevel) els.shopLevel.textContent = state.buildings.shop;
  if (els.bankLevel) els.bankLevel.textContent = state.buildings.bank;
  if (els.factoryLevel) els.factoryLevel.textContent = state.buildings.factory;

  if (els.shopCost) els.shopCost.textContent = format(upgradeCost("shop"));
  if (els.bankCost) els.bankCost.textContent = format(upgradeCost("bank"));
  if (els.factoryCost) els.factoryCost.textContent = format(upgradeCost("factory"));
  if (els.rankYou) els.rankYou.textContent = format(cityValue());

  renderDailyTasks();
  updateCityVisuals();
}

function getTaskRefreshLabel() {
  const next = Date.parse(state.dailyTasksNextRefresh || "");
  if (!next || Number.isNaN(next)) {
    return "Tasks refresh every 12 hours based on your level";
  }

  const diff = Math.max(0, next - Date.now());
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (diff <= 0) {
    return "New tasks loading soon...";
  }

  if (hours > 0) {
    return `New level-based tasks in ${hours}h ${minutes}m`;
  }

  return `New level-based tasks in ${minutes}m`;
}

function updateTaskRefreshLabel() {
  const note = document.getElementById("taskRefreshNote");
  if (note) note.textContent = getTaskRefreshLabel();
}

function renderDailyTasks() {
  const panel = document.getElementById("tasksPanel");
  const tasks = Array.isArray(state.dailyTasks) ? state.dailyTasks : [];

  if (!panel) return;

  if (tasks.length === 0) {
    panel.innerHTML = `
      <div class="panel-head">
        <h2>Daily Missions</h2>
        <p id="taskRefreshNote">${getTaskRefreshLabel()}</p>
      </div>
      <button class="task" type="button" disabled>
        <span><b>&#127873; Daily tasks preparing</b><small>Tasks will appear soon.</small></span>
        <strong>Soon</strong>
      </button>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="panel-head">
      <h2>Daily Missions</h2>
      <p id="taskRefreshNote">${getTaskRefreshLabel()}</p>
    </div>
    ${tasks.map((task) => {
    const title = task.title || "Daily Task";
    const reward = format(task.reward || 0);
    const progress = Number(task.progress || 0);
    const target = Number(task.target || 1);
    const claimed = Boolean(task.claimed);
    const ready = !claimed && (task.ready || progress >= target);
    const buttonText = claimed ? "Claimed" : ready ? `+${reward}` : `${format(progress)} / ${format(target)}`;
    const statusText = claimed ? "Reward collected" : ready ? "Ready to claim" : "Progress";

    return `
      <button class="task ${claimed ? "completed" : ""}" type="button" data-daily-task="${task.id || ""}" ${claimed || !ready ? "disabled" : ""}>
        <span><b>&#127873; ${title}</b><small>${statusText}</small></span>
        <strong class="${claimed ? "completed" : ""}">${buttonText}</strong>
      </button>
    `;
  }).join("")}
  `;
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
  pop.className = "coin-pop coin-pop--burst";
  pop.textContent = `+${format(amount)}`;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  document.body.appendChild(pop);

  const ripple = document.createElement("div");
  ripple.className = "tap-ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.appendChild(ripple);

  window.setTimeout(() => {
    pop.remove();
    ripple.remove();
  }, 720);
}

function syncFromBackend(user) {
  if (!user || !user.game) return;

  state.coins = Number(user.game.coins || 0);
  state.energy = Number(user.game.energy || 0);
  state.taps = Number(user.game.taps || 0);
  state.spent = Number(user.game.spent || 0);
  state.dailyDate = user.game.dailyDate || user.game.daily_date || "";
  state.dailyStreak = Number(user.game.dailyStreak || user.game.daily_streak || 0);
  state.dailyTasks = Array.isArray(user.game.dailyTasks) ? user.game.dailyTasks : [];
  state.dailyTasksNextRefresh = user.game.dailyTasksNextRefresh || "";

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

function tapLocal(event) {
  if (state.energy < 1) {
    showToast("No energy.");
    render();
    return false;
  }

  const amount = tapPower();
  state.coins = Number(state.coins || 0) + amount;
  state.taps = Number(state.taps || 0) + 1;
  state.energy = Math.max(0, Number(state.energy || 0) - 1);

  saveState();
  render();

  coinPop(
    event.clientX || window.innerWidth / 2,
    event.clientY || window.innerHeight / 2,
    amount
  );

  return true;
}

async function backendTap(event) {
  if (event.cancelable) event.preventDefault();
  if (!tapLocal(event)) return;

  if (!backendReady) return;

  try {
    const response = await fetch(`${API_URL}/api/tap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: backendUserId })
    });

    const result = await response.json();
    if (!response.ok) return;

    syncFromBackend(result.user);
    saveState();
    render();
  } catch {
    backendReady = false;
  }
}

function upgradeLocal(name) {
  const cost = upgradeCost(name);

  if (state.coins < cost) {
    showToast("Not enough Wealth Coin.");
    return false;
  }

  state.coins -= cost;
  state.spent = Number(state.spent || 0) + cost;
  state.buildings[name] = Number(state.buildings[name] || 0) + 1;

  saveState();
  render();
  showToast(`${name[0].toUpperCase() + name.slice(1)} upgraded.`);
  return true;
}

async function backendUpgrade(name) {
  if (!upgradeLocal(name)) return;
  if (!backendReady) return;

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
    if (!response.ok) return;

    syncFromBackend(result.user);
    saveState();
    render();
  } catch {
    backendReady = false;
  }
}

async function claimBackendTask(taskId) {
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
        task: taskId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.error === "TASK_NOT_READY") showToast("Task is not ready yet.");
      else if (result.error === "TASK_ALREADY_CLAIMED") showToast("Task already claimed.");
      else showToast("Task locked.");
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
    // Silent refresh fail.
  }
}

if (els.tapButton) {
  els.tapButton.addEventListener("pointerdown", backendTap);
}

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

const tasksPanel = document.getElementById("tasksPanel");
if (tasksPanel) {
  tasksPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-daily-task]");
    if (!button || button.disabled) return;

    const taskId = button.dataset.dailyTask;
    if (!taskId) return;

    claimBackendTask(taskId);
  });
}

const sponsorTask = document.getElementById("sponsorTask");
if (sponsorTask) {
  sponsorTask.addEventListener("click", () => {
    showToast("Sponsor task coming soon.");
  });
}

const adTask = document.getElementById("adTask");
if (adTask) {
  adTask.addEventListener("click", () => {
    showToast("Rewarded ads coming soon.");
  });
}

const channelTask = document.getElementById("channelTask");
if (channelTask) {
  channelTask.addEventListener("click", () => {
    showToast("Partner channel coming soon.");
  });
}

const fullEnergyBoost = document.getElementById("fullEnergyBoost");
if (fullEnergyBoost) {
  fullEnergyBoost.addEventListener("click", () => {
    showToast("Boosts coming soon.");
  });
}

const tapBoost = document.getElementById("tapBoost");
if (tapBoost) {
  tapBoost.addEventListener("click", () => {
    showToast("Boosts coming soon.");
  });
}

const incomeBoost = document.getElementById("incomeBoost");
if (incomeBoost) {
  incomeBoost.addEventListener("click", () => {
    showToast("Boosts coming soon.");
  });
}

const inviteButton = document.getElementById("inviteButton");
if (inviteButton) {
  inviteButton.addEventListener("click", async () => {
    const link = `https://t.me/WealthiaGameBot?start=ref_${backendUserId}`;

    try {
      await navigator.clipboard.writeText(link);
      showToast("Invite link copied.");
    } catch {
      showToast(link);
    }
  });
}

const resetButton = document.getElementById("resetButton");
if (resetButton) {
  resetButton.addEventListener("click", () => {
    showToast("Reset disabled on backend version.");
  });
}

window.setInterval(refreshBackendState, 10000);

window.setInterval(() => {
  updateTaskRefreshLabel();

  const next = Date.parse(state.dailyTasksNextRefresh || "");
  if (next && Date.now() >= next) {
    refreshBackendState();
  }
}, 60000);

setInterval(() => {
  if (state.energy >= 100) return;

  state.energy = Math.min(
    100,
    Number(state.energy || 0) + Math.max(1, Number(state.buildings.factory || 0) + 1)
  );

  saveState();
  render();
}, 5000);
