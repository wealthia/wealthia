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

function renderDailyTasks() {
  const panel = document.getElementById("tasksPanel");
  const tasks = Array.isArray(state.dailyTasks) ? state.dailyTasks : [];

  if (!panel) return;

  if (tasks.length === 0) {
    panel.innerHTML = `
      <div class="item">
        <div>
          <strong>🎁 Daily tasks preparing</strong>
          <p>Tasks will appear soon.</p>
        </div>
      </div>
    `;
    return;
  }

tasks.map((task) => {
  const claimed = Boolean(task.claimed);
  const ready = !claimed && (task.ready || Number(task.progress || 0) >= Number(task.target || 1));
  const buttonText = claimed ? "Claimed" : ready ? `+${task.reward}` : `${task.progress || 0}/${task.target || 1}`;
return `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding:16px;border:1px solid #304457;border-radius:10px;background:#16212a;">
    <div style="display:flex;align-items:center;gap:10px;min-width:0;">
      <span style="font-size:22px;">&#127873;</span>
      <div>
        <div style="font-size:18px;font-weight:900;color:#fff;">${task.title}</div>
        <div style="font-size:14px;font-weight:800;color:#9fb0c2;">
          ${claimed ? "Reward collected" : ready ? "Ready to claim" : "Progress"}
        </div>
      </div>
    </div>

    <button data-task-claim="${task.id}" ${claimed || !ready ? "disabled" : ""} style="min-width:96px;height:46px;border:0;border-radius:9px;background:${ready ? "#45c889" : "#202d38"};color:${ready ? "#06120c" : "#9fb0c2"};font-size:16px;font-weight:900;">
      ${buttonText}
    </button>
  </div>
`;
}).join("")
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
  state.dailyDate = user.game.dailyDate || user.game.daily_date || "";
  state.dailyStreak = Number(user.game.dailyStreak || user.game.daily_streak || 0);
  state.dailyTasks = Array.isArray(user.game.dailyTasks) ? user.game.dailyTasks : [];

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

const tasksPanel = document.getElementById("tasks");
if (tasksPanel) {
  tasksPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-daily-task]");
    if (!button) return;

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
/* Hot fix: stats and city icon positions */
.stat strong,
.stat strong span,
#energy {
  display: inline !important;
  margin: 0 !important;
  font-size: 28px !important;
  line-height: 1 !important;
  color: #fff !important;
  font-weight: 900 !important;
  text-shadow: 0 3px 0 #2d4b9a !important;
}

.city-icon {
  bottom: 58px !important;
}

.shop-icon {
  left: 28px !important;
  right: auto !important;
}

.bank-icon {
  left: 150px !important;
  right: auto !important;
}

.tower-icon,
.factory-icon,
.office-icon {
  left: auto !important;
  right: 32px !important;
}

@media (max-width: 380px) {
  .stat strong,
  .stat strong span,
  #energy {
    font-size: 23px !important;
  }

  .shop-icon {
    left: 22px !important;
  }

  .bank-icon {
    left: 122px !important;
  }

  .tower-icon,
  .factory-icon,
  .office-icon {
    right: 22px !important;
  }
}
