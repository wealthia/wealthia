const API_URL = "https://wealthia-backend.onrender.com";
const storageKey = "wealthiaCleanAppState";

let backendReady = false;
let backendUserId = "web_demo";

const defaultState = {
  coins: 0,
  energy: 100,
  taps: 0,
  spent: 0,
  cityValue: 0,
  dailyTasks: [],
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
  tapValue: document.getElementById("tapValue"),
  energyFill: document.getElementById("energyFill"),
  tapButton: document.getElementById("tapButton"),
  resetButton: document.getElementById("resetButton"),
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  cityPanel: document.getElementById("cityPanel"),
  tasksPanel: document.getElementById("tasksPanel"),
  earnPanel: document.getElementById("earnPanel"),
  friendsPanel: document.getElementById("friendsPanel"),
  rankPanel: document.getElementById("rankPanel"),
  toast: document.getElementById("toast")
};

startApp();

function startApp() {
  setupTelegram();
  setupTabs();
  setupButtons();
  render();
  startEnergyTimer();
  startBackend();
}

function setupTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();

    try {
      tg.setHeaderColor("#0f171f");
      tg.setBackgroundColor("#0b1117");
    } catch (error) {}
  }

  const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;

  if (user && user.id) {
    backendUserId = String(user.id);
  } else {
    backendUserId = "web_demo";
  }
}

function setupTabs() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      els.tabs.forEach((item) => item.classList.remove("active"));
      els.panels.forEach((panel) => panel.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(`${target}Panel`).classList.add("active");

      render();
    });
  });
}

function setupButtons() {
  els.tapButton.addEventListener("click", tap);

  els.resetButton.addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    state = structuredClone(defaultState);
    saveState();
    render();
    showToast("Game reset.");
  });

  els.cityPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-upgrade]");
    if (!button) return;
    upgradeBuilding(button.dataset.upgrade);
  });

  els.earnPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-earn]");
    if (!button) return;
    claimEarn(button.dataset.earn);
  });

  els.friendsPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;

    const link = `https://t.me/WealthiaGameBot?start=${backendUserId}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Invite link copied.");
    } catch (error) {
      showToast(link);
    }
  });

  els.tasksPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-task-id]");
    if (!button) return;
    claimTask(button.dataset.taskId);
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return mergeState(defaultState, saved || {});
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function mergeState(base, incoming) {
  return {
    ...structuredClone(base),
    ...incoming,
    buildings: {
      ...base.buildings,
      ...(incoming.buildings || {})
    },
    dailyTasks: Array.isArray(incoming.dailyTasks) ? incoming.dailyTasks : []
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

async function startBackend() {
  const session = await apiPost("/api/session", { userId: backendUserId });

  if (!session) {
    backendReady = false;
    showToast("Backend offline. Local mode.");
    render();
    return;
  }

  backendReady = true;
  applyServerState(session);
  showToast("Backend connected.");
  render();

  setInterval(refreshSession, 10000);
}

async function refreshSession() {
  const session = await apiPost("/api/session", { userId: backendUserId });
  if (!session) return;

  backendReady = true;
  applyServerState(session);
  render();
}

async function apiPost(path, body) {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn("API error", path, response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn("API offline", path, error);
    return null;
  }
}

function applyServerState(data) {
  const game = data.game || data;

  state = mergeState(state, {
    coins: Number(game.coins ?? state.coins),
    energy: Number(game.energy ?? state.energy),
    taps: Number(game.taps ?? state.taps),
    spent: Number(game.spent ?? state.spent),
    cityValue: Number(game.cityValue ?? game.city_value ?? state.cityValue),
    buildings: game.buildings || {
      shop: Number(game.shop_level ?? state.buildings.shop),
      bank: Number(game.bank_level ?? state.buildings.bank),
      factory: Number(game.factory_level ?? state.buildings.factory)
    },
    dailyTasks: Array.isArray(game.dailyTasks)
      ? game.dailyTasks
      : Array.isArray(game.daily_tasks)
        ? game.daily_tasks
        : state.dailyTasks
  });

  saveState();
}

async function tap(event) {
  if (state.energy <= 0) {
    showToast("Energy is empty.");
    return;
  }

  const income = getTapIncome();

  state.coins += income;
  state.cityValue += income;
  state.taps += 1;
  state.energy = Math.max(0, state.energy - 1);

  saveState();
  render();
  showCoinPop(event, income);

  if (backendReady) {
    const result = await apiPost("/api/tap", { userId: backendUserId });

    if (result) {
      applyServerState(result);
      render();
    }
  }
}

async function upgradeBuilding(type) {
  const cost = getUpgradeCost(type);

  if (state.coins < cost) {
    showToast("Not enough coins.");
    return;
  }

  state.coins -= cost;
  state.spent += cost;
  state.buildings[type] += 1;
  state.cityValue += cost;

  saveState();
  render();
  showToast("Upgrade completed.");

  if (backendReady) {
    const result = await apiPost("/api/upgrade", {
      userId: backendUserId,
      building: type,
      type
    });

    if (result) {
      applyServerState(result);
      render();
    }
  }
}

async function claimTask(taskId) {
  const task = state.dailyTasks.find((item) => item.id === taskId);

  if (!task) {
    showToast("Task not found.");
    return;
  }

  if (task.claimed) {
    showToast("Already claimed.");
    return;
  }

  if (!isTaskReady(task)) {
    showToast("Task is not ready yet.");
    return;
  }

  task.claimed = true;
  state.coins += Number(task.reward || 0);
  state.cityValue += Number(task.reward || 0);

  saveState();
  render();
  showToast(`Reward +${task.reward}`);

  if (backendReady) {
    const result = await apiPost("/api/claim-task", {
      userId: backendUserId,
      taskId
    });

    if (result) {
      applyServerState(result);
      render();
    }
  }
}

function claimEarn(type) {
  const rewards = {
    partnerBot: 750,
    rewardedAd: 300,
    partnerChannel: 500,
    fullEnergy: 0,
    doubleTap: 0,
    doubleIncome: 0
  };

  if (type === "fullEnergy") {
    if (state.coins < 100) {
      showToast("Not enough coins.");
      return;
    }

    state.coins -= 100;
    state.energy = 100;
    showToast("Energy filled.");
  } else if (type === "doubleTap") {
    if (state.coins < 150) {
      showToast("Not enough coins.");
      return;
    }

    state.coins -= 150;
    state.buildings.shop += 1;
    showToast("Tap upgraded.");
  } else if (type === "doubleIncome") {
    if (state.coins < 200) {
      showToast("Not enough coins.");
      return;
    }

    state.coins -= 200;
    state.buildings.bank += 1;
    showToast("Income upgraded.");
  } else {
    const reward = rewards[type] || 0;
    state.coins += reward;
    state.cityValue += reward;
    showToast(`Reward +${reward}`);
  }

  saveState();
  render();
}

function startEnergyTimer() {
  setInterval(() => {
    if (state.energy >= 100) return;

    const recovery = Math.max(1, state.buildings.factory + 1);
    state.energy = Math.min(100, state.energy + recovery);

    saveState();
    render();
  }, 5000);
}

function render() {
  renderTop();
  renderCity();
  renderTasks();
  renderEarn();
  renderFriends();
  renderRank();
}

function renderTop() {
  els.coins.textContent = formatNumber(state.coins);
  els.energy.textContent = `${Math.floor(state.energy)}/100`;
  els.cityValue.textContent = formatNumber(state.cityValue);
  els.tapValue.textContent = getTapIncome();

  const energyPercent = Math.max(0, Math.min(100, state.energy));
  els.energyFill.style.width = `${energyPercent}%`;
}

function renderCity() {
  els.cityPanel.innerHTML = `
    <div class="stack">
      ${renderShopCard("shop", "Shop", "Tap income", state.buildings.shop)}
      ${renderShopCard("bank", "Bank", "Offline income", state.buildings.bank)}
      ${renderShopCard("factory", "Factory", "Energy recovery", state.buildings.factory)}
    </div>
  `;
}

function renderShopCard(type, title, subtitle, level) {
  const cost = getUpgradeCost(type);

  return `
    <article class="card shop-row">
      <div>
        <div class="shop-title">
          <span>${getBuildingIcon(type)}</span>
          <h3>${title}</h3>
        </div>
        <p>${subtitle} • Level ${level}</p>
      </div>
      <button class="buy-button" data-upgrade="${type}">
        Upgrade · ${cost}
      </button>
    </article>
  `;
}

function renderTasks() {
  const tasks = getVisibleTasks();

  if (!tasks.length) {
    els.tasksPanel.innerHTML = `
      <div class="stack">
        <article class="task-item">
          <div class="task-left">
            <span class="task-icon">&#127873;</span>
            <div>
              <div class="task-title">Daily tasks preparing</div>
              <div class="task-status">Tasks will refresh soon.</div>
            </div>
          </div>
        </article>
      </div>
    `;
    return;
  }

  els.tasksPanel.innerHTML = `
    <div class="stack">
      ${tasks.map(renderTask).join("")}
    </div>
  `;
}

function getVisibleTasks() {
  if (Array.isArray(state.dailyTasks) && state.dailyTasks.length) {
    return state.dailyTasks;
  }

  return [
    {
      id: "tap-100",
      title: "Tap 100 times",
      reward: 150,
      progress: state.taps,
      target: 100,
      ready: state.taps >= 100,
      claimed: false
    },
    {
      id: "earn-500",
      title: "Earn 500 coins",
      reward: 250,
      progress: state.coins,
      target: 500,
      ready: state.coins >= 500,
      claimed: false
    },
    {
      id: "upgrade-shop",
      title: "Upgrade Shop",
      reward: 200,
      progress: state.buildings.shop,
      target: 2,
      ready: state.buildings.shop >= 2,
      claimed: false
    },
    {
      id: "open-bank",
      title: "Open Bank",
      reward: 200,
      progress: state.buildings.bank,
      target: 1,
      ready: state.buildings.bank >= 1,
      claimed: false
    }
  ];
}

function renderTask(task) {
  const ready = isTaskReady(task);
  const claimed = Boolean(task.claimed);

  let buttonText = `${task.progress || 0}/${task.target || 1}`;
  let disabled = "disabled";

  if (claimed) {
    buttonText = "Claimed";
  } else if (ready) {
    buttonText = `+${task.reward}`;
    disabled = "";
  }

  return `
    <article class="task-item ${claimed ? "completed" : ""}">
      <div class="task-left">
        <span class="task-icon">&#127873;</span>
        <div>
          <div class="task-title">${escapeHtml(task.title || "Daily task")}</div>
          <div class="task-status">
            ${claimed ? "Reward collected" : ready ? "Ready to claim" : "Progress"}
          </div>
        </div>
      </div>
      <button class="reward-button" data-task-id="${task.id}" ${disabled}>
        ${buttonText}
      </button>
    </article>
  `;
}

function isTaskReady(task) {
  if (task.ready) return true;
  if (task.claimed) return false;

  const progress = Number(task.progress || 0);
  const target = Number(task.target || 1);

  return progress >= target;
}

function renderEarn() {
  els.earnPanel.innerHTML = `
    <div class="stack">
      <article class="card">
        <h2>Earn Center</h2>
        <p>Complete partner campaigns, watch ads, and use boosts to grow your city faster.</p>
      </article>

      ${renderEarnCard("partnerBot", "Partner Bot", "Open a sponsor bot", 750)}
      ${renderEarnCard("rewardedAd", "Rewarded Ad", "Watch a short ad", 300)}
      ${renderEarnCard("partnerChannel", "Partner Channel", "Join a Telegram channel", 500)}

      <article class="card">
        <h2>Boosts</h2>
        <div class="tabs">
          <button class="tab" data-earn="fullEnergy">Full Energy<br>100</button>
          <button class="tab" data-earn="doubleTap">2x Tap<br>150</button>
          <button class="tab" data-earn="doubleIncome">2x Income<br>200</button>
        </div>
      </article>
    </div>
  `;
}

function renderEarnCard(type, title, subtitle, reward) {
  return `
    <article class="card shop-row">
      <div>
        <h3>${title}</h3>
        <p>${subtitle}</p>
      </div>
      <button class="buy-button" data-earn="${type}">+${reward}</button>
    </article>
  `;
}

function renderFriends() {
  els.friendsPanel.innerHTML = `
    <article class="card">
      <h2>Invite friends</h2>
      <p>Invite link will connect to Telegram. Copy your invite link and share it.</p>
      <br>
      <button class="wide-button" data-copy="invite">Copy Invite Link · +500</button>
    </article>
  `;
}

function renderRank() {
  const playerScore = Math.max(state.cityValue, state.coins);

  els.rankPanel.innerHTML = `
    <div class="stack">
      ${renderRankRow("You", playerScore)}
      ${renderRankRow("Golden Mayor", 24500)}
      ${renderRankRow("Mint Builder", 18200)}
      ${renderRankRow("Urban Prince", 9700)}
    </div>
  `;
}

function renderRankRow(name, score) {
  return `
    <article class="rank-row">
      <strong>${name}</strong>
      <strong>${formatNumber(score)}</strong>
    </article>
  `;
}

function getTapIncome() {
  return Math.max(1, state.buildings.shop);
}

function getUpgradeCost(type) {
  const levels = state.buildings;

  if (type === "shop") return 50 + levels.shop * 37;
  if (type === "bank") return 120 + levels.bank * 75;
  if (type === "factory") return 200 + levels.factory * 95;

  return 100;
}

function getBuildingIcon(type) {
  if (type === "shop") return "🏪";
  if (type === "bank") return "🏛️";
  if (type === "factory") return "🏢";
  return "🏙️";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1800);
}

function showCoinPop(event, amount) {
  const pop = document.createElement("div");
  pop.className = "coin-pop";
  pop.textContent = `+${amount}`;

  const x = event.clientX || window.innerWidth / 2;
  const y = event.clientY || window.innerHeight / 2;

  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  document.body.appendChild(pop);

  setTimeout(() => {
    pop.remove();
  }, 750);
}

function formatNumber(value) {
  return Math.floor(Number(value || 0)).toLocaleString("en-US");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
