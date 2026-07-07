const API_URL = (window.WEALTHIA_CONFIG && window.WEALTHIA_CONFIG.API_URL) ||
  "https://wealthia-backend.onrender.com";
const CONFIG = window.WEALTHIA_CONFIG || {};
let backendUserId = "web_demo";
let backendSessionToken = "";
let backendReady = false;
let paymentInProgress = false;
let paymentQuietUntil = 0;
let leaderboardTop3 = [];
let leaderboardYou = null;
let dailyLeaderboardTop3 = [];
let dailyLeaderboardRows = [];
let dailyLeaderboardYou = null;
let dailyYourRank = 0;
let dailyContestResetsAt = "";
let dailyContestScore = 0;
let dailyReferralCount = 0;
let dailyReferralsRequired = 3;
let dailyPrizeEligible = false;
let dailyLastWinner = null;
let tournamentData = null;
let tournamentLeaderboard = [];
let adsgramController = null;
let adsgramBonusController = null;
let onboardingStep = 1;
let adCooldownTimer = null;
let boostRefreshTimer = null;
let goldRushTimer = null;
let taskCountdownTimer = null;
let lastGrandPrizeMilestone = 0;
let premiumWheelRotation = 0;
let premiumSpinBusy = false;
let premiumSpinAwaitingRetry = false;
let premiumSpinPaid = false;
let premiumSpinWaiting = false;
let premiumSpinLastUser = null;

const PREMIUM_SPIN_STARS = Number((CONFIG.STAR_PRICES && CONFIG.STAR_PRICES.premium_spin) || 30);
const PREMIUM_WHEEL_SLICE_DEG = 60;
const PREMIUM_WHEEL_POINTER_DEG = 0;
const PREMIUM_WHEEL_DECEL_MS = 4500;
const PREMIUM_WHEEL_WIN_MODAL_DELAY_MS = 500;
const PREMIUM_WHEEL_EXTRA_ROTATION_DEG = 1800;
const SUPPORT_TELEGRAM_URL = CONFIG.SUPPORT_TELEGRAM_URL || "https://t.me/WealthiaGameBot";

const COIN_STORE_PACKS = Array.isArray(CONFIG.COIN_STORE_PACKS) && CONFIG.COIN_STORE_PACKS.length
  ? CONFIG.COIN_STORE_PACKS
  : [
    { productId: "coins_5000", coins: 5000, stars: 10 },
    { productId: "coins_15000", coins: 15000, stars: 25 },
    { productId: "coins_50000", coins: 50000, stars: 70 },
    { productId: "coins_150000", coins: 150000, stars: 180 },
    { productId: "coins_500000", coins: 500000, stars: 450 }
  ];

const TASK_REFRESH_MS = 12 * 60 * 60 * 1000;
const TICKETS_PER_SCORE = 1000;
const TICKET_EMOJI = "\u{1F39F}\uFE0F";

const CONTEST_SEED_IDS = {
  Marcus: "contest_seed_1",
  Emma: "contest_seed_2",
  Ryan: "contest_seed_3"
};

const onboardingKey = `wealthia_onboarding_${CONFIG.ONBOARDING_VERSION || "v1"}`;

const storageKey = "wealthiaV5State";

const defaultState = {
  coins: 0,
  energy: 1000,
  maxEnergy: 1000,
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
  },
  goldRush: {
    active: false,
    until: 0,
    claimedToday: false,
    canStart: true,
    multiplier: 2,
    durationMinutes: 15
  },
  dailyContest: {
    score: 0,
    date: "",
    resetsAt: "",
    minReferrals: 3,
    eligible: false,
    tickets: 0,
    ticketProgress: {
      current: 0,
      target: TICKETS_PER_SCORE,
      percent: 0
    }
  },
  referrals: {
    count: 0,
    required: 3,
    eligible: false
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
  shopUpgradeButton: document.getElementById("shopUpgradeButton"),
  bankUpgradeButton: document.getElementById("bankUpgradeButton"),
  factoryUpgradeButton: document.getElementById("factoryUpgradeButton"),
  bankCost: document.getElementById("bankCost"),
  factoryCost: document.getElementById("factoryCost"),
  casinoCardDesc: document.getElementById("casinoCardDesc"),
  casinoCost: document.getElementById("casinoCost"),
  casinoSpinCard: document.getElementById("casinoSpinCard"),
  casinoSpinButton: document.getElementById("casinoSpinButton"),
  casinoSpinHint: document.getElementById("casinoSpinHint"),
  premiumSpinCard: document.getElementById("premiumSpinCard"),
  premiumSpinOpenButton: document.getElementById("premiumSpinOpenButton"),
  premiumSpinHint: document.getElementById("premiumSpinHint"),
  casinoUpgradeButton: document.getElementById("casinoUpgradeButton"),
  goldRushMount: document.getElementById("goldRushMount"),
  grandPrizeMount: document.getElementById("grandPrizeMount"),
  empireLevel: document.getElementById("empireLevel"),
  empireLevelStat: document.getElementById("empireLevelStat"),
  toast: document.getElementById("toast"),
  shopBuilding: document.getElementById("shopBuilding"),
  bankBuilding: document.getElementById("bankBuilding"),
  factoryBuilding: document.getElementById("factoryBuilding"),
  tasksPanel: document.getElementById("tasksPanel"),
  earnPanel: document.getElementById("earnPanel"),
  friendsPanel: document.getElementById("friendsPanel"),
  rankPanel: document.getElementById("rankPanel"),
  tournamentPanel: document.getElementById("tournamentPanel"),
  globalLeaderboard: document.getElementById("globalLeaderboard"),
  syncBar: document.getElementById("syncBar"),
  syncBarText: document.getElementById("syncBarText"),
  syncRetryButton: document.getElementById("syncRetryButton")
};

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
      },
      goldRush: {
        ...defaultState.goldRush,
        ...(parsed.goldRush || {})
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

function tapValue() {
  return Math.max(1, Number(state.buildings.shop || 1));
}

function tapPower() {
  const base = tapValue();
  return isBoostActive(state.boosts.tapUntil) ? base * 2 : base;
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

function isBoostActive(until) {
  return Number(until || 0) > Date.now();
}

function formatBoostCountdown(until) {
  const diff = Math.max(0, Number(until || 0) - Date.now());
  if (diff <= 0) return "";

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function boostTimeLeft(until) {
  return formatBoostCountdown(until);
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
  const costLevel = name === "shop" ? level : level + 1;
  return Math.floor(base * Math.pow(1.75, Math.max(0, costLevel - 1)));
}

function goldRushTimeLeft(until) {
  const diff = Math.max(0, Number(until || 0) - Date.now());
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (diff <= 0) return "";
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function grandPrizeEndMs(endDate) {
  const parts = String(endDate || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !n)) return 0;
  return Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
}

function getGrandPrizeConfig() {
  const cfg = CONFIG.GRAND_PRIZE || {};
  if (!cfg.enabled) return null;

  const endMs = grandPrizeEndMs(cfg.endDate);
  if (!endMs || Date.now() > endMs) return null;

  return {
    title: cfg.title || "Grand Prize",
    prizePool: Number(cfg.prizePool || 0),
    currency: cfg.currency || "USD",
    endDate: cfg.endDate,
    endMs,
    qualifyCityValue: Number(cfg.qualifyCityValue || 50000),
    milestones: Array.isArray(cfg.milestones) ? cfg.milestones.map(Number) : [10000, 25000, 50000],
    prizes: {
      first: Number(cfg.prizes?.first || 500),
      second: Number(cfg.prizes?.second || 300),
      third: Number(cfg.prizes?.third || 200)
    },
    channelUrl: String(cfg.channelUrl || CONFIG.PARTNER_CHANNEL_URL || "")
  };
}

function grandPrizeDaysLeft(endMs) {
  const diff = Math.max(0, Number(endMs || 0) - Date.now());
  return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function grandPrizeProgressPercent(current, target) {
  const goal = Math.max(1, Number(target || 1));
  return Math.min(100, Math.round((Number(current || 0) / goal) * 100));
}

function checkGrandPrizeMilestones(current, milestones) {
  const value = Number(current || 0);
  let reached = 0;

  for (const milestone of milestones) {
    if (value >= milestone) reached = milestone;
  }

  if (lastGrandPrizeMilestone === 0) {
    lastGrandPrizeMilestone = reached;
    return;
  }

  if (reached > lastGrandPrizeMilestone) {
    lastGrandPrizeMilestone = reached;
    showToast(`Milestone! ${format(reached)} City Value`);
  }
}

function getDailyPrizeConfig() {
  const cfg = CONFIG.DAILY_PRIZE || {};
  if (!cfg.enabled) return null;

  return {
    title: cfg.title || "Daily Prize",
    prize: Number(cfg.prize || 10),
    currency: cfg.currency || "USD",
    minReferrals: Number(cfg.minReferrals || 3),
    channelUrl: String(cfg.channelUrl || CONFIG.PARTNER_CHANNEL_URL || "")
  };
}

function dailyPrizeTimeLeft(resetsAt) {
  const target = getDailyResetTargetMs(resetsAt);
  const diff = Math.max(0, target - Date.now());
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function getDailyResetTargetMs(resetsAt) {
  const stored = Date.parse(resetsAt || dailyContestResetsAt || state.dailyContest?.resetsAt || "");
  if (stored && !Number.isNaN(stored) && stored > Date.now()) return stored;

  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function switchToEarnTab() {
  const earnTab = document.querySelector('.tab[data-tab="earnPanel"]');
  if (earnTab) earnTab.click();
}

function renderCampaignBanner() {
  if (getDailyPrizeConfig()) {
    renderDailyPrizeBanner();
    return;
  }

  renderGrandPrizeBanner();
}

function switchToFriendsTab() {
  const friendsTab = document.querySelector('.tab[data-tab="friendsPanel"]');
  if (friendsTab) friendsTab.click();
}

function getInviteLink() {
  const botName = CONFIG.BOT_USERNAME || "WealthiaGameBot";
  const userId = backendUserId || "guest";
  return `https://t.me/${botName}?start=ref_${userId}`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}

function todayGainBaselineKey() {
  return `wealthia_daily_gain_baseline_${CONFIG.ONBOARDING_VERSION || "v1"}`;
}

function getTodayGainBaseline() {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const parsed = JSON.parse(localStorage.getItem(todayGainBaselineKey()) || "{}");
    if (parsed.date !== today) return null;
    return Number(parsed.value);
  } catch {
    return null;
  }
}

function ensureTodayGainBaseline() {
  const today = new Date().toISOString().slice(0, 10);
  const current = cityValue();

  if (getTodayGainBaseline() === null) {
    localStorage.setItem(todayGainBaselineKey(), JSON.stringify({
      date: today,
      value: current
    }));
  }
}

function todayGainScore() {
  const serverScore = Number(
    state.dailyScore ||
    dailyContestScore ||
    Number(state.dailyContest?.score || 0)
  );

  return serverScore;
}

function ticketCount() {
  return Number(
    state.tickets ??
    state.dailyContest?.tickets ??
    Math.floor(todayGainScore() / TICKETS_PER_SCORE)
  );
}

function ticketProgress() {
  const progress = state.ticketProgress || state.dailyContest?.ticketProgress;
  if (progress && typeof progress.current === "number") {
    return {
      current: Number(progress.current),
      target: Number(progress.target || TICKETS_PER_SCORE),
      percent: Number(progress.percent || 0)
    };
  }

  const score = todayGainScore();
  const current = score % TICKETS_PER_SCORE;
  return {
    current,
    target: TICKETS_PER_SCORE,
    percent: Math.min(100, Math.round((current / TICKETS_PER_SCORE) * 100))
  };
}

function renderTicketProgressHtml() {
  const progress = ticketProgress();
  const tickets = ticketCount();

  return `
    <div class="daily-prize__tickets">
      <div class="daily-prize__tickets-head">
        <div class="daily-prize__tickets-left">
          <span class="daily-prize__tickets-label">Your Tickets:</span>
          <span class="daily-prize__ticket-icon" aria-hidden="true">&#127915;</span>
          <span class="daily-prize__ticket-count">${tickets}</span>
        </div>
        <span class="daily-prize__tickets-next">Next ticket at: ${format(progress.current)} / ${format(progress.target)} points</span>
      </div>
      <div class="daily-prize__ticket-progress" role="progressbar" aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${progress.percent}%"></span>
      </div>
    </div>
  `;
}

function formatDailyWinnerLabel(winner) {
  if (!winner) return "";

  const rawName = String(winner.username || winner.displayName || winner.label || "Player").trim();
  const handle = rawName.startsWith("@") ? rawName : `@${rawName.replace(/^@/, "")}`;
  const tickets = Number(winner.tickets || 0);

  return `${handle} (${TICKET_EMOJI} ${format(tickets)} Ticket${tickets === 1 ? "" : "s"})`;
}

function renderDailyWinnerBannerHtml(options = {}) {
  if (!dailyLastWinner) return "";

  const winnerLabel = dailyLastWinner.label || formatDailyWinnerLabel(dailyLastWinner);
  if (!winnerLabel) return "";

  const listTop = Boolean(options.listTop);
  return `
    <article class="daily-winner-banner ${listTop ? "daily-winner-banner--list-top" : ""}">
      <span class="daily-winner-banner__icon">&#127942;</span>
      <div class="daily-winner-banner__text">
        <strong>&#127942; Yesterday's $10 Winner: ${winnerLabel}</strong>
      </div>
    </article>
  `;
}

function rowTicketCount(row) {
  if (typeof row.tickets === "number") return Math.max(0, row.tickets);
  const score = Number(row.dailyScore || row.score || 0);
  return Math.floor(score / TICKETS_PER_SCORE);
}

function openRankRulesModal() {
  const modal = document.getElementById("rankRulesModal");
  if (!modal) return;
  modal.hidden = false;
}

function closeRankRulesModal() {
  const modal = document.getElementById("rankRulesModal");
  if (!modal) return;
  modal.hidden = true;
}

function bindRankRulesModal() {
  const modal = document.getElementById("rankRulesModal");
  if (!modal || modal.dataset.bound === "1") return;

  modal.dataset.bound = "1";
  modal.querySelectorAll("[data-close-rank-rules]").forEach((node) => {
    node.addEventListener("click", closeRankRulesModal);
  });
}

function openResetConfirmModal() {
  const modal = document.getElementById("resetConfirmModal");
  if (!modal) return;
  modal.hidden = false;
}

function closeResetConfirmModal() {
  const modal = document.getElementById("resetConfirmModal");
  if (!modal) return;
  modal.hidden = true;
}

function bindResetConfirmModal() {
  const modal = document.getElementById("resetConfirmModal");
  if (!modal || modal.dataset.bound === "1") return;

  modal.dataset.bound = "1";
  modal.querySelectorAll("[data-close-reset-modal]").forEach((node) => {
    node.addEventListener("click", closeResetConfirmModal);
  });

  const confirmButton = document.getElementById("resetConfirmButton");
  if (confirmButton) {
    confirmButton.addEventListener("click", () => {
      closeResetConfirmModal();
      performResetGame();
    });
  }
}

const CONNECTION_ERROR_TOAST =
  "⚠️ Connection error. Please try again or restart the bot.";

const PAYMENT_VERIFYING_TOAST = "Payment is being verified. Please wait...";
const PAYMENT_OPENING_TOAST = "Opening Stars payment...";

let channelGateUrl = "";
let starsInvoiceStatusHandler = null;

function showConnectionErrorToast() {
  if (paymentInProgress || Date.now() < paymentQuietUntil) return;
  showToast(CONNECTION_ERROR_TOAST);
}

function beginPaymentQuietWindow(ms = 90000) {
  paymentQuietUntil = Date.now() + ms;
}

function showChannelGate(url, message) {
  const modal = document.getElementById("channelGateModal");
  const messageNode = document.getElementById("channelGateMessage");
  if (!modal) return;

  channelGateUrl = String(url || CONFIG.PARTNER_CHANNEL_URL || "https://t.me/weathia_official");
  if (messageNode) {
    messageNode.textContent = message || "Please subscribe to our official channel to unlock the game";
  }

  modal.hidden = false;
  document.body.classList.add("channel-gate-active");
}

function hideChannelGate() {
  const modal = document.getElementById("channelGateModal");
  if (!modal) return;

  modal.hidden = true;
  document.body.classList.remove("channel-gate-active");
}

function bindChannelGateModal() {
  const modal = document.getElementById("channelGateModal");
  if (!modal || modal.dataset.bound === "1") return;

  modal.dataset.bound = "1";

  const joinButton = document.getElementById("channelGateJoinButton");
  if (joinButton) {
    joinButton.addEventListener("click", () => {
      openPartnerLink(channelGateUrl || CONFIG.PARTNER_CHANNEL_URL || "https://t.me/weathia_official");
    });
  }

  const retryButton = document.getElementById("channelGateRetryButton");
  if (retryButton) {
    retryButton.addEventListener("click", async () => {
      try {
        backendReconnectAttempts = 0;
        await connectBackend(4);
      } catch {
        showConnectionErrorToast();
      }
    });
  }
}

function updateFriendsInvitePanel(link = getInviteLink()) {
  const box = document.getElementById("friendsInviteLinkBox");
  const text = document.getElementById("friendsInviteLinkText");

  if (text) text.textContent = link;
  if (box) box.hidden = false;
}

async function shareInviteLink() {
  const link = getInviteLink();

  try {
    const copied = await copyTextToClipboard(link);
    updateFriendsInvitePanel(link);
    if (copied) {
      showToast("Invite link copied to clipboard! 📋");
    } else {
      updateFriendsInvitePanel(link);
      showToast("Copy the invite link below.");
    }
  } catch {
    updateFriendsInvitePanel(link);
    showToast("Copy the invite link below.");
  }
}

function renderDailyPrizeCardHtml(options = {}) {
  const prize = getDailyPrizeConfig();
  if (!prize) return "";

  const variant = options.variant || "default";
  const fitClass = variant === "main" || variant === "rank" ? ` daily-prize-card--fit daily-prize-card--fit-${variant}` : "";
  const symbol = prize.currency === "USD" ? "$" : "";
  const score = todayGainScore();
  const referrals = dailyReferralCount || Number(state.referrals?.count || 0);
  const required = prize.minReferrals || dailyReferralsRequired || 3;
  const eligible = dailyPrizeEligible || Boolean(state.referrals?.eligible);
  const timeLeft = dailyPrizeTimeLeft(dailyContestResetsAt || state.dailyContest?.resetsAt);

  return `
    <article class="grand-prize-card daily-prize-card${fitClass} ${eligible ? "" : "daily-prize-card--locked"}">
      <div class="grand-prize-card__head">
        <span class="grand-prize__badge">⚡ ${prize.title}</span>
        <h3>${symbol}${format(prize.prize)} · 3 friends required</h3>
        <p>${timeLeft} left · Friends: ${referrals}/${required}${eligible ? " · Qualified" : " · Not qualified yet"}</p>
      </div>
      <div class="daily-prize__gain-box">
        <span class="daily-prize__gain-label">Your today's score</span>
        <strong class="daily-prize__gain-value">+${format(score)}</strong>
      </div>
      ${renderTicketProgressHtml()}
      ${eligible
    ? `<p class="daily-prize-card__boost-tip">Only players with 3+ invited friends can win. Use ⭐ boosts to climb.</p>`
    : `<p class="daily-prize-card__boost-tip">Invite 3 friends from the Friends tab to join today's Daily $10 Race.</p>`}
      ${prize.channelUrl ? `<button class="grand-prize-card__channel" type="button" data-channel="${prize.channelUrl}">Winner will be announced on the Telegram channel</button>` : ""}
    </article>
  `;
}

function bindDailyPrizeCardActions(mount) {
  if (!mount) return;

  const channelButton = mount.querySelector(".grand-prize-card__channel");
  if (channelButton) {
    channelButton.addEventListener("click", () => {
      openPartnerLink(channelButton.dataset.channel || "");
    });
  }
}

function renderDailyPrizeBanner() {
  const mount = els.grandPrizeMount;
  const prize = getDailyPrizeConfig();
  if (!mount || !prize) {
    if (mount) mount.innerHTML = "";
    return;
  }

  mount.innerHTML = renderDailyPrizeCardHtml({ variant: "main" });
  bindDailyPrizeCardActions(mount);
}

function renderCampaignRankCard() {
  if (getDailyPrizeConfig()) return renderDailyPrizeRankCard();
  return renderGrandPrizeRankCard();
}

function renderDailyPrizeRankCard() {
  return renderDailyPrizeCardHtml({ variant: "rank" });
}

function renderGrandPrizeBanner() {
  const mount = els.grandPrizeMount;
  if (!mount) return;

  const prize = getGrandPrizeConfig();
  if (!prize) {
    mount.innerHTML = "";
    return;
  }

  const current = cityValue();
  checkGrandPrizeMilestones(current, prize.milestones);
  const progress = grandPrizeProgressPercent(current, prize.qualifyCityValue);
  const qualified = current >= prize.qualifyCityValue;
  const daysLeft = grandPrizeDaysLeft(prize.endMs);
  const symbol = prize.currency === "USD" ? "$" : "";

  mount.innerHTML = `
    <article class="grand-prize ${qualified ? "grand-prize--qualified" : ""}">
      <div class="grand-prize__head">
        <span class="grand-prize__badge">🏆 ${prize.title}</span>
        <strong>${symbol}${format(prize.prizePool)} prize pool</strong>
        <small>${daysLeft} day${daysLeft === 1 ? "" : "s"} left · Highest City Value wins</small>
      </div>
      <div class="grand-prize__progress-wrap">
        <div class="grand-prize__progress-label">
          <span>${qualified ? "Qualified" : "Your progress"}</span>
          <span>${format(current)} / ${format(prize.qualifyCityValue)}</span>
        </div>
        <div class="grand-prize__progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
          <span style="width:${progress}%"></span>
        </div>
      </div>
      <p class="grand-prize__hint">Boosts & Gold Rush count · Check <strong>Rank</strong> tab for top players</p>
    </article>
  `;
}

function renderGrandPrizeRankCard() {
  const prize = getGrandPrizeConfig();
  if (!prize) return "";

  const current = cityValue();
  const qualified = current >= prize.qualifyCityValue;
  const daysLeft = grandPrizeDaysLeft(prize.endMs);
  const symbol = prize.currency === "USD" ? "$" : "";
  const leaders = leaderboardTop3.length ? leaderboardTop3 : [];

  const leaderRows = leaders.length
    ? leaders.slice(0, 3).map((row, index) => {
      const amounts = [prize.prizes.first, prize.prizes.second, prize.prizes.third];
      return `
        <li>
          <span>${medalForRank(row.rank || index + 1)} ${row.isYou ? "You" : row.name}</span>
          <strong>${format(row.cityValue)} · ${symbol}${format(amounts[index] || 0)}</strong>
        </li>
      `;
    }).join("")
    : `<li class="grand-prize__empty">Play to appear on the leaderboard</li>`;

  return `
    <article class="grand-prize-card">
      <div class="grand-prize-card__head">
        <span class="grand-prize__badge">🏆 ${prize.title}</span>
        <h3>${symbol}${format(prize.prizePool)} total prizes</h3>
        <p>${daysLeft} days left · ${qualified ? "You are qualified" : `Reach ${format(prize.qualifyCityValue)} to qualify`}</p>
      </div>
      <ol class="grand-prize-card__prizes">
        <li>🥇 ${symbol}${format(prize.prizes.first)}</li>
        <li>🥈 ${symbol}${format(prize.prizes.second)}</li>
        <li>🥉 ${symbol}${format(prize.prizes.third)}</li>
      </ol>
      <ol class="grand-prize-card__leaders">
        ${leaderRows}
      </ol>
      ${prize.channelUrl ? `<button class="grand-prize-card__channel" type="button" data-channel="${prize.channelUrl}">Follow channel for updates</button>` : ""}
    </article>
  `;
}

function renderGoldRushBanner() {
  const mount = els.goldRushMount;
  if (!mount) return;

  const rush = state.goldRush || {};
  const active = Boolean(rush.active);
  const canStart = Boolean(rush.canStart);
  const multiplier = Number(rush.multiplier || 2);
  const duration = Number(rush.durationMinutes || 15);

  if (!active && !canStart) {
    mount.innerHTML = "";
    if (goldRushTimer) {
      window.clearInterval(goldRushTimer);
      goldRushTimer = null;
    }
    return;
  }

  if (active) {
    mount.innerHTML = `
      <article class="gold-rush gold-rush--active">
        <span class="gold-rush__badge">Gold Rush Live</span>
        <strong>${multiplier}x tap coins</strong>
        <small id="goldRushTimer">${goldRushTimeLeft(rush.until)} left</small>
      </article>
    `;

    if (!goldRushTimer) {
      goldRushTimer = window.setInterval(() => {
        if (Number(state.goldRush.until || 0) <= Date.now()) {
          state.goldRush.active = false;
          state.goldRush.canStart = false;
          window.clearInterval(goldRushTimer);
          goldRushTimer = null;
          renderGoldRushBanner();
          render();
          return;
        }

        const timer = document.getElementById("goldRushTimer");
        if (timer) timer.textContent = `${goldRushTimeLeft(state.goldRush.until)} left`;
      }, 1000);
    }
    return;
  }

  mount.innerHTML = `
    <article class="gold-rush">
      <div>
        <span class="gold-rush__badge">Daily Event</span>
        <strong>Gold Rush</strong>
        <small>${multiplier}x tap coins · ${duration} min</small>
      </div>
      <button class="gold-rush__button" type="button" id="startGoldRushButton">Start</button>
    </article>
  `;

  const button = document.getElementById("startGoldRushButton");
  if (button) {
    button.addEventListener("click", startGoldRush);
  }
}

async function startGoldRush() {
  if (!(await ensureBackend())) {
    showToast("Server not connected. Tap Retry at top.");
    return;
  }

  const { ok, result } = await apiPost("/api/gold-rush/start");

  if (!ok) {
    if (result && result.error === "GOLD_RUSH_CLAIMED_TODAY") {
      showToast("Gold Rush already used today.");
    } else if (result && result.error === "GOLD_RUSH_ACTIVE") {
      showToast("Gold Rush is already active.");
    } else {
      showToast("Gold Rush unavailable.");
    }
    return;
  }

  await applyBackendUser(result.user, `Gold Rush! ${state.goldRush.multiplier || 2}x tap for ${state.goldRush.durationMinutes || 15} min`);
}

function render() {
  if (els.coins) els.coins.textContent = format(state.coins);
  if (els.energy) els.energy.textContent = Math.floor(state.energy);
  const maxEnergy = Math.max(1, Number(state.maxEnergy || 1000));
  const energyMaxEl = document.getElementById("energyMax");
  if (energyMaxEl) energyMaxEl.textContent = `/ ${format(maxEnergy)}`;

  if (els.energyBar) {
    const energyRatio = state.energy / maxEnergy;
    els.energyBar.style.width = `${Math.max(0, Math.min(100, energyRatio * 100))}%`;
    els.energyBar.classList.toggle("is-low", energyRatio < 0.2);
  }

  if (els.tapPower) els.tapPower.textContent = tapPower();
  if (els.tapLabel) {
    if (isEndlessEnergy()) {
      els.tapLabel.textContent = isBoostActive(state.boosts.tapUntil) ? "2x · ∞" : "∞ Energy";
    } else {
      els.tapLabel.textContent = state.energy < tapValue() ? "No Energy" : isBoostActive(state.boosts.tapUntil) ? "2x Tap" : "Tap";
    }
  }
  if (els.tapButton) els.tapButton.classList.toggle("no-energy", !isEndlessEnergy() && state.energy < tapValue());

  if (els.cityValue) els.cityValue.textContent = format(cityValue());

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

  if (els.shopUpgradeButton) {
    els.shopUpgradeButton.textContent = `Upgrade ${format(upgradeCost("shop"))}`;
  }
  if (els.bankUpgradeButton) {
    els.bankUpgradeButton.textContent = `Upgrade ${format(upgradeCost("bank"))}`;
  }
  if (els.factoryUpgradeButton) {
    els.factoryUpgradeButton.textContent = `Upgrade ${format(upgradeCost("factory"))}`;
  }

  if (els.casinoUpgradeButton) {
    const casinoCost = format(upgradeCost("casino"));
    els.casinoUpgradeButton.textContent =
      Number(state.buildings.casino || 0) < 1
        ? `Build ${casinoCost}`
        : `Upgrade ${casinoCost}`;
  }

  renderCasinoCard();
  renderCasinoSpin();
  renderPremiumSpinCard();
  renderCampaignBanner();
  renderGoldRushBanner();

  renderDailyTasks();
  renderEarnPanel();
  renderFriendsPanel();
  renderTournamentPanel();
  renderRankPanel();
  startTaskCountdownTimer();
  updateCityVisuals();
  renderSyncBar();
}

function renderCasinoCard() {
  const level = Number(state.buildings.casino || 0);

  if (els.casinoCardDesc) {
    if (level < 1) {
      els.casinoCardDesc.textContent = "Build to unlock Lucky Spin";
    } else {
      const { small, jackpot } = casinoRewardRange(level);
      els.casinoCardDesc.textContent =
        `Lv.${level} · Daily spin ${format(small)}–${format(jackpot)}`;
    }
  }
}

function removeCasinoSpinCard() {
  if (els.casinoSpinCard) els.casinoSpinCard.hidden = true;
}

function ensureCasinoSpinCard() {
  const level = Number(state.buildings.casino || 0);
  if (!els.casinoSpinCard) return;

  if (level < 1) {
    removeCasinoSpinCard();
    return;
  }

  els.casinoSpinCard.hidden = false;
}

function bindCitySpinCards() {
  if (els.casinoSpinButton && els.casinoSpinButton.dataset.bound !== "1") {
    els.casinoSpinButton.dataset.bound = "1";
    els.casinoSpinButton.addEventListener("click", spinCasino);
  }

  if (els.premiumSpinOpenButton && els.premiumSpinOpenButton.dataset.bound !== "1") {
    els.premiumSpinOpenButton.dataset.bound = "1";
    els.premiumSpinOpenButton.addEventListener("click", openPremiumSpinOverlay);
  }
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
      els.casinoSpinHint.textContent = "Come back tomorrow";
    } else {
      const { small, jackpot } = casinoRewardRange(level);
      els.casinoSpinHint.textContent =
        `Win ${format(small)}–${format(jackpot)} coins`;
    }
  }
}

function ensurePremiumSpinCard() {
  if (!els.premiumSpinCard) return;
  bindCitySpinCards();
}

function renderPremiumSpinCard() {
  ensurePremiumSpinCard();
  if (els.premiumSpinHint) {
    els.premiumSpinHint.textContent = `${PREMIUM_SPIN_STARS}⭐ per spin · cash & tickets`;
  }
}

function premiumWheelTargetAngle(sliceId) {
  const segmentCenter = Number(sliceId) * PREMIUM_WHEEL_SLICE_DEG + PREMIUM_WHEEL_SLICE_DEG / 2;
  return (PREMIUM_WHEEL_POINTER_DEG - segmentCenter + 360) % 360;
}

function resetPremiumSpinState() {
  premiumSpinBusy = false;
  premiumSpinAwaitingRetry = false;
  premiumSpinPaid = false;
  premiumSpinWaiting = false;
  premiumWheelRotation = 0;

  const disc = document.getElementById("premiumWheelDisc");
  if (disc) {
    disc.classList.remove("is-spinning", "premium-wheel__disc--loading");
    disc.style.transition = "none";
    disc.style.transform = "rotate(0deg)";
  }

  const spinButton = document.getElementById("premiumWheelSpinButton");
  resetPremiumSpinButton(spinButton);
}

function premiumWheelWinnerSliceId(spinResult) {
  if (!spinResult) return 0;
  if (spinResult.winnerSliceId !== undefined && spinResult.winnerSliceId !== null) {
    return Number(spinResult.winnerSliceId);
  }
  if (spinResult.prize?.winnerSliceId !== undefined && spinResult.prize?.winnerSliceId !== null) {
    return Number(spinResult.prize.winnerSliceId);
  }
  return Number(spinResult.prize?.segmentIndex || 0);
}

function setPremiumWheelRotation(degrees, animate = false) {
  const disc = document.getElementById("premiumWheelDisc");
  if (!disc) return;

  disc.classList.toggle("is-spinning", animate);
  disc.style.transform = `rotate(${degrees}deg)`;
  premiumWheelRotation = degrees;
}

function animatePremiumWheelToSegment(sliceId) {
  return new Promise((resolve) => {
    const disc = document.getElementById("premiumWheelDisc");
    if (!disc) {
      resolve();
      return;
    }

    const currentRotation = premiumWheelRotation;
    const targetAngle = premiumWheelTargetAngle(sliceId);
    const currentAngle = ((currentRotation % 360) + 360) % 360;
    let delta = targetAngle - currentAngle;
    if (delta <= 0) delta += 360;

    const finalRotation = currentRotation + PREMIUM_WHEEL_EXTRA_ROTATION_DEG + delta;

    const finish = () => {
      disc.classList.remove("is-spinning");
      disc.style.transition = "";
      premiumWheelRotation = finalRotation;
      disc.style.transform = `rotate(${finalRotation}deg)`;
      resolve();
    };

    const onTransitionEnd = (event) => {
      if (event.target !== disc || event.propertyName !== "transform") return;
      disc.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallbackTimer);
      finish();
    };

    disc.classList.remove("premium-wheel__disc--loading");
    disc.classList.remove("is-spinning");
    disc.style.transition = "none";
    disc.style.transform = `rotate(${currentRotation}deg)`;
    void disc.offsetHeight;

    disc.addEventListener("transitionend", onTransitionEnd);
    const fallbackTimer = window.setTimeout(() => {
      disc.removeEventListener("transitionend", onTransitionEnd);
      finish();
    }, PREMIUM_WHEEL_DECEL_MS + 150);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        disc.classList.add("is-spinning");
        disc.style.transition = `transform ${PREMIUM_WHEEL_DECEL_MS}ms ease-out`;
        disc.style.transform = `rotate(${finalRotation}deg)`;
      });
    });
  });
}

function openPremiumSpinOverlay() {
  const overlay = document.getElementById("premiumSpinOverlay");
  if (!overlay) return;
  overlay.hidden = false;
  document.body.classList.add("premium-spin-open-body");
  resetPremiumSpinState();
}

function closePremiumSpinOverlay() {
  const overlay = document.getElementById("premiumSpinOverlay");
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove("premium-spin-open-body");
  resetPremiumSpinState();
}

function premiumWinModalCopy(prize) {
  if (!prize) {
    return {
      title: "🎉 Congratulations!",
      body: "Premium spin complete!",
      showClaim: false
    };
  }

  if (prize.type === "cash") {
    const amount = Number(prize.amount || 0);
    const isCashPayout = amount === 2 || amount === 5 || amount === 10;
    return {
      title: "Cash Prize",
      body: isCashPayout
        ? `💰 You won $${amount}! Our support team will process the amount within 3-5 days.`
        : `💰 You won $${amount}!`,
      showClaim: isCashPayout
    };
  }

  if (prize.type === "tickets") {
    const amount = Number(prize.amount || 10);
    return {
      title: "Congratulations!",
      body: `🎉 You won ${amount} Tournament Tickets! They were added to your daily balance.`,
      showClaim: false
    };
  }

  if (prize.type === "coins") {
    const amount = Number(prize.amount || 500);
    return {
      title: "Congratulations!",
      body: `🎉 Congratulations! You won ${format(amount)} Coins!`,
      showClaim: false
    };
  }

  if (prize.type === "boost") {
    return {
      title: "Congratulations!",
      body: "🎉 Congratulations! You won 2x Income Boost for 30 minutes!",
      showClaim: false
    };
  }

  return {
    title: "🎉 Congratulations!",
    body: "Premium spin complete!",
    showClaim: false
  };
}

function openPremiumWinModal(prize) {
  const modal = document.getElementById("premiumCashWinModal");
  const title = document.getElementById("premiumCashWinTitle");
  const desc = document.getElementById("premiumCashWinDesc");
  const notice = modal?.querySelector(".premium-cash-modal__notice");
  const claimButton = document.getElementById("premiumCashClaimButton");
  if (!modal) return;

  const copy = premiumWinModalCopy(prize);
  if (title) title.textContent = copy.title;
  if (desc) desc.textContent = copy.body;
  if (notice) notice.hidden = prize?.type !== "cash";
  if (claimButton) claimButton.hidden = !copy.showClaim;

  modal.hidden = false;
}

async function closePremiumWinModal() {
  const modal = document.getElementById("premiumCashWinModal");
  if (modal) modal.hidden = true;
  if (premiumSpinLastUser) {
    await applyBackendUser(premiumSpinLastUser);
    premiumSpinLastUser = null;
  }
  await fetchUserData();
  render();
}

function openPremiumNoLuckModal() {
  const modal = document.getElementById("premiumNoLuckModal");
  if (!modal) return;
  modal.hidden = false;
}

async function closePremiumNoLuckModal() {
  const modal = document.getElementById("premiumNoLuckModal");
  if (modal) modal.hidden = true;
  await fetchUserData();
}

function bindPremiumSpinUi() {
  const overlay = document.getElementById("premiumSpinOverlay");
  if (!overlay || overlay.dataset.bound === "1") return;

  overlay.dataset.bound = "1";
  overlay.querySelectorAll("[data-close-premium-spin]").forEach((node) => {
    node.addEventListener("click", closePremiumSpinOverlay);
  });

  const spinButton = document.getElementById("premiumWheelSpinButton");
  if (spinButton) {
    spinButton.addEventListener("click", startPremiumSpinPurchase);
  }

  const cashModal = document.getElementById("premiumCashWinModal");
  if (cashModal && cashModal.dataset.bound !== "1") {
    cashModal.dataset.bound = "1";
    cashModal.querySelectorAll("[data-close-premium-cash]").forEach((node) => {
      node.addEventListener("click", () => {
        closePremiumWinModal();
      });
    });
  }

  const claimButton = document.getElementById("premiumCashClaimButton");
  if (claimButton) {
    claimButton.addEventListener("click", () => {
      openPartnerLink(SUPPORT_TELEGRAM_URL);
    });
  }

  const noLuckModal = document.getElementById("premiumNoLuckModal");
  if (noLuckModal && noLuckModal.dataset.bound !== "1") {
    noLuckModal.dataset.bound = "1";
    noLuckModal.querySelectorAll("[data-close-premium-noluck]").forEach((node) => {
      node.addEventListener("click", () => {
        closePremiumNoLuckModal();
      });
    });
  }
}

async function waitForPremiumSpinPayment(attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    const { ok, result } = await apiPostSecure("/api/premium-spin/status");
    if (
      ok &&
      result &&
      result.ready &&
      result.telegramConfirmed &&
      result.chargeId
    ) {
      return true;
    }
    await sleep(800);
  }
  return false;
}

function premiumSpinResultMessage(prize) {
  return premiumWinModalCopy(prize).body;
}

function isValidPremiumSpinResult(result) {
  if (!result || result.success !== true || !result.prize) return false;
  const sliceId = premiumWheelWinnerSliceId(result);
  return Number.isFinite(sliceId) && sliceId >= 0 && sliceId <= 5;
}

function setPremiumSpinButton(spinButton, disabled, label) {
  if (!spinButton) return;
  spinButton.disabled = Boolean(disabled);
  if (label) spinButton.textContent = label;
}

function resetPremiumSpinButton(spinButton) {
  setPremiumSpinButton(spinButton, false, `SPIN (${PREMIUM_SPIN_STARS} ⭐)`);
}

async function executePremiumSpin() {
  const { ok, result, status } = await apiPostSecure("/api/premium-spin");
  if (ok && isValidPremiumSpinResult(result)) {
    return result;
  }

  if (result && result.error === "NO_PAYMENT") {
    showToast("Payment not found. Please pay with Stars first.");
  } else if (result && result.error === "PAYMENT_NOT_SETTLED") {
    showToast("Payment not confirmed by Telegram yet. Wait a few seconds and tap SPIN again.");
  } else if (status === 401) {
    showToast("Session expired. Reopen the game from the bot.");
  } else if (status === 403) {
    showToast(result?.reason === "INIT_DATA_EXPIRED"
      ? "Session expired. Close and reopen from @WealthiaGameBot."
      : "Telegram verification failed. Reopen from @WealthiaGameBot.");
  } else if (status === 429) {
    showToast("Too fast. Wait a second before spinning again.");
  } else if (status === 409 && result?.error === "FRAUD_REPLAY") {
    showToast("This payment was already used. Tap SPIN to pay again.");
    premiumSpinAwaitingRetry = false;
  } else {
    showToast(result?.error ? `Spin failed: ${result.error}` : "Premium spin failed. Tap SPIN to try again.");
  }
  return null;
}

async function requestPremiumSpinResult(maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const spinResult = await executePremiumSpin();
    if (spinResult) return spinResult;
    if (attempt < maxAttempts - 1) {
      await sleep(1200);
    }
  }
  return null;
}

async function finishPremiumSpinResult(spinResult) {
  if (!spinResult || !spinResult.prize) return;

  premiumSpinLastUser = spinResult.user || null;
  const sliceId = premiumWheelWinnerSliceId(spinResult);
  await animatePremiumWheelToSegment(sliceId);
  await sleep(PREMIUM_WHEEL_WIN_MODAL_DELAY_MS);

  const prize = spinResult.prize;
  if (prize.type === "coins" || prize.type === "tickets") {
    await applyBackendUser(spinResult.user);
    premiumSpinLastUser = null;
    await fetchUserData();
    render();
  }

  if (prize.type === "none") {
    await fetchUserData();
    render();
    openPremiumNoLuckModal();
    return;
  }

  if (prize.type === "cash") {
    openPremiumWinModal(prize);
    return;
  }

  openPremiumWinModal(prize);
}

async function isPremiumSpinPaymentReady() {
  const { ok, result } = await apiPostSecure("/api/premium-spin/status");
  return Boolean(
    ok &&
    result &&
    result.ready &&
    result.telegramConfirmed &&
    result.chargeId
  );
}

async function runPremiumSpinAfterPayment() {
  const spinButton = document.getElementById("premiumWheelSpinButton");
  if (premiumSpinBusy) return;

  premiumSpinBusy = true;
  premiumSpinWaiting = true;
  setPremiumSpinButton(spinButton, true, "Loading result...");

  try {
    await waitForTelegramInitData(4000);
    const spinResult = await requestPremiumSpinResult();
    if (!spinResult) {
      premiumSpinAwaitingRetry = await isPremiumSpinPaymentReady();
      premiumSpinPaid = premiumSpinAwaitingRetry;
      return;
    }

    premiumSpinAwaitingRetry = false;
    premiumSpinPaid = false;
    premiumSpinWaiting = false;
    setPremiumSpinButton(spinButton, true, "Spinning...");
    await finishPremiumSpinResult(spinResult);
  } finally {
    premiumSpinBusy = false;
    premiumSpinWaiting = false;
    if (premiumSpinAwaitingRetry) {
      const spinButtonAfter = document.getElementById("premiumWheelSpinButton");
      if (spinButtonAfter) {
        premiumSpinPaid = true;
        spinButtonAfter.textContent = "SPIN (PAID)";
        spinButtonAfter.disabled = false;
      }
    } else {
      resetPremiumSpinButton(spinButton);
    }
  }
}

async function openPremiumSpinInvoice(spinButton) {
  setPremiumSpinButton(spinButton, true, "Opening payment...");

  const opened = await startStarsPurchase("premium_spin", {
    onPaid: async () => {
      setPremiumSpinButton(spinButton, true, "Confirming payment...");
      const ready = await waitForPremiumSpinPayment(60);
      if (!ready) {
        premiumSpinAwaitingRetry = true;
        premiumSpinPaid = true;
        showToast("Payment received. Tap SPIN again in a few seconds.");
        if (spinButton) {
          spinButton.textContent = "SPIN (PAID)";
          spinButton.disabled = false;
        }
        return;
      }

      premiumSpinAwaitingRetry = true;
      premiumSpinPaid = true;
      await runPremiumSpinAfterPayment();
    }
  });

  if (!opened) {
    resetPremiumSpinButton(spinButton);
  } else {
    resetPremiumSpinButton(spinButton);
  }
}

async function startPremiumSpinPurchase() {
  if (premiumSpinBusy || premiumSpinWaiting) return;

  const spinButton = document.getElementById("premiumWheelSpinButton");

  if (premiumSpinAwaitingRetry && premiumSpinPaid && await isPremiumSpinPaymentReady()) {
    await runPremiumSpinAfterPayment();
    return;
  }

  premiumSpinAwaitingRetry = false;
  premiumSpinPaid = false;

  try {
    await openPremiumSpinInvoice(spinButton);
  } catch (error) {
    console.error("PREMIUM_SPIN_PURCHASE_ERROR:", error);
    showToast(error.message || "Premium spin payment failed.");
    resetPremiumSpinButton(spinButton);
  }
}

function getTaskRefreshTargetMs() {
  const now = Date.now();
  const stored = Date.parse(state.dailyTasksNextRefresh || "");
  if (stored && !Number.isNaN(stored) && stored > now) return stored;

  const cycle = Math.floor(now / TASK_REFRESH_MS);
  return (cycle + 1) * TASK_REFRESH_MS;
}

function formatTaskCountdown(ms) {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTaskRefreshCountdown() {
  return formatTaskCountdown(getTaskRefreshTargetMs() - Date.now());
}

function getTaskRefreshLabel() {
  return "Refreshes every 12 hours";
}

function renderTasksPanelHead() {
  return `
    <div class="panel-head panel-head--tasks">
      <div class="panel-head__row">
        <h2>Daily Missions</h2>
        <div class="task-refresh-clock" aria-live="polite" title="Next tasks refresh">
          <span class="task-refresh-clock__icon" aria-hidden="true">&#9201;</span>
          <span id="taskRefreshTimer">${getTaskRefreshCountdown()}</span>
        </div>
      </div>
      <p id="taskRefreshNote" class="panel-head__note">${getTaskRefreshLabel()}</p>
    </div>
  `;
}

function sortDailyTasksForDisplay(tasks) {
  return [...tasks].sort((a, b) => {
    const aClaimed = Boolean(a.claimed);
    const bClaimed = Boolean(b.claimed);
    if (aClaimed === bClaimed) return 0;
    return aClaimed ? 1 : -1;
  });
}

function renderDailyTaskCard(task) {
  const title = task.title || "Daily Task";
  const reward = format(task.reward || 0);
  const progress = Number(task.progress || 0);
  const target = Number(task.target || 1);
  const claimed = Boolean(task.claimed);
  const isSocial = task.type === "social";
  const ready = !claimed && (isSocial || task.ready || progress >= target);
  const buttonText = claimed
    ? "Claimed"
    : isSocial
      ? `+${reward}`
      : ready
        ? `+${reward}`
        : `${format(progress)} / ${format(target)}`;
  const statusText = claimed
    ? "Reward collected"
    : isSocial
      ? "Tap to open link"
      : ready
        ? "Ready to claim"
        : "Progress";
  const icon = isSocial ? "&#128172;" : "&#127873;";

  return `
    <button
      class="task ${claimed ? "completed" : ""} ${isSocial ? "task--social" : ""}"
      type="button"
      data-daily-task="${task.id || ""}"
      ${claimed || !ready ? "disabled" : ""}
    >
      <span><b>${icon} ${title}</b><small>${statusText}</small></span>
      <strong class="${claimed ? "completed" : ""}">${buttonText}</strong>
    </button>
  `;
}

function updateTaskRefreshLabel() {
  const timer = document.getElementById("taskRefreshTimer");
  const countdown = getTaskRefreshCountdown();

  if (timer) timer.textContent = countdown;
}

function startTaskCountdownTimer() {
  updateTaskRefreshLabel();
  if (taskCountdownTimer) return;

  taskCountdownTimer = window.setInterval(() => {
    updateTaskRefreshLabel();

    const next = getTaskRefreshTargetMs();
    if (Date.now() >= next && backendReady) {
      refreshBackendState();
    }
  }, 1000);
}

function renderDailyTasks() {
  const panel = els.tasksPanel;
  const tasks = sortDailyTasksForDisplay(
    Array.isArray(state.dailyTasks) ? state.dailyTasks : []
  );
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
      ${renderTasksPanelHead()}
      <div class="tasks-list">
      ${dailyButton}
      <button class="task" type="button" disabled>
        <span><b>&#127873; Daily tasks preparing</b><small>Connect to backend for missions.</small></span>
        <strong>Soon</strong>
      </button>
      </div>
    `;
    bindDailyRewardButton();
    startTaskCountdownTimer();
    return;
  }

  panel.innerHTML = `
    ${renderTasksPanelHead()}
    <div class="tasks-list">
    ${dailyButton}
    ${tasks.map((task) => renderDailyTaskCard(task)).join("")}
    </div>
  `;

  bindDailyRewardButton();
  startTaskCountdownTimer();
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
    "Premium Video Ad (+300 coins)",
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
    `Quick Ad (+${reward} coins)`,
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

function hasActiveBoost() {
  return (
    isBoostActive(state.boosts.tapUntil) ||
    isBoostActive(state.boosts.incomeUntil) ||
    isBoostActive(state.boosts.endlessUntil)
  );
}

function updateBoostTimerLabels() {
  const panel = els.earnPanel;
  if (!panel) return;

  panel.querySelectorAll("[data-boost-until]").forEach((button) => {
    const until = Number(button.dataset.boostUntil || 0);
    if (!isBoostActive(until)) return;

    const price = button.querySelector(".earn-boost__price");
    if (price) price.textContent = formatBoostCountdown(until);
  });
}

function syncBoostFlagsFromUntil() {
  state.boosts.tapActive = isBoostActive(state.boosts.tapUntil);
  state.boosts.incomeActive = isBoostActive(state.boosts.incomeUntil);
  state.boosts.endlessActive = isBoostActive(state.boosts.endlessUntil);
}

function scheduleBoostRefresh() {
  syncBoostFlagsFromUntil();
  if (!hasActiveBoost()) {
    if (boostRefreshTimer) {
      window.clearInterval(boostRefreshTimer);
      boostRefreshTimer = null;
    }
    return;
  }

  updateBoostTimerLabels();
  if (boostRefreshTimer) return;

  boostRefreshTimer = window.setInterval(() => {
    updateBoostTimerLabels();
    syncBoostFlagsFromUntil();

    if (!hasActiveBoost()) {
      window.clearInterval(boostRefreshTimer);
      boostRefreshTimer = null;
      renderEarnPanel();
      render();
    }
  }, 1000);
}

function renderEarnPanel() {
  const panel = els.earnPanel;
  if (!panel) return;

  const earnRow = (id, title, subtitle, reward, done, doneLabel) => `
    <button class="task earn-task earn-task--compact ${done ? "completed" : ""}" type="button" data-earn="${id}" ${done ? "disabled" : ""}>
      <span><b>${title}</b><small>${subtitle}</small></span>
      <strong class="${done ? "completed" : ""}">${done ? (doneLabel || "Claimed") : `+${reward}`}</strong>
    </button>
  `;

  const starButton = (id, icon, title, stars, until) => {
    const active = isBoostActive(until);
    return `
    <button class="earn-boost ${active ? "earn-boost--active" : ""}" type="button" data-star="${id}" data-boost-until="${until || 0}" ${active ? "disabled" : ""}>
      <span class="earn-boost__icon">${icon}</span>
      <span class="earn-boost__title">${title}</span>
      <span class="earn-boost__price">${active ? formatBoostCountdown(until) : `${stars} ⭐`}</span>
    </button>
  `;
  };

  panel.innerHTML = `
    <div class="earn-compact-head">
      <span class="earn-hero__badge">VIP Earn</span>
      <h2>Multiply Your Fortune</h2>
    </div>
    <div class="earn-rows">
      ${renderBonusAdEarnRow()}
      ${renderAdEarnRow()}
      ${earnRow("channel", "Join Channel", "Subscribe for bonus coins", 500, state.tasks.channel)}
    </div>
    <section class="earn-boosts">
      <div class="earn-boosts__head">
        <span>Premium Boosts</span>
        <small>Telegram Stars · 30 min</small>
      </div>
      <div class="earn-boosts__grid">
        ${starButton("refill_energy", "&#x26A1;", "Refill", starPrice("refill_energy"), 0)}
        ${starButton("tap_boost_30", "&#x1F4AA;", "2x Tap", starPrice("tap_boost_30"), state.boosts.tapUntil)}
        ${starButton("endless_energy_30", "&#x1F525;", "Endless", starPrice("endless_energy_30"), state.boosts.endlessUntil)}
        ${starButton("income_boost_30", "&#x1F4C8;", "2x Income", starPrice("income_boost_30"), state.boosts.incomeUntil)}
      </div>
    </section>
    <section class="earn-promo">
      <div class="earn-boosts__head">
        <span>Promo Code</span>
        <small>Enter a valid code for bonus rewards</small>
      </div>
      <form class="earn-promo__form" id="promoRedeemForm">
        <input class="earn-promo__input" id="promoCodeInput" type="text" maxlength="32" placeholder="START2026" autocomplete="off" />
        <button class="earn-promo__button" type="submit" id="promoRedeemButton">Redeem</button>
      </form>
    </section>
  `;

  scheduleBoostRefresh();
  bindPromoRedeemForm();
  prefetchEarnBoostInvoices();
}

function bindPromoRedeemForm() {
  const form = document.getElementById("promoRedeemForm");
  if (!form || form.dataset.bound === "1") return;

  form.dataset.bound = "1";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = document.getElementById("promoCodeInput");
    const button = document.getElementById("promoRedeemButton");
    const code = input ? String(input.value || "").trim() : "";

    if (!code) {
      showToast("Enter a promo code.");
      return;
    }

    if (!(await ensureBackend())) {
      showToast("Server not connected. Try again.");
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Checking...";
    }

    try {
      const { ok, result } = await apiPostSecure("/api/promo/redeem", { code });

      if (!ok || !result) {
        const error = result?.error || "INVALID_CODE";
        if (error === "ALREADY_REDEEMED") showToast("You already used this code.");
        else if (error === "CODE_EXHAUSTED") showToast("This promo code is fully used.");
        else if (error === "INVALID_CODE") showToast("Invalid promo code.");
        else showToast("Could not redeem promo code.");
        return;
      }

      if (result.user) {
        await applyBackendUser(result.user, "Promo code redeemed!");
      } else {
        showToast("Promo code redeemed!");
      }

      if (input) input.value = "";
      renderEarnPanel();
    } catch (error) {
      console.error("PROMO_REDEEM_ERROR:", error);
      showToast("Could not redeem promo code.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Redeem";
      }
    }
  });
}

function leaderboardCandidateKey(row) {
  if (row.isYou) return "__you__";

  const userId = String(row.userId || "");
  if (userId.startsWith("contest_seed")) return userId;

  const seedId = CONTEST_SEED_IDS[row.name];
  if (seedId) return seedId;

  if (userId) return userId;
  return `name:${String(row.name || "").toLowerCase()}`;
}

const SYSTEM_BOT_REFRESH_MS = 12 * 60 * 1000;
let contestSeedRefreshTimer = null;

function startContestSeedRefresh() {
  if (contestSeedRefreshTimer || !getDailyPrizeConfig()) return;

  contestSeedRefreshTimer = window.setInterval(() => {
    if (backendReady) {
      loadLeaderboard();
      return;
    }
    renderRankPanel();
    renderCampaignBanner();
  }, SYSTEM_BOT_REFRESH_MS);
}

function renderFriendsPanel() {
  const panel = els.friendsPanel;
  if (!panel) return;

  const prize = getDailyPrizeConfig();
  const referrals = dailyReferralCount || Number(state.referrals?.count || 0);
  const required = prize?.minReferrals || dailyReferralsRequired || 3;
  const eligible = dailyPrizeEligible || Boolean(state.referrals?.eligible);
  const referralCoins = referrals * 500;
  const link = getInviteLink();
  const progressPct = Math.min(100, Math.round((referrals / required) * 100));
  const timeLeft = dailyPrizeTimeLeft(dailyContestResetsAt || state.dailyContest?.resetsAt);

  panel.innerHTML = `
    <button class="wide-button friends-copy-hero" id="inviteButton" type="button">
      Copy invite link &amp; share
    </button>

    <div class="friends-link-box" id="friendsInviteLinkBox">
      <code id="friendsInviteLinkText">${link}</code>
    </div>

    <article class="friends-stat-row" aria-label="Referral stats">
      <div class="friends-stat friends-stat--info">
        <span>Friends</span>
        <strong>${referrals}/${required}</strong>
      </div>
      <div class="friends-stat friends-stat--info">
        <span>Coins</span>
        <strong>+${format(referralCoins)}</strong>
      </div>
      <div class="friends-stat friends-stat--info">
        <span>Prize</span>
        <strong class="${eligible ? "friends-stat__on" : "friends-stat__off"}">${eligible ? "On" : "Off"}</strong>
      </div>
      <div class="friends-stat friends-stat--info">
        <span>Each</span>
        <strong>+500</strong>
      </div>
    </article>

    <article class="friends-progress-card">
      <div class="friends-progress-card__head">
        <span>⚡ Daily $10 Race</span>
        <strong>${timeLeft}</strong>
      </div>
      <div class="friends-progress" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${progressPct}%"></span>
      </div>
      ${eligible
    ? `<p class="friends-progress-card__qualified">&#127881; Congratulations! You have qualified for the Daily Race. Keep earning tickets to boost your chances!</p>`
    : `<p class="friends-progress-card__hint">Invite ${Math.max(0, required - referrals)} more friend(s) to unlock the $10 contest.</p>`}
    </article>

    <article class="friends-tips">
      <p><strong>1.</strong> Send your link to friends in Telegram</p>
      <p><strong>2.</strong> They subscribe to the official Wealthia Telegram channel</p>
      <p><strong>3.</strong> They open the game and you earn +500 coins for each one</p>
    </article>
  `;

  const inviteButton = document.getElementById("inviteButton");
  if (inviteButton) {
    inviteButton.addEventListener("click", () => shareInviteLink());
  }
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
        <p>No bracket tournament for your Empire Level right now. Check back soon.</p>
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
        <span>Bracket: ${t.bracketLabel || "All levels"}</span>
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

function renderRankRow(row, mode = "global", options = {}) {
  const daily = mode === "daily";
  const rank = Number(row.rank || 0);
  const tickets = rowTicketCount(row);
  const value = daily
    ? tickets
    : Number(row.cityValue || 0);
  const display = daily
    ? `<span class="rank__ticket-icon">${TICKET_EMOJI}</span> ${format(tickets)} Ticket${tickets === 1 ? "" : "s"}`
    : format(value);
  const label = row.isYou
    ? (options.isYourPlaceRow ? `Your place · ${ordinalRank(rank)}` : "You")
    : row.name;
  const ticketClass = daily
    ? `rank__tickets${row.isYou ? " rank__tickets--you" : ""}`
    : "";

  return `
    <li class="${row.isYou ? "rank__you" : ""}">
      <span class="rank__medal">${rankMark(rank)}</span>
      <span>${label}</span>
      <strong class="${ticketClass}">${display}</strong>
    </li>
  `;
}

function isDailyPodiumEligible(row) {
  const score = Number(row?.dailyScore ?? 0);
  if (score <= 0) return false;
  if (typeof row?.tickets === "number") return row.tickets >= 1;
  return rowTicketCount({ ...row, dailyScore: score }) >= 1;
}

function getDailyPodiumTop3() {
  const rows = Array.isArray(dailyLeaderboardTop3) ? dailyLeaderboardTop3 : [];
  return rows
    .filter(isDailyPodiumEligible)
    .sort((a, b) => Number(a.rank || 99) - Number(b.rank || 99))
    .slice(0, 3)
    .map((row) => ({
      ...row,
      dailyScore: Number(row.dailyScore || row.score || 0),
      name: row.isYou ? "You" : (row.name || "Player")
    }));
}

function rankMark(rank) {
  const value = Number(rank || 0);
  if (value === 1) return "&#x1F947;";
  if (value === 2) return "&#x1F948;";
  if (value === 3) return "&#x1F949;";
  return `${value}.`;
}

function podiumDisplayScore(row, dailyMode) {
  if (dailyMode) {
    const score = Number(row.dailyScore || row.score || 0);
    return `+${format(score)}`;
  }
  return format(Number(row.cityValue || 0));
}

function podiumDisplayName(row) {
  if (!row) return "—";
  return row.isYou ? "You" : (row.name || "Player");
}

function normalizePodiumTop3(rows, dailyMode) {
  const sorted = [...(rows || [])]
    .sort((a, b) => Number(a.rank || 99) - Number(b.rank || 99))
    .slice(0, 3);

  const byRank = { 1: null, 2: null, 3: null };
  sorted.forEach((row, index) => {
    const rank = Number(row.rank || index + 1);
    if (rank >= 1 && rank <= 3) byRank[rank] = row;
  });

  return byRank;
}

function renderPodiumSlot(row, place, dailyMode) {
  const empty = !row;
  const name = empty ? "—" : podiumDisplayName(row);
  const score = empty ? "—" : podiumDisplayScore(row, dailyMode);

  return `
    <article class="rank-podium__slot rank-podium__slot--${place}${empty ? " rank-podium__slot--empty" : ""}${row && row.isYou ? " rank-podium__slot--you" : ""}">
      <span class="rank-podium__medal">${rankMark(place)}</span>
      <span class="rank-podium__name">${name}</span>
      <span class="rank-podium__score">${score}</span>
    </article>
  `;
}

function renderPodiumHtml(rows, dailyMode) {
  const byRank = normalizePodiumTop3(rows, dailyMode);

  return `
    <section class="rank-podium" aria-label="Top 3 leaders">
      ${renderPodiumSlot(byRank[2], 2, dailyMode)}
      ${renderPodiumSlot(byRank[1], 1, dailyMode)}
      ${renderPodiumSlot(byRank[3], 3, dailyMode)}
    </section>
  `;
}

function resolveYourRankRow(dailyMode) {
  if (dailyMode) {
    const podiumTop3 = getDailyPodiumTop3();
    const youOnPodium = podiumTop3.find((row) => row.isYou);
    if (youOnPodium) return youOnPodium;

    if (dailyLeaderboardYou) {
      return {
        ...dailyLeaderboardYou,
        name: "You",
        isYou: true,
        dailyScore: Number(dailyLeaderboardYou.dailyScore ?? dailyContestScore ?? 0)
      };
    }

    const youInRows = dailyLeaderboardRows.find((row) => row.isYou);
    if (youInRows) {
      return {
        ...youInRows,
        name: "You",
        isYou: true,
        dailyScore: Number(youInRows.dailyScore ?? dailyContestScore ?? 0)
      };
    }

    const score = Number(dailyContestScore || state.dailyContest?.score || 0);
    const rank = Number(dailyYourRank || 0) || (score > 0 ? podiumTop3.length + 1 : 0);

    return {
      rank: rank > 0 ? rank : 0,
      name: "You",
      dailyScore: score,
      isYou: true
    };
  }

  if (leaderboardYou) return leaderboardYou;

  return {
    rank: 1,
    name: "You",
    cityValue: cityValue(),
    isYou: true
  };
}

function renderYourRankRowHtml(row, dailyMode) {
  const rank = Number(row.rank || 0);
  const rankText = rank > 0 ? `#${rank}` : "—";
  const scoreText = podiumDisplayScore(row, dailyMode);

  return `
    <div class="rank-you-row">
      <span class="rank-you-row__star" aria-hidden="true">&#11088;</span>
      <span class="rank-you-row__text">Your Rank: ${rankText} | Score: ${scoreText}</span>
    </div>
  `;
}

function getTicketStorePacks() {
  const defaults = [
    { id: "tickets_1", tickets: 1, stars: 5 },
    { id: "tickets_5", tickets: 5, stars: 20 },
    { id: "tickets_10", tickets: 10, stars: 35 },
    { id: "tickets_50", tickets: 50, stars: 150 },
    { id: "tickets_100", tickets: 100, stars: 250 }
  ];
  const packs = CONFIG.TICKET_STORE_PACKS;
  return Array.isArray(packs) && packs.length ? packs : defaults;
}

function renderTicketStoreHtml() {
  if (!getDailyPrizeConfig()) return "";

  const packs = getTicketStorePacks();
  if (!packs.length) return "";

  return `
    <section class="ticket-store" aria-label="Buy tournament tickets">
      <h3 class="ticket-store__title">&#128142; BUY TICKETS (Stars)</h3>
      <div class="ticket-store__row">
        ${packs.map((pack) => `
          <button
            class="ticket-store__pack"
            type="button"
            data-ticket-pack="${pack.id}"
            data-ticket-count="${pack.tickets}"
            data-ticket-stars="${pack.stars}"
          >
            <span class="ticket-store__amount">${pack.tickets}x</span>
            <span class="ticket-store__icon" aria-hidden="true">&#127915;</span>
            <span class="ticket-store__price">${pack.stars} &#11088;</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function showTicketConfetti() {
  const layer = document.createElement("div");
  layer.className = "ticket-confetti";
  layer.setAttribute("aria-hidden", "true");

  const colors = ["#f5c451", "#ffd86b", "#ffffff", "#9b7bff", "#4ade80"];

  for (let i = 0; i < 42; i += 1) {
    const piece = document.createElement("span");
    piece.className = "ticket-confetti__piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    piece.style.background = colors[i % colors.length];
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 2800);
}

function bindRankPanelActions(panel) {
  if (!panel) return;

  const channelButton = panel.querySelector(".grand-prize-card__channel");
  if (channelButton) {
    channelButton.addEventListener("click", () => {
      openPartnerLink(channelButton.dataset.channel || "");
    });
  }

  const rulesButton = panel.querySelector("#rankRulesBtn");
  if (rulesButton) {
    rulesButton.addEventListener("click", openRankRulesModal);
  }

  panel.querySelectorAll("[data-ticket-pack]").forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.dataset.ticketPack;
      const count = Number(button.dataset.ticketCount || 0);
      if (productId && count > 0) {
        buyTicketPack(productId, count, button);
      }
    });
  });

  bindRankRulesModal();
}

function renderRankPanel() {
  if (paymentInProgress) return;

  const panel = els.globalLeaderboard;
  if (!panel) return;

  const dailyMode = Boolean(getDailyPrizeConfig());
  setRankPanelLayoutMode(true);

  const offlineBanner = !backendReady && !getTelegramInitData()
    ? `<p class="rank-offline-note">Open in Telegram for live sync.</p>`
    : "";

  const top3 = dailyMode
    ? getDailyPodiumTop3()
    : (leaderboardTop3.length
      ? leaderboardTop3
      : [{
        rank: 1,
        name: "You",
        cityValue: cityValue(),
        isYou: true
      }]);

  const youRow = resolveYourRankRow(dailyMode);

  panel.innerHTML = `
    ${offlineBanner}
    <div class="rank-stack">
      ${dailyMode ? renderDailyPrizeCardHtml({ variant: "rank" }) : ""}
      ${renderPodiumHtml(top3, dailyMode)}
      ${renderYourRankRowHtml(youRow, dailyMode)}
      ${dailyMode ? renderTicketStoreHtml() : ""}
      ${dailyMode ? `
        <div class="rank-daily-rules">
          <button class="rank-rules-btn" type="button" id="rankRulesBtn">Rules</button>
        </div>
      ` : ""}
    </div>
  `;

  bindRankPanelActions(panel);
  prefetchTicketStoreInvoices();
}

function setRankPanelLayoutMode() {
  const rankPanel = document.getElementById("rankPanel");
  const leaderboard = els.globalLeaderboard;
  if (rankPanel) {
    rankPanel.classList.add("rank-panel--daily");
    rankPanel.classList.remove("rank-panel--scroll");
  }
  if (leaderboard) {
    leaderboard.classList.add("rank-leaderboard--daily");
  }
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

const BUILDING_LABELS = {
  shop: "Shop",
  bank: "Bank",
  factory: "Factory",
  casino: "Casino"
};

function summarizeAutoUpgrades(autoUpgrades) {
  const latest = new Map();

  for (const item of autoUpgrades) {
    if (!item || !item.building) continue;
    latest.set(item.building, Number(item.level || 0));
  }

  return [...latest.entries()].map(([building, level]) => ({
    building,
    label: BUILDING_LABELS[building] || building,
    level
  }));
}

function showOfflineModal(payload, autoUpgrades = []) {
  const gross = Math.floor(Number(payload?.offlineEarnings ?? payload ?? 0));
  const cashAdded = Math.floor(Number(payload?.offlineCashAdded ?? payload ?? 0));
  const upgrades = summarizeAutoUpgrades(Array.isArray(autoUpgrades) ? autoUpgrades : []);

  if (gross < 1 && upgrades.length < 1) return;

  const modal = document.getElementById("offlineModal");
  const text = document.getElementById("offlineModalText");
  const list = document.getElementById("offlineModalUpgrades");
  if (!modal || !text) return;

  text.innerHTML = "";

  if (cashAdded > 0) {
    text.innerHTML = `While you were away, your city and managers earned you:<br><strong>+${format(cashAdded)} Wealth Coins</strong>`;
  } else if (gross > 0) {
    text.textContent = "While you were away, your city and managers kept earning for you.";
  } else {
    text.textContent = "While you were away, your Bank worked on your city.";
  }

  if (upgrades.length) {
    const upgradeNote = document.createElement("p");
    upgradeNote.className = "offline-modal__auto-note";
    upgradeNote.textContent =
      "Your Bank also auto-upgraded your lowest buildings to increase your passive income!";
    text.appendChild(upgradeNote);
  }

  if (list) {
    if (upgrades.length) {
      list.innerHTML = upgrades.map((item) => `
        <li>
          <strong>${item.label}</strong>
          <span>Lv. ${item.level}</span>
        </li>
      `).join("");
      list.hidden = false;
    } else {
      list.innerHTML = "";
      list.hidden = true;
    }
  }

  modal.hidden = false;
}

function setupOfflineModal() {
  const modal = document.getElementById("offlineModal");
  const claim = document.getElementById("offlineModalClaim");
  if (!modal || !claim) return;

  claim.addEventListener("click", () => {
    modal.hidden = true;
  });
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
  state.energy = Number(game.energy || game.currentEnergy || 0);
  state.maxEnergy = Number(game.maxEnergy || 1000);
  state.dailyScore = Number(game.dailyScore || game.dailyContest?.score || 0);
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
    syncBoostFlagsFromUntil();
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

  if (game.goldRush) {
    state.goldRush = {
      active: Boolean(game.goldRush.active),
      until: Number(game.goldRush.until || 0),
      claimedToday: Boolean(game.goldRush.claimedToday),
      canStart: Boolean(game.goldRush.canStart),
      multiplier: Number(game.goldRush.multiplier || 2),
      durationMinutes: Number(game.goldRush.durationMinutes || 15)
    };
  }

  if (game.dailyContest) {
    state.dailyContest = {
      score: Number(game.dailyContest.score || game.dailyScore || 0),
      date: game.dailyContest.date || "",
      resetsAt: game.dailyContest.resetsAt || "",
      minReferrals: Number(game.dailyContest.minReferrals || 3),
      eligible: Boolean(game.dailyContest.eligible),
      tickets: Number(game.dailyContest.tickets || game.tickets || 0),
      ticketProgress: game.dailyContest.ticketProgress || game.ticketProgress || null
    };
    dailyContestScore = Number(game.dailyContest.score || game.dailyScore || 0);
    dailyContestResetsAt = game.dailyContest.resetsAt || "";
    dailyReferralsRequired = Number(game.dailyContest.minReferrals || 3);
    dailyPrizeEligible = Boolean(game.dailyContest.eligible);
    state.tickets = Number(game.tickets || game.dailyContest.tickets || 0);
    state.ticketProgress = state.dailyContest.ticketProgress;
  }

  if (typeof game.tickets === "number") {
    state.tickets = Number(game.tickets);
  }

  if (game.ticketProgress) {
    state.ticketProgress = game.ticketProgress;
  }

  if (game.referrals) {
    state.referrals = {
      count: Number(game.referrals.count || 0),
      required: Number(game.referrals.required || 3),
      eligible: Boolean(game.referrals.eligible)
    };
    dailyReferralCount = Number(game.referrals.count || 0);
    dailyReferralsRequired = Number(game.referrals.required || 3);
    dailyPrizeEligible = Boolean(game.referrals.eligible);
  }
}

function isTelegramWebApp() {
  return Boolean(window.Telegram && window.Telegram.WebApp);
}

async function waitForTelegramInitData(maxMs = 5000) {
  if (!isTelegramWebApp()) return "";

  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const initData = getTelegramInitData();
    if (initData) return initData;
    await sleep(150);
  }

  return getTelegramInitData();
}

function authErrorMessage(reason) {
  switch (reason) {
    case "BOT_TOKEN_MISSING":
      return "Server bot token missing. Admin must fix Render env.";
    case "INIT_DATA_MISSING":
      return "Open Wealthia from @WealthiaGameBot menu, not a direct link.";
    case "INIT_DATA_HASH_MISMATCH":
      return "Bot token mismatch. Reopen from @WealthiaGameBot.";
    case "INIT_DATA_EXPIRED":
      return "Session expired. Close and reopen from Telegram.";
    case "INIT_DATA_NO_USER":
    case "INIT_DATA_INVALID":
      return "Telegram login invalid. Reopen from @WealthiaGameBot.";
    default:
      return getTelegramInitData()
        ? "Login failed. Close and reopen from Telegram."
        : "Open the game inside Telegram.";
  }
}

async function fetchBackendHealth() {
  try {
    const response = await fetch(`${API_URL}/health`, { method: "GET", cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function renderSyncBar() {
  if (!els.syncBar) return;

  if (backendReady) {
    els.syncBar.hidden = true;
    return;
  }

  els.syncBar.hidden = false;
  if (els.syncBarText) {
    if (!isTelegramWebApp()) {
      els.syncBarText.textContent = "Offline mode — tap works, rewards need Telegram.";
    } else if (!getTelegramInitData()) {
      els.syncBarText.textContent = "Open from @WealthiaGameBot Play button.";
    } else {
      els.syncBarText.textContent = "Connecting to server...";
    }
  }
}

let ensureBackendPromise = null;

async function ensureBackend(retries = 4) {
  if (backendReady) return true;

  if (!ensureBackendPromise) {
    ensureBackendPromise = connectBackend(retries).finally(() => {
      ensureBackendPromise = null;
    });
  }

  return ensureBackendPromise;
}

function getTelegramInitData() {
  const tg = window.Telegram && window.Telegram.WebApp;
  return tg && tg.initData ? String(tg.initData) : "";
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

const API_FETCH_TIMEOUT_MS = 25000;
const INVOICE_FETCH_TIMEOUT_MS = 15000;
const TAP_BATCH_FLUSH_MS = 2000;
const TAP_BATCH_MAX = 15;
const STARS_INVOICE_CACHE_TTL_MS = 4 * 60 * 1000;
const starsInvoiceCache = new Map();

let tapBatchCount = 0;
let tapBatchTimer = null;
let tapBatchFlushing = false;
let tapBatchDelta = null;

function emptyTapDelta() {
  return { coins: 0, taps: 0, energy: 0, dailyScore: 0 };
}

function cloneTapDelta(delta) {
  return delta ? { ...delta } : emptyTapDelta();
}

function hasTapDelta(delta) {
  return Boolean(delta && (
    delta.coins ||
    delta.taps ||
    delta.energy ||
    delta.dailyScore
  ));
}

function addTapDelta(current, delta) {
  const next = cloneTapDelta(current);
  if (!delta) return next;
  next.coins += Number(delta.coins || 0);
  next.taps += Number(delta.taps || 0);
  next.energy += Number(delta.energy || 0);
  next.dailyScore += Number(delta.dailyScore || 0);
  return next;
}

function applyTapDelta(delta) {
  if (!hasTapDelta(delta)) return;

  state.coins = Math.max(0, Number(state.coins || 0) + Number(delta.coins || 0));
  state.taps = Math.max(0, Number(state.taps || 0) + Number(delta.taps || 0));
  state.energy = Math.max(0, Math.min(
    Number(state.maxEnergy || 0) || Number(state.energy || 0),
    Number(state.energy || 0) + Number(delta.energy || 0)
  ));
  state.dailyScore = Math.max(0, Number(state.dailyScore || 0) + Number(delta.dailyScore || 0));
  if (state.dailyContest) state.dailyContest.score = state.dailyScore;
  dailyContestScore = state.dailyScore;
}

function rollbackTapDelta(delta) {
  if (!hasTapDelta(delta)) return;
  applyTapDelta({
    coins: -Number(delta.coins || 0),
    taps: -Number(delta.taps || 0),
    energy: -Number(delta.energy || 0),
    dailyScore: -Number(delta.dailyScore || 0)
  });
}

function hasPendingTapBatch() {
  return tapBatchCount > 0 || tapBatchFlushing;
}

function shouldShowSyncErrorToast(silent) {
  return !silent && !paymentInProgress;
}

async function refreshPaymentSession() {
  const { ok, result } = await apiPost("/api/session", {
    initData: getTelegramInitData(),
    telegramUser: getTelegramUser(),
    referrerId: getReferrerId()
  });

  if (ok && result && !result.error && result.token) {
    backendSessionToken = result.token;
    backendUserId = result.userId || backendUserId;
    backendReady = true;
    return true;
  }

  return false;
}

async function apiPost(path, body = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_FETCH_TIMEOUT_MS);

  try {
    const headers = { "Content-Type": "application/json" };
    if (backendSessionToken) {
      headers.Authorization = `Bearer ${backendSessionToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    let result = null;
    const raw = await response.text();

    if (raw) {
      try {
        result = JSON.parse(raw);
      } catch {
        result = { error: "BAD_RESPONSE", message: "Server returned an invalid response." };
      }
    }

    return { ok: response.ok, status: response.status, result };
  } catch (error) {
    if (error && error.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        result: { error: "TIMEOUT", message: "Server is waking up. Wait a few seconds and try again." }
      };
    }
    return {
      ok: false,
      status: 0,
      result: { error: "CONNECTION_ERROR", message: CONNECTION_ERROR_TOAST }
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function apiPostSecure(path, body = {}) {
  const initData = getTelegramInitData();
  if (!initData) {
    return {
      ok: false,
      status: 403,
      result: { error: "TELEGRAM_AUTH_FAILED", reason: "INIT_DATA_MISSING" }
    };
  }

  return apiPost(path, {
    ...body,
    initData
  });
}

async function applyBackendUser(user, message) {
  if (!user || !user.game) return false;

  syncFromBackend(user);
  backendReady = true;
  ensureTodayGainBaseline();
  saveState();
  render();
  await loadLeaderboard();

  if (message) showToast(message);
  if (user.game) {
    const offlineEarnings = Number(user.game.offlineEarnings || 0);
    const autoUpgrades = Array.isArray(user.game.autoUpgrades) ? user.game.autoUpgrades : [];
    if (offlineEarnings > 0 || autoUpgrades.length > 0) {
      showOfflineModal(
        {
          offlineEarnings,
          offlineCashAdded: Number(user.game.offlineCashAdded || 0)
        },
        autoUpgrades
      );
    }
  }
  startOnboardingIfNeeded();
  prefetchStarsPaymentLinks();
  return true;
}

let backendReconnectTimer = null;
let backendReconnectAttempts = 0;

function scheduleBackendReconnect() {
  if (backendReconnectTimer || !getTelegramInitData()) return;

  const delay = Math.min(5000 + backendReconnectAttempts * 2000, 15000);
  backendReconnectAttempts += 1;

  backendReconnectTimer = window.setTimeout(async () => {
    backendReconnectTimer = null;
    if (paymentInProgress) {
      scheduleBackendReconnect();
      return;
    }
    await connectBackend(4);
  }, delay);
}

async function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function wakeBackend() {
  try {
    await fetch(`${API_URL}/ping`, { method: "GET", cache: "no-store" });
  } catch {
    // Render cold start — session retry will follow.
  }
}

async function warmBackendForPayment(attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const ping = await fetch(`${API_URL}/ping`, { method: "GET", cache: "no-store" });
      if (!ping.ok) {
        await sleep(900 * (attempt + 1));
        continue;
      }

      const health = await fetch(`${API_URL}/health`, { method: "GET", cache: "no-store" });
      if (!health.ok) {
        await sleep(900 * (attempt + 1));
        continue;
      }

      await fetch(`${API_URL}/api/stars/products`, { method: "GET", cache: "no-store" });
      return true;
    } catch {
      await sleep(900 * (attempt + 1));
    }
  }

  return false;
}

async function postInvoiceRequest(productId, options = {}) {
  const normalizedProductId = String(productId || "").trim();
  const initData = options.initData ?? getTelegramInitData();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), INVOICE_FETCH_TIMEOUT_MS);

  try {
    const headers = { "Content-Type": "application/json" };
    if (backendSessionToken) {
      headers.Authorization = `Bearer ${backendSessionToken}`;
    }

    const body = { productId: normalizedProductId };
    if (initData) body.initData = initData;

    const response = await fetch(`${API_URL}/api/stars/invoice`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    let result = null;
    const raw = await response.text();
    if (raw) {
      try {
        result = JSON.parse(raw);
      } catch {
        result = { error: "BAD_RESPONSE", message: "Server returned an invalid response." };
      }
    }

    return { ok: response.ok, status: response.status, result };
  } catch (error) {
    console.error("INVOICE_REQUEST_FAILED:", normalizedProductId, error);
    if (error && error.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        result: { error: "TIMEOUT", message: "Payment server is waking up. Wait a few seconds and try again." }
      };
    }
    return {
      ok: false,
      status: 0,
      result: {
        error: "NETWORK_ERROR",
        message: "Could not reach payment server. Wait a moment and try again."
      }
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchStarsInvoice(productId, initData) {
  return postInvoiceRequest(productId, { initData });
}

function starsInvoiceErrorMessage(result, status) {
  if (result?.error === "TELEGRAM_AUTH_FAILED") {
    return "Telegram auth missing. Close and reopen the game.";
  }
  if (result?.error === "STARS_NOT_CONFIGURED") {
    return "Stars payments not configured yet.";
  }
  if (result?.error === "STARS_TEST_MODE_DISABLED") {
    return "Stars payments are unavailable in test mode.";
  }
  if (result?.error === "SESSION_EXPIRED") {
    return "Session expired. Close and reopen the game.";
  }
  if (result?.error === "BAD_PRODUCT") {
    return "This pack is not available yet. Refresh the game.";
  }
  if (result?.error === "INVOICE_RATE_LIMITED") {
    return "Please wait a moment before starting another payment.";
  }
  if (result?.error === "CONNECTION_ERROR") {
    return "Payment server unreachable. Wait 10 seconds and reopen the game.";
  }
  if (result?.error === "INVOICE_CREATE_FAILED" || result?.error === "INVALID_INVOICE_LINK" || result?.error === "INVOICE_ERROR") {
    return result?.message || "Could not create Stars payment. Try again.";
  }
  if (result?.error === "TIMEOUT" || result?.error === "NETWORK_ERROR" || status === 0) {
    return result?.message || "Payment server is waking up. Wait 10 seconds and try again.";
  }
  if (result?.message) {
    const msg = String(result.message);
    if (/connection error/i.test(msg)) {
      return "Payment server unreachable. Wait 10 seconds and reopen the game.";
    }
    return msg;
  }
  if (result?.error) return String(result.error);
  return "Could not open Stars payment.";
}

async function apiPostInvoice(productId) {
  const normalizedProductId = String(productId || "").trim();
  let response = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await sleep(2000 * attempt);
    }

    response = await postInvoiceRequest(normalizedProductId, { initData: getTelegramInitData() });
    if (response.ok) return response;

    const err = response.result?.error;
    if (response.status === 401 || err === "SESSION_EXPIRED") {
      if (!getTelegramInitData()) {
        return response;
      }
      backendSessionToken = "";
      await refreshPaymentSession();
      continue;
    }

    if (response.status !== 0 && response.status < 500 && err !== "SESSION_EXPIRED") {
      return response;
    }
  }

  return response;
}

async function ensureBackendForPayment() {
  if (isTelegramWebApp()) {
    await waitForTelegramInitData(5000);
  }

  if (!getTelegramInitData()) {
    return false;
  }

  wakeBackend();
  return true;
}

function getCachedStarsInvoiceLink(productId) {
  const id = String(productId || "").trim();
  const entry = starsInvoiceCache.get(id);
  if (!entry) return "";

  if (Date.now() > entry.expiresAt) {
    starsInvoiceCache.delete(id);
    return "";
  }

  return entry.link;
}

function setCachedStarsInvoiceLink(productId, link) {
  const id = String(productId || "").trim();
  const cleanLink = String(link || "").trim();
  if (!id || !cleanLink.startsWith("https://")) return;

  starsInvoiceCache.set(id, {
    link: cleanLink,
    expiresAt: Date.now() + STARS_INVOICE_CACHE_TTL_MS
  });
}

async function prefetchStarsInvoice(productId) {
  const id = String(productId || "").trim();
  if (!id || getCachedStarsInvoiceLink(id) || !getTelegramInitData()) return;

  try {
    wakeBackend();
    const { link } = await fetchStarsInvoiceLink(id);
    setCachedStarsInvoiceLink(id, link);
  } catch (error) {
    console.warn("PREFETCH_STARS_INVOICE_FAILED:", id, error.message);
  }
}

function prefetchTicketStoreInvoices() {
  if (!getTelegramInitData()) return;
  for (const pack of getTicketStorePacks()) {
    void prefetchStarsInvoice(pack.id);
  }
}

function prefetchCoinStoreInvoices() {
  if (!getTelegramInitData()) return;
  for (const pack of COIN_STORE_PACKS) {
    void prefetchStarsInvoice(pack.productId);
  }
}

function prefetchEarnBoostInvoices() {
  if (!getTelegramInitData()) return;
  for (const id of ["refill_energy", "tap_boost_30", "endless_energy_30", "income_boost_30"]) {
    void prefetchStarsInvoice(id);
  }
}

function prefetchStarsPaymentLinks() {
  prefetchTicketStoreInvoices();
  prefetchCoinStoreInvoices();
  prefetchEarnBoostInvoices();
  void prefetchStarsInvoice("premium_spin");
}

function openStarsPurchaseSheet(productId, link, options = {}) {
  const { onPaid } = options;

  paymentInProgress = true;
  beginPaymentQuietWindow();
  showToast(PAYMENT_OPENING_TOAST);
  setCachedStarsInvoiceLink(productId, link);

  let paymentGuardTimer = window.setTimeout(() => {
    paymentInProgress = false;
  }, 120000);

  const clearGuard = () => {
    if (paymentGuardTimer) {
      window.clearTimeout(paymentGuardTimer);
      paymentGuardTimer = null;
    }
  };

  try {
    openTelegramStarsInvoice(link, (paymentStatus) => {
      clearGuard();
      paymentInProgress = false;
      runStarsInvoiceCallback(async (status) => {
        if (status === "paid") {
          showToast(PAYMENT_VERIFYING_TOAST);
          starsInvoiceCache.delete(String(productId || "").trim());
          if (onPaid) await onPaid();
          void prefetchStarsInvoice(productId);
          return;
        }

        if (status === "failed") {
          showToast("Payment failed.");
        } else if (status === "cancelled") {
          showToast("Payment cancelled.");
        }

        void prefetchStarsInvoice(productId);
      }, paymentStatus);
    });

    void prefetchStarsInvoice(productId);
    return true;
  } catch (error) {
    clearGuard();
    paymentInProgress = false;
    console.error("OPEN_STARS_PURCHASE_SHEET_ERROR:", productId, error);
    showToast(error.message || "Could not open Stars payment.");
    void prefetchStarsInvoice(productId);
    return false;
  }
}

async function fetchAndOpenStarsPurchase(productId, options = {}) {
  try {
    if (!(await ensureBackendForPayment())) {
      throw new Error("Open the game from @WealthiaGameBot, then try again.");
    }

    const { link } = await fetchStarsInvoiceLink(productId);
    return openStarsPurchaseSheet(productId, link, options);
  } catch (error) {
    paymentInProgress = false;
    console.error("STARS_PURCHASE_ERROR:", productId, error);
    showToast(error.message || "Could not start Stars payment.");
    void prefetchStarsInvoice(productId);
    return false;
  }
}

function launchStarsPurchase(productId, options = {}) {
  if (!getTelegramWebApp() || typeof getTelegramWebApp().openInvoice !== "function") {
    showToast("Open in Telegram to pay with Stars.");
    return false;
  }

  if (paymentInProgress) {
    showToast("Payment already in progress.");
    return false;
  }

  const cachedLink = getCachedStarsInvoiceLink(productId);
  if (cachedLink) {
    return openStarsPurchaseSheet(productId, cachedLink, options);
  }

  paymentInProgress = true;
  beginPaymentQuietWindow();
  showToast(PAYMENT_OPENING_TOAST);
  void fetchAndOpenStarsPurchase(productId, options);
  return true;
}

async function startStarsPurchase(productId, options = {}) {
  return launchStarsPurchase(productId, options);
}

function lockPaymentButton(button, options = {}) {
  if (!button || button.dataset.paymentLocked === "1") return false;
  button.dataset.paymentLocked = "1";
  button.disabled = true;
  button.classList.add(options.busyClass || "payment-btn--busy");
  return true;
}

function releasePaymentButton(button, options = {}) {
  if (!button) return;
  delete button.dataset.paymentLocked;
  button.disabled = false;
  button.classList.remove(options.busyClass || "payment-btn--busy");
}

function getTelegramWebApp() {
  const WebApp = window.Telegram && window.Telegram.WebApp;
  if (WebApp && typeof WebApp.ready === "function") {
    WebApp.ready();
  }
  return WebApp || null;
}

function bindStarsInvoiceClosedListener() {
  const WebApp = getTelegramWebApp();
  if (!WebApp || WebApp.__wealthiaInvoiceBound) return;

  WebApp.__wealthiaInvoiceBound = true;

  const handleClosed = (event) => {
    const status = event && event.status ? event.status : event;
    if (!status || typeof starsInvoiceStatusHandler !== "function") return;

    const handler = starsInvoiceStatusHandler;
    starsInvoiceStatusHandler = null;
    handler(status);
  };

  if (typeof WebApp.onEvent === "function") {
    WebApp.onEvent("invoiceClosed", handleClosed);
  }
}

function openTelegramStarsInvoice(invoiceLink, onStatus) {
  const WebApp = getTelegramWebApp();
  const link = String(invoiceLink || "").trim();

  if (!link.startsWith("https://")) {
    console.error("INVALID_INVOICE_LINK:", link);
    throw new Error("Invalid payment link from server.");
  }

  if (!WebApp || typeof WebApp.openInvoice !== "function") {
    throw new Error("Open in Telegram to pay with Stars.");
  }

  bindStarsInvoiceClosedListener();
  WebApp.ready();
  WebApp.expand();

  const callback = typeof onStatus === "function" ? onStatus : () => {};
  let settled = false;

  const finish = (status) => {
    if (settled) return;
    settled = true;
    starsInvoiceStatusHandler = null;
    callback(status);
  };

  starsInvoiceStatusHandler = finish;

  try {
    WebApp.openInvoice(link, finish);
  } catch (error) {
    console.error("OPEN_INVOICE_FAILED:", error);
    if (link.includes("t.me") && typeof WebApp.openTelegramLink === "function") {
      WebApp.openTelegramLink(link);
      showToast("Complete payment in Telegram, then return to the game.");
      return true;
    }
    finish("failed");
    throw error;
  }

  return true;
}

async function fetchStarsInvoiceLink(productId) {
  const response = await requestStarsInvoice(productId);
  const link = response.result?.invoiceLink;

  if (!response.ok || !link || !String(link).startsWith("https://")) {
    const message = starsInvoiceErrorMessage(response.result, response.status);
    const error = new Error(message);
    error.paymentResponse = response;
    throw error;
  }

  return {
    link: String(link),
    result: response.result
  };
}

function runStarsInvoiceCallback(callback, paymentStatus) {
  Promise.resolve()
    .then(() => callback(paymentStatus))
    .catch((error) => {
      console.error("STARS_INVOICE_CALLBACK_ERROR:", error);
      showToast(error.message || "Payment confirmation failed.");
    });
}

function openStarsPaymentSheet(tg, invoiceLink, onStatus) {
  return openTelegramStarsInvoice(invoiceLink, onStatus);
}

async function requestStarsInvoice(productId) {
  const normalizedProductId = String(productId || "").trim();
  if (!normalizedProductId) {
    return {
      ok: false,
      status: 400,
      result: { error: "BAD_PRODUCT", message: "Missing product id." }
    };
  }

  return apiPostInvoice(normalizedProductId);
}

async function connectBackend(retries = 6, options = {}) {
  const silent = Boolean(options.silent);
  if (paymentInProgress && !options.force) {
    return backendReady;
  }

  renderSyncBar();
  await wakeBackend();

  if (isTelegramWebApp()) {
    await waitForTelegramInitData();
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { ok, result, status } = await apiPost("/api/session", {
      initData: getTelegramInitData(),
      telegramUser: getTelegramUser(),
      referrerId: getReferrerId()
    });

    if (ok && result && result.channelRequired) {
      showChannelGate(
        result.channelUrl,
        result.channelMessage || "Please subscribe to our official channel to unlock the game"
      );
      backendReady = false;
      backendSessionToken = "";
      renderSyncBar();
      render();
      return false;
    }

    if (ok && result && !result.error && result.game) {
      hideChannelGate();
      backendUserId = result.userId;
      backendSessionToken = result.token || "";
      backendReconnectAttempts = 0;
      const silent = attempt === 0 && !messageShownRecently("backend-connected");
      await applyBackendUser(
        result,
        silent ? "" : attempt > 0 ? "Backend reconnected." : "Backend connected."
      );
      if (!silent && attempt === 0) markMessageShown("backend-connected");
      await loadTournament();
      renderSyncBar();
      return true;
    }

    if (result && result.error === "INVALID_TELEGRAM_AUTH") {
      backendReady = false;
      backendSessionToken = "";
      const health = await fetchBackendHealth();
      let message = authErrorMessage(result.reason);

      if (health && health.telegram && !health.telegram.configured) {
        message = authErrorMessage("BOT_TOKEN_MISSING");
      } else if (
        health &&
        health.telegram &&
        health.telegram.username &&
        CONFIG.BOT_USERNAME &&
        health.telegram.username.toLowerCase() !== String(CONFIG.BOT_USERNAME).toLowerCase()
      ) {
        message = `Server bot is @${health.telegram.username}, expected @${CONFIG.BOT_USERNAME}.`;
      }

      if (shouldShowSyncErrorToast(silent)) showToast(message);
      renderSyncBar();
      render();
      return false;
    }

    if (result && result.error === "BOTS_NOT_ALLOWED") {
      backendReady = false;
      backendSessionToken = "";
      showToast("Bot accounts cannot play.");
      renderSyncBar();
      render();
      return false;
    }

    if (result && result.error === "CONNECTION_ERROR") {
      backendReady = false;
      backendSessionToken = "";
      if (shouldShowSyncErrorToast(silent) && els.syncBarText) {
        els.syncBarText.textContent = CONNECTION_ERROR_TOAST;
      }
      if (shouldShowSyncErrorToast(silent)) showConnectionErrorToast();
      renderSyncBar();
      render();
      if (attempt < retries && (status === 0 || status >= 500)) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      return false;
    }

    if (attempt < retries && (status === 0 || status >= 500)) {
      if (shouldShowSyncErrorToast(silent) && els.syncBarText) {
        els.syncBarText.textContent = status === 0
          ? "Network error — retrying..."
          : CONNECTION_ERROR_TOAST;
      }
      await sleep(2000 * (attempt + 1));
      continue;
    }

    break;
  }

  backendReady = false;
  backendSessionToken = "";
  if (!getTelegramInitData()) {
    if (shouldShowSyncErrorToast(silent)) showToast("Backend offline. Local mode — tap still works.");
  } else {
    const health = await fetchBackendHealth();
    if (health && health.database === false) {
      if (shouldShowSyncErrorToast(silent)) showToast("Database offline. Tap works, sync paused.");
    } else if (shouldShowSyncErrorToast(silent)) {
      showConnectionErrorToast();
    }
    if (shouldShowSyncErrorToast(silent)) scheduleBackendReconnect();
  }
  renderSyncBar();
  render();
  return false;
}

function messageShownRecently(key) {
  try {
    const raw = sessionStorage.getItem(`wealthia_msg_${key}`);
    if (!raw) return false;
    return Date.now() - Number(raw) < 60000;
  } catch {
    return false;
  }
}

function markMessageShown(key) {
  try {
    sessionStorage.setItem(`wealthia_msg_${key}`, String(Date.now()));
  } catch {
    // ignore
  }
}

async function loadLeaderboard() {
  if (paymentInProgress) return;

  if (!backendReady) {
    renderRankPanel();
    renderCampaignBanner();
    return;
  }

  const { ok, result, status } = await apiPost("/api/leaderboard");
  if (!ok || !result) {
    if (status === 401) {
      backendSessionToken = "";
      await connectBackend(1, { silent: true });
    }
    renderRankPanel();
    return;
  }

  leaderboardTop3 = Array.isArray(result.top3) ? result.top3 : [];
  leaderboardYou = result.you || null;
  dailyLeaderboardTop3 = Array.isArray(result.daily?.top3) ? result.daily.top3 : [];
  dailyLeaderboardRows = Array.isArray(result.daily?.rows) && result.daily.rows.length
    ? result.daily.rows
    : dailyLeaderboardTop3;
  dailyLeaderboardYou = result.daily?.you || null;
  dailyYourRank = Number(result.daily?.yourRank || dailyLeaderboardYou?.rank || 0);
  dailyContestResetsAt = result.daily?.resetsAt || state.dailyContest?.resetsAt || "";
  dailyReferralsRequired = Number(result.daily?.minReferrals || 3);
  dailyReferralCount = Number(result.daily?.yourReferrals || state.referrals?.count || 0);
  dailyPrizeEligible = Boolean(result.daily?.eligible);
  dailyLastWinner = result.daily?.lastWinner || null;
  if (typeof result.daily?.yourScore === "number") {
    dailyContestScore = result.daily.yourScore;
    if (state.dailyContest) state.dailyContest.score = result.daily.yourScore;
  }
  if (typeof result.daily?.yourTickets === "number") {
    state.tickets = result.daily.yourTickets;
    if (state.dailyContest) state.dailyContest.tickets = result.daily.yourTickets;
  }
  if (result.daily?.ticketProgress) {
    state.ticketProgress = result.daily.ticketProgress;
    if (state.dailyContest) state.dailyContest.ticketProgress = result.daily.ticketProgress;
  }

  renderRankPanel();
  renderCampaignBanner();
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
  if (!(await ensureBackend()) || !tournamentData) {
    showToast("Server not connected. Tap Retry at top.");
    return;
  }

  const { ok, result } = await apiPost("/api/tournaments/join", {
    userId: backendUserId,
    tournamentId: tournamentData.id
  });

  if (!ok) {
    if (result && result.error === "NOT_ENOUGH_COINS") showToast("Not enough coins to join.");
    else if (result && result.error === "ALREADY_JOINED") showToast("Already joined.");
    else if (result && result.error === "BRACKET_MISMATCH") {
      showToast(`Your Empire Level does not fit this bracket (${result.bracketLabel || "level bracket"}).`);
    } else showToast("Could not join tournament.");
    return;
  }

  tournamentData = result.tournament || tournamentData;
  await applyBackendUser(result.user, "Joined tournament! Start tapping.");
  await loadTournament();
}

function tapLocal(event) {
  const cost = tapValue();
  const endless = isEndlessEnergy();
  if (!endless && state.energy < cost) {
    showToast("No energy.");
    render();
    return false;
  }

  const amount = tapPower();
  state.coins = Number(state.coins || 0) + amount;
  state.taps = Number(state.taps || 0) + 1;
  state.dailyScore = Number(state.dailyScore || 0) + amount;
  if (state.dailyContest) state.dailyContest.score = state.dailyScore;
  dailyContestScore = state.dailyScore;
  if (!endless) {
    state.energy = Math.max(0, Number(state.energy || 0) - cost);
  }

  saveState();
  render();

  coinPop(
    event.clientX || window.innerWidth / 2,
    event.clientY || window.innerHeight / 2,
    amount
  );

  return {
    coins: amount,
    taps: 1,
    energy: endless ? 0 : -cost,
    dailyScore: amount
  };
}

async function flushTapBatch() {
  if (tapBatchTimer) {
    window.clearTimeout(tapBatchTimer);
    tapBatchTimer = null;
  }

  if (tapBatchFlushing) {
    scheduleTapBatchFlush();
    return;
  }

  const count = tapBatchCount;
  const delta = cloneTapDelta(tapBatchDelta);
  tapBatchCount = 0;
  tapBatchDelta = null;

  if (count <= 0) return;

  if (!backendReady) {
    rollbackTapDelta(delta);
    saveState();
    render();
    return;
  }

  tapBatchFlushing = true;

  try {
    const { ok, result } = await apiPost("/api/tap", { count });
    if (!ok || !result || !result.user) {
      rollbackTapDelta(delta);
      saveState();
      render();

      if (result && result.error === "TOO_FAST") {
        showToast("Slow down!");
      } else if (result && result.error === "NO_ENERGY") {
        showToast("No energy.");
      } else if (result && result.error === "SESSION_EXPIRED") {
        showToast("Session expired. Reconnecting...");
        await connectBackend();
      }
      return;
    }

    const pendingDelta = cloneTapDelta(tapBatchDelta);
    syncFromBackend(result.user);
    applyTapDelta(pendingDelta);
    saveState();
    render();

    const applied = Number(result.applied || result.count || count);
    if (tournamentData && tournamentData.joined && applied > 0) {
      tournamentData.myScore = Number(tournamentData.myScore || 0) + applied;
      loadTournament();
    }
  } catch (error) {
    console.error("TAP_BATCH_FLUSH_ERROR:", error);
    rollbackTapDelta(delta);
    saveState();
    render();
  } finally {
    tapBatchFlushing = false;
    if (tapBatchCount > 0) {
      scheduleTapBatchFlush();
    }
  }
}

function scheduleTapBatchFlush() {
  if (tapBatchTimer) return;
  tapBatchTimer = window.setTimeout(() => {
    void flushTapBatch();
  }, TAP_BATCH_FLUSH_MS);
}

function queueTapBatch(delta) {
  tapBatchDelta = addTapDelta(tapBatchDelta, delta);
  tapBatchCount += 1;
  if (tapBatchCount >= TAP_BATCH_MAX) {
    void flushTapBatch();
    return;
  }
  scheduleTapBatchFlush();
}

async function backendTap(event) {
  if (event.cancelable) event.preventDefault();

  const delta = tapLocal(event);
  if (!delta) return;
  if (!backendReady) return;

  queueTapBatch(delta);
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
  const cost = upgradeCost(name);

  if (state.coins < cost) {
    showToast("Not enough Wealth Coin.");
    return;
  }

  if (!backendReady) {
    upgradeLocal(name);
    return;
  }

  const { ok, result } = await apiPost("/api/upgrade", {
    userId: backendUserId,
    building: name
  });

  if (!ok || !result || !result.user) {
    if (result && result.error === "NOT_ENOUGH_COINS") {
      await refreshBackendState();
      showToast("Not enough Wealth Coin. Balance synced.");
    } else if (name === "casino") {
      showToast("Casino save failed. Run migration-casino-level.sql in Supabase.");
    } else {
      showToast("Upgrade failed. Try again.");
    }
    return;
  }

  await applyBackendUser(result.user, `${name[0].toUpperCase() + name.slice(1)} upgraded.`);
}

async function handleDailyTaskClick(taskId) {
  const tasks = Array.isArray(state.dailyTasks) ? state.dailyTasks : [];
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.claimed) return;

  const isSocial = task.type === "social";
  const ready = isSocial || task.ready || Number(task.progress || 0) >= Number(task.target || 1);
  if (!ready) return;

  if (isSocial && task.url) {
    const tg = window.Telegram?.WebApp;
    if (tg && typeof tg.openLink === "function") {
      tg.openLink(task.url);
    } else {
      window.open(task.url, "_blank", "noopener,noreferrer");
    }
  }

  await claimBackendTask(taskId);
}

async function claimBackendTask(taskId) {
  if (!(await ensureBackend())) {
    showToast("Server not connected. Tap Retry at top.");
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
  if (!(await ensureBackend())) {
    showToast("Server not connected. Tap Retry at top.");
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
  if (!(await ensureBackend())) {
    showToast("Server not connected. Tap Retry at top.");
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
  income_boost_30: "2x Income active for 30 min!",
  premium_spin: "Premium spin ready!",
  tickets_1: "+1 Ticket added!",
  tickets_5: "+5 Tickets added!",
  tickets_10: "+10 Tickets added!",
  tickets_50: "+50 Tickets added!",
  tickets_100: "+100 Tickets added!",
  coins_5000: "+5,000 Coins added!",
  coins_15000: "+15,000 Coins added!",
  coins_50000: "+50,000 Coins added!",
  coins_150000: "+150,000 Coins added!",
  coins_500000: "+500,000 Coins added!"
};

function ticketPackProductId(productId) {
  return String(productId || "").startsWith("tickets_");
}

function starProductFulfilled(productId) {
  if (ticketPackProductId(productId)) return false;
  if (productId === "refill_energy") {
    return Number(state.energy) >= Number(state.maxEnergy);
  }
  if (productId === "tap_boost_30") return isBoostActive(state.boosts.tapUntil);
  if (productId === "endless_energy_30") return isBoostActive(state.boosts.endlessUntil);
  if (productId === "income_boost_30") return isBoostActive(state.boosts.incomeUntil);
  return false;
}

async function waitForStarFulfillment(productId, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    await refreshBackendState();
    if (starProductFulfilled(productId)) return true;
    await sleep(1000);
  }
  return false;
}

async function waitForTicketFulfillment(beforeTickets, expectedAdd, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    await refreshBackendState();
    await loadLeaderboard();
    if (ticketCount() >= beforeTickets + expectedAdd) return true;
    await sleep(1000);
  }
  return false;
}

async function waitForCoinFulfillment(beforeCoins, expectedAdd, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    await refreshBackendState();
    if (Number(state.coins) >= beforeCoins + expectedAdd) return true;
    await sleep(1000);
  }
  return false;
}

function renderCoinStorePacks() {
  const mount = document.getElementById("coinStorePacks");
  if (!mount || mount.dataset.bound === "1") return;

  mount.dataset.bound = "1";
  mount.innerHTML = COIN_STORE_PACKS.map((pack) => `
    <button
      type="button"
      class="coin-store-pack"
      data-coin-pack="${pack.productId}"
      data-coin-amount="${pack.coins}"
    >
      <span class="coin-store-pack__coins">${format(pack.coins)} Coins</span>
      <span class="coin-store-pack__arrow" aria-hidden="true">➡️</span>
      <span class="coin-store-pack__price">${pack.stars} ⭐</span>
    </button>
  `).join("");

  mount.addEventListener("click", (event) => {
    const button = event.target.closest("[data-coin-pack]");
    if (!button || button.disabled) return;

    const productId = button.dataset.coinPack;
    const coinAmount = Number(button.dataset.coinAmount || 0);
    buyCoinPack(productId, coinAmount, button);
  });
}

function openCoinStoreModal() {
  const modal = document.getElementById("coinStoreModal");
  if (!modal) return;
  renderCoinStorePacks();
  prefetchCoinStoreInvoices();
  modal.hidden = false;
}

function closeCoinStoreModal() {
  const modal = document.getElementById("coinStoreModal");
  if (!modal) return;
  modal.hidden = true;
}

function bindCoinStoreModal() {
  const openButton = document.getElementById("coinStoreOpen");
  const modal = document.getElementById("coinStoreModal");
  if (!modal || modal.dataset.bound === "1") return;

  modal.dataset.bound = "1";

  if (openButton) {
    openButton.addEventListener("click", () => openCoinStoreModal());
  }

  const closeButton = document.getElementById("coinStoreClose");
  if (closeButton) {
    closeButton.addEventListener("click", closeCoinStoreModal);
  }

  const backdrop = document.getElementById("coinStoreBackdrop");
  if (backdrop) {
    backdrop.addEventListener("click", closeCoinStoreModal);
  }
}

async function buyCoinPack(productId, coinAmount, button) {
  const beforeCoins = Number(state.coins || 0);
  const expectedAdd = Math.max(0, Number(coinAmount || 0));

  launchStarsPurchase(productId, {
    onPaid: async () => {
      const fulfilled = await waitForCoinFulfillment(beforeCoins, expectedAdd);
      await refreshBackendState();
      render();

      if (fulfilled) {
        closeCoinStoreModal();
        showToast(STAR_SUCCESS_LABELS[productId] || `+${format(expectedAdd)} Coins added!`);
        const tg = getTelegramWebApp();
        if (tg?.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === "function") {
          tg.HapticFeedback.notificationOccurred("success");
        }
      } else {
        showToast("Payment received. Coins are syncing...");
      }
    }
  });
}

async function buyTicketPack(productId, packTickets, button) {
  const beforeTickets = ticketCount();

  launchStarsPurchase(productId, {
    onPaid: async () => {
      const fulfilled = await waitForTicketFulfillment(beforeTickets, packTickets);

      if (fulfilled) {
        showTicketConfetti();
        renderRankPanel();
        renderCampaignBanner();
        showToast(STAR_SUCCESS_LABELS[productId] || `+${packTickets} Tickets added!`);
        const tg = getTelegramWebApp();
        if (tg?.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === "function") {
          tg.HapticFeedback.notificationOccurred("success");
        }
      } else {
        showToast("Payment received. Tickets are syncing...");
        await loadLeaderboard();
        renderRankPanel();
        renderCampaignBanner();
      }
    }
  });
}

async function buyStarsProduct(productId, button) {
  launchStarsPurchase(productId, {
    onPaid: async () => {
      const fulfilled = await waitForStarFulfillment(productId);

      if (fulfilled) {
        showToast(STAR_SUCCESS_LABELS[productId] || "Premium boost activated!");
        const tg = getTelegramWebApp();
        if (tg?.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === "function") {
          tg.HapticFeedback.notificationOccurred("success");
        }
      } else {
        showToast("Payment received. Boost is activating — check again in a few seconds.");
      }
    }
  });
}

async function performResetGame() {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  const { ok, result } = await apiPost("/api/reset", {
    userId: backendUserId,
    mode: "daily"
  });

  if (!ok || !result) {
    showToast("Reset failed.");
    return;
  }

  await applyBackendUser(result.user, "Daily progress reset.");
  dailyContestScore = 0;
  if (state.dailyContest) {
    state.dailyContest.score = 0;
    state.dailyContest.tickets = 0;
  }
  state.tickets = 0;
  await loadLeaderboard();
  renderCampaignBanner();
}

function resetGame() {
  if (!backendReady) {
    showToast("Backend offline.");
    return;
  }

  openResetConfirmModal();
}

async function fetchUserData() {
  await refreshBackendState();
}

async function refreshBackendState() {
  if (paymentInProgress) return;
  if (hasPendingTapBatch()) return;

  if (!backendReady) {
    await connectBackend(1, { silent: true });
    return;
  }

  const { ok, result, status } = await apiPost("/api/session", {
    initData: getTelegramInitData(),
    telegramUser: getTelegramUser(),
    referrerId: getReferrerId()
  });

  if (!ok || !result) {
    if (status === 401 || status === 0) {
      backendSessionToken = "";
      await connectBackend(1, { silent: true });
    }
    return;
  }

  if (result.channelRequired) {
    backendReady = false;
    backendSessionToken = "";
    showChannelGate(
      result.channelUrl,
      result.channelMessage || "Please subscribe to our official channel to unlock the game"
    );
    renderSyncBar();
    render();
    return;
  }

  hideChannelGate();

  if (result.token) {
    backendSessionToken = result.token;
  }

  if (hasPendingTapBatch()) return;

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

  bindStarsInvoiceClosedListener();
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
  if (!(await ensureBackend())) {
    showToast("Server not connected. Tap Retry at top.");
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

    const view = tab.dataset.view || "main";
    const appRoot = document.getElementById("appRoot");
    const appScroll = document.getElementById("appScroll");
    if (appRoot) {
      appRoot.classList.remove("view-main", "view-city", "view-tasks", "view-earn", "view-friends", "view-rank");
      appRoot.classList.add(`view-${view}`);
    }
    if (appScroll) appScroll.scrollTop = 0;

    renderCampaignBanner();
    renderFriendsPanel();

    if (tab.dataset.tab === "rankPanel") {
      loadLeaderboard();
      loadTournament();
      prefetchTicketStoreInvoices();
    }

    if (tab.dataset.tab === "earnPanel") {
      prefetchEarnBoostInvoices();
    }
  });
});

if (els.tasksPanel) {
  els.tasksPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-daily-task]");
    if (!button || button.disabled) return;

    const taskId = button.dataset.dailyTask;
    if (!taskId) return;

    handleDailyTaskClick(taskId);
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
      buyStarsProduct(starButton.dataset.star, starButton);
    }
  });
}

const inviteButton = document.getElementById("inviteButton");
if (inviteButton) {
  inviteButton.addEventListener("click", () => shareInviteLink());
}

const resetButton = document.getElementById("resetButton");
if (resetButton) {
  resetButton.addEventListener("click", resetGame);
}

function bootApp() {
  initTelegramWebApp();
  initAdsGram();
  setupOnboarding();
  setupOfflineModal();
  setupTapControls();
  startContestSeedRefresh();
  bindRankRulesModal();
  bindCoinStoreModal();
  bindResetConfirmModal();
  bindChannelGateModal();
  bindPremiumSpinUi();

  window.addEventListener("unhandledrejection", (event) => {
    console.error("UNHANDLED_REJECTION:", event.reason);
    event.preventDefault();
    if (paymentInProgress) return;
  });

  window.addEventListener("error", (event) => {
    if (!event || !event.message) return;
    console.error("WINDOW_ERROR:", event.message, event.filename, event.lineno);
    if (paymentInProgress) {
      event.preventDefault();
    }
  });

  if (els.syncRetryButton) {
    els.syncRetryButton.addEventListener("click", () => {
      backendReconnectAttempts = 0;
      connectBackend(6);
    });
  }

  bindCitySpinCards();
  render();
  connectBackend();

  document.addEventListener("visibilitychange", () => {
    if (paymentInProgress) return;
    if (document.visibilityState === "hidden" && tapBatchCount > 0) {
      void flushTapBatch();
      return;
    }
    if (document.visibilityState === "visible" && !backendReady && isTelegramWebApp()) {
      connectBackend(4);
    }
  });
}

bootApp();

window.setInterval(refreshBackendState, 10000);

window.setInterval(() => {
  updateTaskRefreshLabel();
  syncBoostFlagsFromUntil();

  const next = Date.parse(state.dailyTasksNextRefresh || "");
  if (next && Date.now() >= next) {
    refreshBackendState();
  }
}, 1000);

// Energy recovery is server-side only (1 per 10s via /api/session sync).
