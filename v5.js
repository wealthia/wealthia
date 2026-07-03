const API_URL = (window.WEALTHIA_CONFIG && window.WEALTHIA_CONFIG.API_URL) ||
  "https://wealthia-backend.onrender.com";
const CONFIG = window.WEALTHIA_CONFIG || {};
let backendUserId = "web_demo";
let backendReady = false;
let leaderboardTop3 = [];
let leaderboardYou = null;
let tournamentData = null;
let tournamentLeaderboard = [];
let adsgramController = null;
let adsgramBonusController = null;
let onboardingStep = 1;
let adCooldownTimer = null;

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
    channel: false
  },
  adCooldownUntil: 0,
  bonusAdCooldownUntil: 0,
  boosts: {
    tapActive: false,
    incomeActive: false,
    endlessActive: false,
    tapUntil: 0,
    incomeUntil: 0,
    endlessUntil: 0
  },
  buildings: {
    shop: 1,
    bank: 0,
    factory: 0,
    casino: 0
  },
  casino: {
    spunToday: false,
    canSpin: false
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
  casinoCardDesc: document.getElementById("casinoCardDesc"),
  casinoCost: document.getElementById("casinoCost"),
  casinoSpinMount: document.getElementById("casinoSpinMount"),
  casinoSpinCard: null,
  casinoSpinButton: null,
  casinoSpinHint: null,
  casinoUpgradeButton: document.getElementById("casinoUpgradeButton"),
  empireLevel: document.getElementById("empireLevel"),
  empireLevelStat: document.getElementById("empireLevelStat"),
  toast: document.getElementById("toast"),
  shopBuilding: document.getElementById("shopBuilding"),
  bankBuilding: document.getElementById("bankBuilding"),
  factoryBuilding: document.getElementById("factoryBuilding"),
  tasksPanel: document.getElementById("tasksPanel"),
  earnPanel: document.getElementById("earnPanel"),
  rankPanel: document.getElementById("rankPanel"),
  tournamentPanel: document.getElementById("tournamentPanel"),
  globalLeaderboard: document.getElementById("globalLeaderboard")
};

connectBackend();
initTelegramWebApp();
initAdsGram();
setupOnboarding();
setupTapControls();
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
      },
      casino: {
        ...defaultState.casino,
        ...(parsed.casino || {})
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

function empireLevel() {
  return (
    Number(state.buildings.shop || 0) +
    Number(state.buildings.bank || 0) +
    Number(state.buildings.factory || 0) +
    Number(state.buildings.casino || 0)
  );
}

function isEndlessEnergy() {
  return Number(state.boosts.endlessUntil || 0) > Date.now();
}

function boostTimeLeft(until) {
  const diff = Math.max(0, Number(until || 0) - Date.now());
  const minutes = Math.ceil(diff / 60000);
  if (diff <= 0) return "";
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function casinoRewardRange(level) {
  const lv = Math.max(1, Number(level || 1));
  return {
    small: 80 + lv * 40,
    jackpot: 2000 + lv * 500
  };
}

function upgradeCost(name) {
  const base = { shop: 50, bank: 120, factory: 200, casino: 300 }[name];
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
    if (isEndlessEnergy()) {
      els.tapLabel.textContent = state.boosts.tapActive ? "2x · ∞" : "∞ Energy";
    } else {
      els.tapLabel.textContent = state.energy < 1 ? "No Energy" : state.boosts.tapActive ? "2x Tap" : "Tap";
    }
  }
  if (els.tapButton) els.tapButton.classList.toggle("no-energy", !isEndlessEnergy() && state.energy < 1);

  if (els.shopLevel) els.shopLevel.textContent = state.buildings.shop;
  if (els.bankLevel) els.bankLevel.textContent = state.buildings.bank;
  if (els.factoryLevel) els.factoryLevel.textContent = state.buildings.factory;

  const level = empireLevel();
  if (els.empireLevel) els.empireLevel.textContent = level;
  if (els.empireLevelStat) els.empireLevelStat.textContent = level;

  if (els.shopCost) els.shopCost.textContent = format(upgradeCost("shop"));
  if (els.bankCost) els.bankCost.textContent = format(upgradeCost("bank"));
  if (els.factoryCost) els.factoryCost.textContent = format(upgradeCost("factory"));
  if (els.casinoCost) els.casinoCost.textContent = format(upgradeCost("casino"));

  if (els.casinoUpgradeButton) {
    els.casinoUpgradeButton.textContent =
      Number(state.buildings.casino || 0) < 1
        ? `Build ${format(upgradeCost("casino"))}`
        : `Upgrade ${format(upgradeCost("casino"))}`;
  }

  renderCasinoCard();
  renderCasinoSpin();

  renderDailyTasks();
  renderEarnPanel();
  renderTournamentPanel();
  renderRankPanel();
  updateCityVisuals();
}

function renderCasinoCard() {
  const level = Number(state.buildings.casino || 0);

  if (els.casinoCardDesc) {
    if (level < 1) {
      els.casinoCardDesc.textContent =
        "Build to unlock daily Lucky Spin. Each casino level adds +1 Empire Level.";
    } else {
      const { small, jackpot } = casinoRewardRange(level);
      els.casinoCardDesc.textContent =
        `Level ${level} · Daily spin rewards ${format(small)}–${format(jackpot)} coins`;
    }
  }
}

function removeCasinoSpinCard() {
  if (els.casinoSpinCard) {
    els.casinoSpinCard.remove();
    els.casinoSpinCard = null;
    els.casinoSpinButton = null;
    els.casinoSpinHint = null;
  }
}

function ensureCasinoSpinCard() {
  const level = Number(state.buildings.casino || 0);
  if (level < 1) {
    removeCasinoSpinCard();
    return;
  }

  if (els.casinoSpinCard) return;

  const mount = els.casinoSpinMount || document.getElementById("casinoCard");
  if (!mount) return;

  const card = document.createElement("article");
  card.className = "card card--casino-spin";
  card.id = "casinoSpinCard";
  card.innerHTML = `
    <div class="card__icon">&#x1F3B2;</div>
    <div class="card__body">
      <h2>Lucky Spin</h2>
      <p id="casinoSpinHint">Spin once per day for bonus coins.</p>
    </div>
    <button class="buy-button casino-spin-button" type="button" id="casinoSpinButton">
      Spin Now
    </button>
  `;

  mount.insertAdjacentElement("beforebegin", card);

  els.casinoSpinCard = card;
  els.casinoSpinHint = card.querySelector("#casinoSpinHint");
  els.casinoSpinButton = card.querySelector("#casinoSpinButton");
  els.casinoSpinButton.addEventListener("click", spinCasino);
}

function renderCasinoSpin() {
  const level = Number(state.buildings.casino || 0);
  const canSpin = Boolean(state.casino && state.casino.canSpin);
  const spunToday = Boolean(state.casino && state.casino.spunToday);

  ensureCasinoSpinCard();

  if (level < 1 || !els.casinoSpinCard) return;

  if (els.casinoSpinButton) {
    els.casinoSpinButton.disabled = !canSpin;
    els.casinoSpinButton.textContent = spunToday ? "Spin Today" : "Spin Now";
  }

  if (els.casinoSpinHint) {
    if (spunToday) {
      els.casinoSpinHint.textContent = "Come back tomorrow for another spin.";
    } else {
      const { small, jackpot } = casinoRewardRange(level);
      els.casinoSpinHint.textContent =
        `Free daily spin · Win ${format(small)} to ${format(jackpot)} coins (5% jackpot)`;
    }
  }
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

function starPrice(productId) {
  const prices = CONFIG.STAR_PRICES || {};
  return Number(prices[productId] || 0);
}

function earnRefreshMinutesLeft(until) {
  const diff = Math.max(0, Number(until || 0) - Date.now());
  return Math.max(1, Math.ceil(diff / 60000));
}

function adRewardAvailable() {
  return Number(state.adCooldownUntil || 0) <= Date.now();
}

function bonusAdRewardAvailable() {
  return Number(state.bonusAdCooldownUntil || 0) <= Date.now();
}

function adRefreshMinutesLeft() {
  return earnRefreshMinutesLeft(state.adCooldownUntil);
}

function bonusAdRefreshMinutesLeft() {
  return earnRefreshMinutesLeft(state.bonusAdCooldownUntil);
}

function bonusAdRewardAmount() {
  return Number(CONFIG.BONUS_AD_REWARD || 150);
}

function adRewardSubtitle() {
  if (!adRewardAvailable()) return "Reward collected";

  if (adsGramReady()) return "Watch ad for +300 coins";
  if (CONFIG.ADSGRAM_BLOCK_ID) return "Ad loading — open in Telegram";
  return "Connect AdsGram Block ID in config.js";
}

function bonusAdRewardSubtitle() {
  if (!bonusAdRewardAvailable()) return "Reward collected";

  const reward = bonusAdRewardAmount();
  if (adsGramBonusReady()) return `Watch bonus ad for +${reward} coins`;
  if (CONFIG.ADSGRAM_BONUS_BLOCK_ID || CONFIG.ADSGRAM_BLOCK_ID) {
    return "Ad loading — open in Telegram";
  }
  return "Add AdsGram Bonus Block ID in config.js";
}

function renderCooldownAdRow(type, title, subtitle, reward, onCooldown, refreshMinutes, timerId) {
  const button = `
    <button class="task earn-task earn-task--ad ${onCooldown ? "completed" : ""}" type="button" data-earn="${type}" ${onCooldown ? "disabled" : ""}>
      <span><b>${title}</b><small>${subtitle}</small></span>
      <strong class="${onCooldown ? "completed" : ""}">${onCooldown ? "Claimed" : `+${reward}`}</strong>
    </button>
  `;

  if (!onCooldown) return button;

  return `
    <div class="earn-ad-wrap">
      ${button}
      <p class="ad-refresh-timer" id="${timerId}">Refreshing in <span>${refreshMinutes}</span></p>
    </div>
  `;
}

function renderAdEarnRow() {
  return renderCooldownAdRow(
    "ad",
    "Rewarded Ad",
    adRewardSubtitle(),
    300,
    !adRewardAvailable(),
    adRefreshMinutesLeft(),
    "adRefreshTimer"
  );
}

function renderBonusAdEarnRow() {
  const reward = bonusAdRewardAmount();
  return renderCooldownAdRow(
    "bonus_ad",
    "Bonus Ad",
    bonusAdRewardSubtitle(),
    reward,
    !bonusAdRewardAvailable(),
    bonusAdRefreshMinutesLeft(),
    "bonusAdRefreshTimer"
  );
}

function scheduleAdCooldownRefresh() {
  if (adCooldownTimer) return;

  adCooldownTimer = window.setInterval(() => {
    const adTimer = document.getElementById("adRefreshTimer");
    const bonusTimer = document.getElementById("bonusAdRefreshTimer");

    if (adTimer && !adRewardAvailable()) {
      adTimer.innerHTML = `Refreshing in <span>${adRefreshMinutesLeft()}</span>`;
    }

    if (bonusTimer && !bonusAdRewardAvailable()) {
      bonusTimer.innerHTML = `Refreshing in <span>${bonusAdRefreshMinutesLeft()}</span>`;
    }

    const adReady = adRewardAvailable();
    const bonusReady = bonusAdRewardAvailable();

    if (adReady && bonusReady) {
      window.clearInterval(adCooldownTimer);
      adCooldownTimer = null;
      renderEarnPanel();
      return;
    }

    if (!adTimer && !bonusTimer) renderEarnPanel();
  }, 1000);
}

function renderEarnPanel() {
  const panel = els.earnPanel;
  if (!panel) return;

  const earnRow = (id, title, subtitle, reward, done, doneLabel) => `
    <button class="task earn-task ${done ? "completed" : ""}" type="button" data-earn="${id}" ${done ? "disabled" : ""}>
      <span><b>${title}</b><small>${done ? subtitle : subtitle}</small></span>
      <strong class="${done ? "completed" : ""}">${done ? (doneLabel || "Claimed") : `+${reward}`}</strong>
    </button>
  `;

  const starButton = (id, icon, title, stars, active, until) => `
    <button class="boost-button boost-button--star ${active ? "completed" : ""}" type="button" data-star="${id}" ${active ? "disabled" : ""}>
      <span class="boost-button__icon">${icon}</span>
      ${title}
      <span>${active ? `Active ${boostTimeLeft(until)}` : `${stars} ⭐`}</span>
    </button>
  `;

  panel.innerHTML = `
    <article class="card stack earn-hero">
      <div class="earn-hero__badge">VIP Earn Center</div>
      <h2>Multiply Your Fortune</h2>
      <p>Watch ads for coins and unlock premium boosts with Telegram Stars.</p>
    </article>
    ${renderBonusAdEarnRow()}
    ${renderAdEarnRow()}
    ${earnRow("channel", "Join Channel", "Subscribe for bonus coins", 500, state.tasks.channel)}
    <article class="card stack stars-shop">
      <h2>Premium Boosts</h2>
      <p class="earn-note">Pay with Telegram Stars ⭐ · most boosts last 30 minutes</p>
      <div class="boost-grid boost-grid--stars">
        ${starButton("refill_energy", "&#x26A1;", "Refill Energy", starPrice("refill_energy"), false, 0)}
        ${starButton("tap_boost_30", "&#x1F4AA;", "2x Tap", starPrice("tap_boost_30"), state.boosts.tapActive, state.boosts.tapUntil)}
        ${starButton("endless_energy_30", "&#x1F525;", "Endless Energy", starPrice("endless_energy_30"), state.boosts.endlessActive, state.boosts.endlessUntil)}
        ${starButton("income_boost_30", "&#x1F4C8;", "2x Income", starPrice("income_boost_30"), state.boosts.incomeActive, state.boosts.incomeUntil)}
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

function tournamentTimeLeft(endsAt) {
  const diff = Math.max(0, Date.parse(endsAt || "") - Date.now());
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (diff <= 0) return "Ended";
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function renderTournamentPanel() {
  const panel = els.tournamentPanel;
  if (!panel) return;

  const t = tournamentData;

  if (!t) {
    panel.innerHTML = `
      <article class="card stack tournament-card tournament-card--empty">
        <div class="tournament-card__badge">Arena</div>
        <h2>No Live Tournament</h2>
        <p>Check back soon for tap races with coin prizes.</p>
      </article>
    `;
    return;
  }

  const joined = Boolean(t.joined);
  const rows = tournamentLeaderboard.length
    ? tournamentLeaderboard
    : joined
      ? [{ rank: 1, name: "You", tapScore: t.myScore || 0, isYou: true }]
      : [];

  panel.innerHTML = `
    <article class="card stack tournament-card">
      <div class="tournament-card__badge">${t.isLive ? "Live Now" : "Upcoming"}</div>
      <h2>${t.title}</h2>
      <p>${t.description || "Tap as much as you can to climb the leaderboard."}</p>
      <div class="tournament-meta">
        <span>Entry: ${format(t.entryFee)} coins</span>
        <span>Prize pool: ${format(t.prizePool)}</span>
        <span>${tournamentTimeLeft(t.endsAt)}</span>
      </div>
      ${joined ? `
        <div class="tournament-score">
          <span>Your taps</span>
          <strong>${format(t.myScore || 0)}</strong>
        </div>
      ` : `
        <button class="wide-button tournament-join" type="button" id="joinTournamentButton">
          Join Tournament · ${format(t.entryFee)} coins
        </button>
      `}
    </article>
    ${joined ? `
      <div class="panel-head">
        <h2>Tournament Leaderboard</h2>
        <p>Top tappers win coin prizes</p>
      </div>
      <ol class="rank">
        ${rows.map((row) => `
          <li class="${row.isYou ? "rank__you" : ""}">
            <span class="rank__medal">${medalForRank(row.rank)}</span>
            <span>${row.isYou ? "You" : row.name}</span>
            <strong>${format(row.tapScore)} taps</strong>
          </li>
        `).join("")}
      </ol>
    ` : ""}
  `;

  const joinButton = document.getElementById("joinTournamentButton");
  if (joinButton) {
    joinButton.addEventListener("click", joinTournament);
  }
}

function ordinalRank(rank) {
  const value = Number(rank || 0);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function renderRankRow(row) {
  return `
    <li class="${row.isYou ? "rank__you" : ""}">
      <span class="rank__medal">${medalForRank(row.rank)}</span>
      <span>${row.isYou ? "You" : row.name}</span>
      <strong>${format(row.cityValue)}</strong>
    </li>
  `;
}

function renderRankPanel() {
  const panel = els.globalLeaderboard;
  if (!panel) return;

  const top3 = leaderboardTop3.length
    ? leaderboardTop3
    : [{
      rank: 1,
      name: "You",
      cityValue: cityValue(),
      isYou: true
    }];

  const you = leaderboardYou;
  const youBlock = you
    ? `
      <div class="rank-your-place">
        <span class="rank-your-place__label">Your place · ${ordinalRank(you.rank)}</span>
      </div>
      <ol class="rank rank--you-only">
        ${renderRankRow(you)}
      </ol>
    `
    : "";

  panel.innerHTML = `
    <div class="panel-head">
      <h2>Global Leaderboard</h2>
      <p>Top empire builders by city value</p>
    </div>
    <ol class="rank">
      ${top3.map((row) => renderRankRow(row)).join("")}
    </ol>
    ${youBlock}
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
  const blockId = String(CONFIG.ADSGRAM_BLOCK_ID || "").trim();
  const bonusBlockId = String(CONFIG.ADSGRAM_BONUS_BLOCK_ID || blockId).trim();

  if (!blockId || !window.Adsgram) {
    adsgramController = null;
    adsgramBonusController = null;
    return;
  }

  try {
    adsgramController = window.Adsgram.init({
      blockId,
      debug: Boolean(CONFIG.ADSGRAM_DEBUG),
      debugBannerType: "RewardedVideo"
    });
  } catch {
    adsgramController = null;
  }

  if (!bonusBlockId) {
    adsgramBonusController = null;
    return;
  }

  try {
    adsgramBonusController = window.Adsgram.init({
      blockId: bonusBlockId,
      debug: Boolean(CONFIG.ADSGRAM_DEBUG),
      debugBannerType: "RewardedVideo"
    });
  } catch {
    adsgramBonusController = null;
  }
}

function adsGramReady() {
  return Boolean(String(CONFIG.ADSGRAM_BLOCK_ID || "").trim() && adsgramController);
}

function adsGramBonusReady() {
  const blockId = String(CONFIG.ADSGRAM_BONUS_BLOCK_ID || CONFIG.ADSGRAM_BLOCK_ID || "").trim();
  return Boolean(blockId && adsgramBonusController);
}

async function showRewardedAd(controller) {
  const hasBlock = String(CONFIG.ADSGRAM_BLOCK_ID || "").trim();

  if (!controller) {
    if (hasBlock) {
      showToast("Ad not ready. Open game in Telegram and try again.");
      return false;
    }

    showToast("Demo mode — add AdsGram Block ID in config.js");
    return true;
  }

  try {
    const result = await controller.show();
    if (result && result.done) return true;
    showToast(result?.description || "Watch the full ad to get reward.");
    return false;
  } catch (error) {
    const message = error && error.description ? error.description : "Ad skipped or unavailable.";
    showToast(message);
    return false;
  }
}

async function showMainRewardedAd() {
  return showRewardedAd(adsGramReady() ? adsgramController : null);
}

async function showBonusRewardedAd() {
  return showRewardedAd(adsGramBonusReady() ? adsgramBonusController : null);
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
      endlessActive: Boolean(game.boosts.endlessActive),
      tapUntil: Number(game.boosts.tapUntil || 0),
      incomeUntil: Number(game.boosts.incomeUntil || 0),
      endlessUntil: Number(game.boosts.endlessUntil || 0)
    };
  }

  if (game.tasks) {
    state.tasks = {
      sponsor: Boolean(game.tasks.sponsor),
      channel: Boolean(game.tasks.channel)
    };
  }

  if (game.adReward) {
    state.adCooldownUntil = Number(game.adReward.nextAt || 0);
  } else {
    state.adCooldownUntil = 0;
  }

  if (game.bonusAdReward) {
    state.bonusAdCooldownUntil = Number(game.bonusAdReward.nextAt || 0);
  } else {
    state.bonusAdCooldownUntil = 0;
  }

  if (!adRewardAvailable() || !bonusAdRewardAvailable()) {
    scheduleAdCooldownRefresh();
  }

  if (game.buildings) {
    state.buildings = {
      shop: Number(game.buildings.shop || 1),
      bank: Number(game.buildings.bank || 0),
      factory: Number(game.buildings.factory || 0),
      casino: Number(game.buildings.casino || 0)
    };
  }

  if (game.casino) {
    state.casino = {
      spunToday: Boolean(game.casino.spunToday),
      canSpin: Boolean(game.casino.canSpin)
    };
  }
}

function getTelegramUser() {
  const tg = window.Telegram && window.Telegram.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }
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
  await loadTournament();
}

async function loadLeaderboard() {
  if (!backendReady) return;

  const { ok, result } = await apiPost("/api/leaderboard", { userId: backendUserId });
  if (!ok || !result) return;

  leaderboardTop3 = Array.isArray(result.top3) ? result.top3 : [];
  leaderboardYou = result.you || null;
  renderRankPanel();
}

async function loadTournament() {
  if (!backendReady) {
    tournamentData = null;
    tournamentLeaderboard = [];
    renderTournamentPanel();
    return;
  }

  const { ok, result } = await apiPost("/api/tournaments/active", { userId: backendUserId });
  if (!ok || !result) return;

  tournamentData = result.tournament || null;

  if (tournamentData && tournamentData.joined) {
    const board = await apiPost("/api/tournaments/leaderboard", {
      tournamentId: tournamentData.id,
      userId: backendUserId
    });

    if (board.ok && board.result && Array.isArray(board.result.rows)) {
      tournamentLeaderboard = board.result.rows;
    }
  } else {
    tournamentLeaderboard = [];
  }

  renderTournamentPanel();
}

async function joinTournament() {
  if (!backendReady || !tournamentData) {
    showToast("Backend offline.");
    return;
  }

  const { ok, result } = await apiPost("/api/tournaments/join", {
    userId: backendUserId,
    tournamentId: tournamentData.id
  });

  if (!ok) {
    if (result && result.error === "NOT_ENOUGH_COINS") showToast("Not enough coins to join.");
    else if (result && result.error === "ALREADY_JOINED") showToast("Already joined.");
    else showToast("Could not join tournament.");
    return;
  }

  tournamentData = result.tournament || tournamentData;
  await applyBackendUser(result.user, "Joined tournament! Start tapping.");
  await loadTournament();
}

function tapLocal(event) {
  if (!isEndlessEnergy() && state.energy < 1) {
    showToast("No energy.");
    render();
    return false;
  }

  const amount = tapPower();
  state.coins = Number(state.coins || 0) + amount;
  state.taps = Number(state.taps || 0) + 1;
  if (!isEndlessEnergy()) {
    state.energy = Math.max(0, Number(state.energy || 0) - 1);
  }

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

  if (tournamentData && tournamentData.joined) {
    tournamentData.myScore = Number(tournamentData.myScore || 0) + 1;
    loadTournament();
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
  const snapshot = {
    coins: state.coins,
    spent: Number(state.spent || 0),
    level: Number(state.buildings[name] || 0)
  };

  if (!upgradeLocal(name)) return;
  if (!backendReady) return;

  const { ok, result } = await apiPost("/api/upgrade", {
    userId: backendUserId,
    building: name
  });

  if (!ok || !result || !result.user) {
    state.coins = snapshot.coins;
    state.spent = snapshot.spent;
    state.buildings[name] = snapshot.level;
    saveState();
    render();

    if (result && result.error === "NOT_ENOUGH_COINS") {
      showToast("Not enough Wealth Coin.");
    } else if (name === "casino") {
      showToast("Casino save failed. Run migration-casino-level.sql in Supabase.");
    } else {
      showToast("Upgrade failed. Try again.");
    }
    return;
  }

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
  if (type !== "ad" && type !== "bonus_ad" && state.tasks[type]) {
    showToast("Already claimed.");
    return;
  }

  if (type === "ad") {
    if (!adRewardAvailable()) {
      showToast(`Refreshing in ${adRefreshMinutesLeft()}`);
      return;
    }

    const watched = await showMainRewardedAd();
    if (!watched) return;
  }

  if (type === "bonus_ad") {
    if (!bonusAdRewardAvailable()) {
      showToast(`Refreshing in ${bonusAdRefreshMinutesLeft()}`);
      return;
    }

    const watched = await showBonusRewardedAd();
    if (!watched) return;
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
    else if (result && result.error === "AD_COOLDOWN") {
      state.adCooldownUntil = Number(result.nextAt || state.adCooldownUntil);
      scheduleAdCooldownRefresh();
      renderEarnPanel();
      showToast(`Refreshing in ${adRefreshMinutesLeft()}`);
    } else if (result && result.error === "BONUS_AD_COOLDOWN") {
      state.bonusAdCooldownUntil = Number(result.nextAt || state.bonusAdCooldownUntil);
      scheduleAdCooldownRefresh();
      renderEarnPanel();
      showToast(`Refreshing in ${bonusAdRefreshMinutesLeft()}`);
    } else showToast("Task unavailable.");
    return;
  }

  await applyBackendUser(result.user, `Reward: +${format(result.reward)}`);
}

const STAR_SUCCESS_LABELS = {
  refill_energy: "Energy refilled!",
  tap_boost_30: "2x Tap active for 30 min!",
  endless_energy_30: "Endless Energy for 30 min!",
  income_boost_30: "2x Income active for 30 min!"
};

async function buyStarsProduct(productId) {
  const tg = window.Telegram && window.Telegram.WebApp;

  if (!tg || typeof tg.openInvoice !== "function") {
    showToast("Open in Telegram to pay with Stars.");
    return;
  }

  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  const { ok, result } = await apiPost("/api/stars/invoice", {
    userId: backendUserId,
    productId
  });

  if (!ok || !result || !result.invoiceLink) {
    if (result && result.error === "STARS_NOT_CONFIGURED") {
      showToast("Stars payments not configured yet.");
    } else {
      showToast("Could not open Stars payment.");
    }
    return;
  }

  tg.openInvoice(result.invoiceLink, async (status) => {
    if (status === "paid") {
      await refreshBackendState();
      showToast(STAR_SUCCESS_LABELS[productId] || "Premium boost activated!");
      if (tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === "function") {
        tg.HapticFeedback.notificationOccurred("success");
      }
      return;
    }

    if (status === "failed") {
      showToast("Payment failed.");
      return;
    }

    if (status === "cancelled") {
      showToast("Payment cancelled.");
    }
  });
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
  await loadTournament();
}

function initTelegramWebApp() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;

  tg.ready();
  tg.expand();
  if (typeof tg.disableVerticalSwipes === "function") {
    tg.disableVerticalSwipes();
  }
}

function setupTapControls() {
  if (!els.tapButton) return;

  const tapArea = document.querySelector(".tap-area");
  let tapping = false;

  const blockTouchScroll = (event) => {
    if (event.cancelable) event.preventDefault();
  };

  const onTapStart = (event) => {
    tapping = true;
    backendTap(event);
  };

  const onTapEnd = () => {
    tapping = false;
  };

  els.tapButton.addEventListener("pointerdown", onTapStart);
  els.tapButton.addEventListener("pointerup", onTapEnd);
  els.tapButton.addEventListener("pointercancel", onTapEnd);
  els.tapButton.addEventListener("pointerleave", onTapEnd);
  els.tapButton.addEventListener("touchstart", blockTouchScroll, { passive: false });
  els.tapButton.addEventListener("touchmove", blockTouchScroll, { passive: false });
  els.tapButton.addEventListener("touchend", onTapEnd, { passive: false });
  els.tapButton.addEventListener("contextmenu", (event) => event.preventDefault());

  if (tapArea) {
    tapArea.addEventListener("touchmove", blockTouchScroll, { passive: false });
  }

  document.addEventListener("touchmove", (event) => {
    if (tapping && event.cancelable) event.preventDefault();
  }, { passive: false });
}

async function spinCasino() {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  if (Number(state.buildings.casino || 0) < 1) {
    showToast("Build Casino first.");
    return;
  }

  const { ok, result } = await apiPost("/api/casino-spin", { userId: backendUserId });

  if (!ok) {
    if (result && result.error === "ALREADY_SPUN") showToast("Already spun today.");
    else if (result && result.error === "CASINO_LOCKED") showToast("Build Casino first.");
    else showToast("Spin unavailable.");
    return;
  }

  const labels = {
    jackpot: "JACKPOT!",
    big: "Big win!",
    medium: "Nice win!",
    small: "Small win!"
  };

  await applyBackendUser(
    result.user,
    `${labels[result.tier] || "Win!"} +${format(result.reward)}`
  );
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
      loadTournament();
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

    const starButton = event.target.closest("[data-star]");
    if (starButton && !starButton.disabled) {
      buyStarsProduct(starButton.dataset.star);
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
  if (state.boosts.endlessUntil && state.boosts.endlessUntil <= now) {
    state.boosts.endlessActive = false;
  }

  const next = Date.parse(state.dailyTasksNextRefresh || "");
  if (next && Date.now() >= next) {
    refreshBackendState();
  }
}, 60000);

setInterval(() => {
  if (isEndlessEnergy() || state.energy >= 100) return;

  state.energy = Math.min(
    100,
    Number(state.energy || 0) + Math.max(1, Number(state.buildings.factory || 0) + 1)
  );

  saveState();
  render();
}, 5000);
