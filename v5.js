const API_URL = "https://wealthia-backend.onrender.com";
const CONFIG = window.WEALTHIA_CONFIG || {};
let backendUserId = "web_demo";
let backendReady = false;
let leaderboardRows = [];
let adsgramController = null;
let onboardingStep = 1;

const onboardingKey = `wealthia_onboarding_${CONFIG.ONBOARDING_VERSION || "v1"}`;

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
  dailyReward: {
    streak: 0,
    claimedToday: false,
    nextAmount: 100
  },
  tasks: {
    sponsor: false,
    ad: false,
    channel: false
  },
  boosts: {
    tapActive: false,
    incomeActive: false,
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
  toast: document.getElementById("toast"),
  shopBuilding: document.getElementById("shopBuilding"),
  bankBuilding: document.getElementById("bankBuilding"),
  factoryBuilding: document.getElementById("factoryBuilding"),
  tasksPanel: document.getElementById("tasksPanel"),
  earnPanel: document.getElementById("earnPanel"),
  rankPanel: document.getElementById("rankPanel")
};

connectBackend();
initAdsGram();
setupOnboarding();
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
      dailyReward: {
        ...defaultState.dailyReward,
        ...(parsed.dailyReward || {})
      },
      tasks: {
        ...defaultState.tasks,
        ...(parsed.tasks || {})
      },
      boosts: {
        ...defaultState.boosts,
        ...(parsed.boosts || {})
      },
      buildings: {
        ...defaultState.buildings,
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

function format(value) {
  return Math.floor(Number(value || 0)).toLocaleString("en-US");
}

function tapPower() {
  const base = Math.max(1, Number(state.buildings.shop || 1));
  return state.boosts.tapActive ? base * 2 : base;
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
  if (els.tapLabel) {
    els.tapLabel.textContent = state.energy < 1 ? "No Energy" : state.boosts.tapActive ? "2x Tap" : "Tap";
  }
  if (els.tapButton) els.tapButton.classList.toggle("no-energy", state.energy < 1);

  if (els.shopLevel) els.shopLevel.textContent = state.buildings.shop;
  if (els.bankLevel) els.bankLevel.textContent = state.buildings.bank;
  if (els.factoryLevel) els.factoryLevel.textContent = state.buildings.factory;

  if (els.shopCost) els.shopCost.textContent = format(upgradeCost("shop"));
  if (els.bankCost) els.bankCost.textContent = format(upgradeCost("bank"));
  if (els.factoryCost) els.factoryCost.textContent = format(upgradeCost("factory"));

  renderDailyTasks();
  renderEarnPanel();
  renderRankPanel();
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

  if (diff <= 0) return "New tasks loading soon...";
  if (hours > 0) return `New level-based tasks in ${hours}h ${minutes}m`;
  return `New level-based tasks in ${minutes}m`;
}

function updateTaskRefreshLabel() {
  const note = document.getElementById("taskRefreshNote");
  if (note) note.textContent = getTaskRefreshLabel();
}

function renderDailyTasks() {
  const panel = els.tasksPanel;
  const tasks = Array.isArray(state.dailyTasks) ? state.dailyTasks : [];
  const daily = state.dailyReward || defaultState.dailyReward;
  const dailyClaimed = Boolean(daily.claimedToday);
  const dailyAmount = format(daily.nextAmount || 100);
  const streak = Math.max(1, Number(daily.streak || 1));

  if (!panel) return;

  const dailyButton = `
    <button class="task ${dailyClaimed ? "completed" : ""}" type="button" id="dailyReward" ${dailyClaimed ? "disabled" : ""}>
      <span><b>&#127775; Daily Streak</b><small>Day ${streak} reward</small></span>
      <strong class="${dailyClaimed ? "completed" : ""}">${dailyClaimed ? "Claimed" : `+${dailyAmount}`}</strong>
    </button>
  `;

  if (tasks.length === 0) {
    panel.innerHTML = `
      <div class="panel-head">
        <h2>Daily Missions</h2>
        <p id="taskRefreshNote">${getTaskRefreshLabel()}</p>
      </div>
      ${dailyButton}
      <button class="task" type="button" disabled>
        <span><b>&#127873; Daily tasks preparing</b><small>Connect to backend for missions.</small></span>
        <strong>Soon</strong>
      </button>
    `;
    bindDailyRewardButton();
    return;
  }

  panel.innerHTML = `
    <div class="panel-head">
      <h2>Daily Missions</h2>
      <p id="taskRefreshNote">${getTaskRefreshLabel()}</p>
    </div>
    ${dailyButton}
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

  bindDailyRewardButton();
}

function bindDailyRewardButton() {
  const button = document.getElementById("dailyReward");
  if (!button || button.disabled) return;
  button.addEventListener("click", () => claimDailyReward());
}

function renderEarnPanel() {
  const panel = els.earnPanel;
  if (!panel) return;

  const earnRow = (id, title, subtitle, reward, done) => `
    <button class="task earn-task ${done ? "completed" : ""}" type="button" data-earn="${id}" ${done ? "disabled" : ""}>
      <span><b>${title}</b><small>${done ? "Reward collected" : subtitle}</small></span>
      <strong class="${done ? "completed" : ""}">${done ? "Claimed" : `+${reward}`}</strong>
    </button>
  `;

  const boostButton = (id, icon, title, cost, active) => `
    <button class="boost-button ${active ? "completed" : ""}" type="button" data-boost="${id}" ${active ? "disabled" : ""}>
      <span class="boost-button__icon">${icon}</span>
      ${title}
      <span>${active ? "Active" : `Cost ${cost}`}</span>
    </button>
  `;

  panel.innerHTML = `
    <article class="card stack earn-hero">
      <div class="earn-hero__badge">VIP Earn Center</div>
      <h2>Multiply Your Fortune</h2>
      <p>Complete partner tasks and buy power boosts to grow faster.</p>
    </article>
    ${earnRow("sponsor", "Partner Bot", "Open sponsor bot", 750, state.tasks.sponsor)}
    ${earnRow("ad", "Rewarded Ad", "Watch a short ad", 300, state.tasks.ad)}
    ${earnRow("channel", "Partner Channel", "Join Telegram channel", 500, state.tasks.channel)}
    <article class="card stack">
      <h2>Power Boosts</h2>
      <div class="boost-grid">
        ${boostButton("fullEnergy", "&#x26A1;", "Full Energy", 100, false)}
        ${boostButton("tapBoost", "&#x1F4AA;", "2x Tap", 150, state.boosts.tapActive)}
        ${boostButton("incomeBoost", "&#x1F4C8;", "2x Income", 200, state.boosts.incomeActive)}
      </div>
    </article>
  `;
}

function medalForRank(rank) {
  if (rank === 1) return "&#x1F947;";
  if (rank === 2) return "&#x1F948;";
  if (rank === 3) return "&#x1F949;";
  return "&#x1F3C5;";
}

function renderRankPanel() {
  const panel = els.rankPanel;
  if (!panel) return;

  const rows = leaderboardRows.length
    ? leaderboardRows
    : [{
      rank: 1,
      name: "You",
      cityValue: cityValue(),
      isYou: true
    }];

  panel.innerHTML = `
    <div class="panel-head">
      <h2>Global Leaderboard</h2>
      <p>Top empire builders by city value</p>
    </div>
    <ol class="rank">
      ${rows.map((row) => `
        <li class="${row.isYou ? "rank__you" : ""}">
          <span class="rank__medal">${medalForRank(row.rank)}</span>
          <span>${row.isYou ? "You" : row.name}</span>
          <strong>${format(row.cityValue)}</strong>
        </li>
      `).join("")}
    </ol>
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

function openPartnerLink(url) {
  const tg = window.Telegram && window.Telegram.WebApp;

  if (tg && typeof tg.openTelegramLink === "function" && String(url).includes("t.me")) {
    tg.openTelegramLink(url);
    return;
  }

  if (tg && typeof tg.openLink === "function") {
    tg.openLink(url);
    return;
  }

  window.open(url, "_blank");
}

function initAdsGram() {
  const blockId = CONFIG.ADSGRAM_BLOCK_ID;

  if (!blockId || !window.Adsgram) return;

  try {
    adsgramController = window.Adsgram.init({ blockId, debug: false });
  } catch {
    adsgramController = null;
  }
}

async function showRewardedAd() {
  if (!adsgramController) {
    showToast("Demo ad mode — reward granted.");
    return true;
  }

  try {
    await adsgramController.show();
    return true;
  } catch {
    showToast("Watch the full ad to get reward.");
    return false;
  }
}

function setupOnboarding() {
  const root = document.getElementById("onboarding");
  const nextButton = document.getElementById("onboardingNext");
  const skipButton = document.getElementById("onboardingSkip");

  if (!root || !nextButton || !skipButton) return;

  nextButton.addEventListener("click", () => {
    if (onboardingStep >= 3) {
      finishOnboarding();
      return;
    }

    updateOnboardingStep(onboardingStep + 1);
  });

  skipButton.addEventListener("click", finishOnboarding);

  window.addEventListener("resize", () => {
    if (!root.hidden) updateOnboardingStep(onboardingStep);
  });
}

function startOnboardingIfNeeded() {
  if (localStorage.getItem(onboardingKey)) return;

  const root = document.getElementById("onboarding");
  if (!root) return;

  root.hidden = false;
  updateOnboardingStep(1);
}

function updateOnboardingStep(step) {
  onboardingStep = step;

  document.querySelectorAll(".onboarding__step").forEach((item) => {
    item.hidden = Number(item.dataset.step) !== step;
  });

  const highlight = document.getElementById("onboardingHighlight");
  const targets = {
    1: els.tapButton,
    2: document.querySelector('[data-tab="cityPanel"]'),
    3: document.querySelector('[data-tab="tasksPanel"]')
  };

  const target = targets[step];

  if (highlight && target) {
    const rect = target.getBoundingClientRect();
    highlight.style.left = `${rect.left - 8}px`;
    highlight.style.top = `${rect.top - 8}px`;
    highlight.style.width = `${rect.width + 16}px`;
    highlight.style.height = `${rect.height + 16}px`;
    highlight.hidden = false;
  } else if (highlight) {
    highlight.hidden = true;
  }

  const nextButton = document.getElementById("onboardingNext");
  if (nextButton) nextButton.textContent = step >= 3 ? "Start!" : "Next";
}

function finishOnboarding() {
  localStorage.setItem(onboardingKey, "1");

  const root = document.getElementById("onboarding");
  if (root) root.hidden = true;

  const highlight = document.getElementById("onboardingHighlight");
  if (highlight) highlight.hidden = true;
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

  const game = user.game;

  state.coins = Number(game.coins || 0);
  state.energy = Number(game.energy || 0);
  state.taps = Number(game.taps || 0);
  state.spent = Number(game.spent || 0);
  state.dailyDate = game.dailyDate || "";
  state.dailyStreak = Number(game.dailyStreak || 0);
  state.dailyTasks = Array.isArray(game.dailyTasks) ? game.dailyTasks : [];
  state.dailyTasksNextRefresh = game.dailyTasksNextRefresh || "";

  if (game.dailyReward) {
    state.dailyReward = {
      streak: Number(game.dailyReward.streak || 0),
      claimedToday: Boolean(game.dailyReward.claimedToday),
      nextAmount: Number(game.dailyReward.nextAmount || 100)
    };
  }

  if (game.boosts) {
    state.boosts = {
      tapActive: Boolean(game.boosts.tapActive),
      incomeActive: Boolean(game.boosts.incomeActive),
      tapUntil: Number(game.boosts.tapUntil || 0),
      incomeUntil: Number(game.boosts.incomeUntil || 0)
    };
  }

  if (game.tasks) {
    state.tasks = {
      sponsor: Boolean(game.tasks.sponsor),
      ad: Boolean(game.tasks.ad),
      channel: Boolean(game.tasks.channel)
    };
  }

  if (game.buildings) {
    state.buildings = {
      shop: Number(game.buildings.shop || 1),
      bank: Number(game.buildings.bank || 0),
      factory: Number(game.buildings.factory || 0)
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

function getReferrerId() {
  const tg = window.Telegram && window.Telegram.WebApp;
  const startParam = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  if (!startParam) return "";

  if (String(startParam).startsWith("ref_")) {
    return String(startParam).slice(4);
  }

  return String(startParam);
}

async function apiPost(path, body) {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    return { ok: response.ok, status: response.status, result };
  } catch {
    return { ok: false, status: 0, result: null };
  }
}

async function applyBackendUser(user, message) {
  if (!user) return false;

  syncFromBackend(user);
  backendReady = true;
  saveState();
  render();
  await loadLeaderboard();

  if (message) showToast(message);
  startOnboardingIfNeeded();
  return true;
}

async function connectBackend() {
  const { ok, result } = await apiPost("/api/session", {
    telegramUser: getTelegramUser(),
    referrerId: getReferrerId()
  });

  if (!ok || !result) {
    backendReady = false;
    showToast("Backend offline. Local mode.");
    render();
    return;
  }

  backendUserId = result.userId;
  await applyBackendUser(result, "Backend connected.");
}

async function loadLeaderboard() {
  if (!backendReady) return;

  const { ok, result } = await apiPost("/api/leaderboard", { userId: backendUserId });
  if (!ok || !result || !Array.isArray(result.rows)) return;

  leaderboardRows = result.rows;
  renderRankPanel();
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

  const { ok, result } = await apiPost("/api/tap", { userId: backendUserId });
  if (!ok || !result) return;

  syncFromBackend(result.user);
  saveState();
  render();
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

  const { ok, result } = await apiPost("/api/upgrade", {
    userId: backendUserId,
    building: name
  });

  if (!ok || !result) return;

  syncFromBackend(result.user);
  saveState();
  render();
}

async function claimBackendTask(taskId) {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  const { ok, result } = await apiPost("/api/claim-task", {
    userId: backendUserId,
    task: taskId
  });

  if (!ok) {
    const error = result && result.error;
    if (error === "TASK_NOT_READY") showToast("Task is not ready yet.");
    else if (error === "TASK_ALREADY_CLAIMED") showToast("Task already claimed.");
    else showToast("Task locked.");
    return;
  }

  await applyBackendUser(result.user, `Reward claimed: +${format(result.reward)}`);
}

async function claimDailyReward() {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  const { ok, result } = await apiPost("/api/claim-daily", { userId: backendUserId });

  if (!ok) {
    if (result && result.error === "ALREADY_CLAIMED") showToast("Daily reward already claimed.");
    else showToast("Daily reward unavailable.");
    return;
  }

  await applyBackendUser(result.user, `Daily reward: +${format(result.reward)}`);
}

async function handleEarnClick(type) {
  if (state.tasks[type]) {
    showToast("Already claimed.");
    return;
  }

  if (type === "ad") {
    const watched = await showRewardedAd();
    if (!watched) return;
  }

  if (type === "sponsor") {
    openPartnerLink(CONFIG.SPONSOR_BOT_URL || "https://t.me/WealthiaGameBot");
    showToast("Open sponsor bot, then reward is added.");
  }

  if (type === "channel") {
    openPartnerLink(CONFIG.PARTNER_CHANNEL_URL || "https://t.me/wealthia_channel");
    showToast("Join channel, then reward is added.");
  }

  await claimEarnTask(type);
}

async function claimEarnTask(type) {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  const { ok, result } = await apiPost("/api/claim-earn", {
    userId: backendUserId,
    type
  });

  if (!ok) {
    if (result && result.error === "ALREADY_CLAIMED") showToast("Already claimed.");
    else showToast("Task unavailable.");
    return;
  }

  await applyBackendUser(result.user, `Reward: +${format(result.reward)}`);
}

async function buyBoost(boost) {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  const { ok, result } = await apiPost("/api/buy-boost", {
    userId: backendUserId,
    boost
  });

  if (!ok) {
    if (result && result.error === "NOT_ENOUGH_COINS") showToast("Not enough coins.");
    else showToast("Boost unavailable.");
    return;
  }

  const labels = {
    fullEnergy: "Energy filled.",
    tapBoost: "2x Tap activated for 30 min.",
    incomeBoost: "2x Income activated for 30 min."
  };

  await applyBackendUser(result.user, labels[boost] || "Boost activated.");
}

async function resetGame() {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  if (!window.confirm("Reset your empire progress?")) return;

  const { ok, result } = await apiPost("/api/reset", { userId: backendUserId });

  if (!ok || !result) {
    showToast("Reset failed.");
    return;
  }

  localStorage.removeItem(storageKey);
  state = structuredClone(defaultState);
  await applyBackendUser(result.user, "Game reset.");
}

async function refreshBackendState() {
  if (!backendReady) return;

  const { ok, result } = await apiPost("/api/session", {
    telegramUser: getTelegramUser(),
    referrerId: getReferrerId()
  });

  if (!ok || !result) return;

  syncFromBackend(result);
  saveState();
  render();
  await loadLeaderboard();
}

if (els.tapButton) {
  els.tapButton.addEventListener("pointerdown", backendTap);
}

document.querySelectorAll("[data-upgrade]").forEach((button) => {
  button.addEventListener("click", () => backendUpgrade(button.dataset.upgrade));
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));

    tab.classList.add("active");
    const panel = document.getElementById(tab.dataset.tab);
    if (panel) panel.classList.add("active");

    if (tab.dataset.tab === "rankPanel") {
      loadLeaderboard();
    }
  });
});

if (els.tasksPanel) {
  els.tasksPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-daily-task]");
    if (!button || button.disabled) return;

    const taskId = button.dataset.dailyTask;
    if (!taskId) return;

    claimBackendTask(taskId);
  });
}

if (els.earnPanel) {
  els.earnPanel.addEventListener("click", (event) => {
    const earnButton = event.target.closest("[data-earn]");
    if (earnButton && !earnButton.disabled) {
      handleEarnClick(earnButton.dataset.earn);
      return;
    }

    const boostButton = event.target.closest("[data-boost]");
    if (boostButton && !boostButton.disabled) {
      buyBoost(boostButton.dataset.boost);
    }
  });
}

const inviteButton = document.getElementById("inviteButton");
if (inviteButton) {
  inviteButton.addEventListener("click", async () => {
    const botName = CONFIG.BOT_USERNAME || "WealthiaGameBot";
    const link = `https://t.me/${botName}?start=ref_${backendUserId}`;

    try {
      await navigator.clipboard.writeText(link);
      showToast("Invite link copied. Friend joins = +500 coins.");
    } catch {
      showToast(link);
    }
  });
}

const resetButton = document.getElementById("resetButton");
if (resetButton) {
  resetButton.addEventListener("click", resetGame);
}

window.setInterval(refreshBackendState, 10000);

window.setInterval(() => {
  updateTaskRefreshLabel();

  const now = Date.now();
  if (state.boosts.tapUntil && state.boosts.tapUntil <= now) {
    state.boosts.tapActive = false;
  }
  if (state.boosts.incomeUntil && state.boosts.incomeUntil <= now) {
    state.boosts.incomeActive = false;
  }

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
