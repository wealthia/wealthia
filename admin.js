const API_URL = (window.WEALTHIA_CONFIG && window.WEALTHIA_CONFIG.API_URL) ||
  "https://wealthia-backend.onrender.com";

const SECRET_KEY = "wealthia_admin_secret";
let adminSecret = localStorage.getItem(SECRET_KEY) || "";
let dashboardData = null;
let playersCache = [];

const els = {
  loginScreen: document.getElementById("loginScreen"),
  adminApp: document.getElementById("adminApp"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  secretInput: document.getElementById("adminSecret"),
  logoutButton: document.getElementById("logoutButton"),
  refreshButton: document.getElementById("refreshButton"),
  viewTitle: document.getElementById("viewTitle"),
  dashboardStats: document.getElementById("dashboardStats"),
  activeTournamentCard: document.getElementById("activeTournamentCard"),
  playersTable: document.getElementById("playersTable"),
  playerSearch: document.getElementById("playerSearch"),
  tournamentsList: document.getElementById("tournamentsList"),
  createTournamentForm: document.getElementById("createTournamentForm"),
  logRevenueForm: document.getElementById("logRevenueForm"),
  revenueSummary: document.getElementById("revenueSummary"),
  metricsTable: document.getElementById("metricsTable"),
  payoutsTable: document.getElementById("payoutsTable"),
  spinMonitorPanel: document.getElementById("spinMonitorPanel"),
  spinMonitorCount: document.getElementById("spinMonitorCount"),
  spinMonitorMilestones: document.getElementById("spinMonitorMilestones"),
  spinWinnersTable: document.getElementById("spinWinnersTable"),
  spinWinnerFilters: document.getElementById("spinWinnerFilters"),
  fraudAlertsTable: document.getElementById("fraudAlertsTable"),
  broadcastForm: document.getElementById("broadcastForm"),
  broadcastMessage: document.getElementById("broadcastMessage"),
  broadcastSubmit: document.getElementById("broadcastSubmit"),
  broadcastStatus: document.getElementById("broadcastStatus"),
  gameSettingsForm: document.getElementById("gameSettingsForm"),
  giveRewardForm: document.getElementById("giveRewardForm"),
  profileSearchForm: document.getElementById("profileSearchForm"),
  profileSearchInput: document.getElementById("profileSearchInput"),
  userProfileCard: document.getElementById("userProfileCard"),
  profileDisplayName: document.getElementById("profileDisplayName"),
  profileUserMeta: document.getElementById("profileUserMeta"),
  profileBanBadge: document.getElementById("profileBanBadge"),
  profileCoins: document.getElementById("profileCoins"),
  profileTickets: document.getElementById("profileTickets"),
  profileTotalSpins: document.getElementById("profileTotalSpins"),
  profileRegistrationDate: document.getElementById("profileRegistrationDate"),
  profileUpdateButton: document.getElementById("profileUpdateButton"),
  profileBanButton: document.getElementById("profileBanButton"),
  profileUnbanButton: document.getElementById("profileUnbanButton"),
  createPromoForm: document.getElementById("createPromoForm"),
  promoCodesTable: document.getElementById("promoCodesTable"),
  toast: document.getElementById("toast")
};

let spinWinnerFilter = "all";
let activeProfile = null;

function formatNumber(value) {
  return Math.floor(Number(value || 0)).toLocaleString("en-US");
}

function formatStars(value) {
  return `${formatNumber(value)} ⭐`;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function payoutStatusLabel(status) {
  if (status === "completed" || status === "paid") return "Paid";
  return "Pending";
}

function payoutStatusClass(status) {
  if (status === "completed" || status === "paid") return "badge--active";
  return "badge--draft";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function showLogin(error = "") {
  if (els.loginScreen) {
    els.loginScreen.hidden = false;
    els.loginScreen.style.display = "grid";
  }
  if (els.adminApp) {
    els.adminApp.hidden = true;
    els.adminApp.style.display = "none";
  }
  if (els.loginError) {
    if (error) {
      els.loginError.hidden = false;
      els.loginError.textContent = error;
    } else {
      els.loginError.hidden = true;
      els.loginError.textContent = "";
    }
  }
}

function showApp() {
  if (els.loginScreen) {
    els.loginScreen.hidden = true;
    els.loginScreen.style.display = "none";
  }
  if (els.adminApp) {
    els.adminApp.hidden = false;
    els.adminApp.style.display = "grid";
  }
}

async function api(path, options = {}) {
  const headers = {
    "x-admin-secret": adminSecret,
    ...(options.headers || {})
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    const text = await response.text();
    let result = {};

    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = { error: text.slice(0, 120) || "BAD_RESPONSE" };
    }

    return { ok: response.ok, status: response.status, result };
  } catch (error) {
    if (error && error.name === "AbortError") {
      return { ok: false, status: 0, result: { error: "TIMEOUT" } };
    }
    return { ok: false, status: 0, result: { error: "NETWORK_ERROR" } };
  } finally {
    window.clearTimeout(timeout);
  }
}

function loginErrorMessage(status, result) {
  const code = result && result.error;

  if (code === "TIMEOUT") {
    return "Backend is waking up. Wait 30 seconds and try again.";
  }
  if (status === 0 || code === "NETWORK_ERROR") {
    return "Cannot reach backend. Check internet or try again.";
  }
  if (status === 503 || code === "ADMIN_NOT_CONFIGURED") {
    return "Render-də ADMIN_SECRET yoxdur. Environment-ə əlavə et və deploy et.";
  }
  if (status === 401 || code === "UNAUTHORIZED") {
    return "Secret səhvdir. Render-dəki ADMIN_SECRET ilə eyni olmalıdır.";
  }
  if (status >= 500) {
    return `Server error: ${code || "unknown"}`;
  }
  return "Giriş alınmadı. Secret-i yoxla.";
}

async function verifySecret(secret) {
  const previous = adminSecret;
  adminSecret = secret;

  const { ok, status, result } = await api("/api/admin/dashboard");

  if (!ok) {
    adminSecret = previous;
    return { valid: false, message: loginErrorMessage(status, result) };
  }

  dashboardData = result;
  return { valid: true, message: "" };
}

async function handleLogin(event) {
  event.preventDefault();

  const secret = els.secretInput ? els.secretInput.value.trim() : "";
  if (!secret) return;

  const submitButton = els.loginForm && els.loginForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";
  }

  if (els.loginError) {
    els.loginError.hidden = true;
  }

  try {
    const check = await verifySecret(secret);

    if (!check.valid) {
      showLogin(check.message);
      return;
    }

    localStorage.setItem(SECRET_KEY, secret);
    showApp();
    renderDashboardFromCache();
    showToast("Signed in.");
    loadCurrentView().catch(() => showToast("Dashboard refresh failed."));
  } catch {
    showLogin("Unexpected error. Try again.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Sign in";
    }
  }
}

function renderDashboardFromCache() {
  if (!dashboardData) return;
  renderDashboardStats(dashboardData);
  renderActiveTournament(dashboardData.tournaments.active);
}

function renderSpinWinners(rows) {
  if (!els.spinWinnersTable) return;

  if (!rows.length) {
    els.spinWinnersTable.innerHTML = '<tr><td colspan="6" class="empty">No cash winners yet.</td></tr>';
    return;
  }

  els.spinWinnersTable.innerHTML = rows.map((row) => {
    const username = row.username ? `@${row.username}` : (row.displayName || "—");
    const paid = row.status === "paid";
    return `
      <tr>
        <td><code>${row.userId}</code></td>
        <td>${username}</td>
        <td><strong>${formatMoney(row.wonAmountUsd)}</strong></td>
        <td>${formatDate(row.createdAt)}</td>
        <td><span class="badge ${payoutStatusClass(row.status)}">${payoutStatusLabel(row.status)}</span></td>
        <td>
          <button
            type="button"
            class="btn-paid"
            data-mark-paid="${row.id}"
            ${paid ? "disabled" : ""}
          >MARK AS PAID</button>
        </td>
      </tr>
    `;
  }).join("");
}

async function markSpinWinnerPaid(payoutId) {
  const { ok, result } = await api("/api/admin/payouts/status", {
    method: "POST",
    body: JSON.stringify({ id: payoutId, status: "completed" })
  });

  if (!ok) {
    showToast(result.error || "Could not update payout.");
    return;
  }

  showToast("Winner marked as Paid.");
  await Promise.all([loadSpinWinners(), loadDashboard(), loadPayouts()]);
}

async function loadSpinWinners() {
  const query = new URLSearchParams({ status: spinWinnerFilter });
  const { ok, result } = await api(`/api/admin/spin-winners?${query.toString()}`);

  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  renderSpinWinners(result.rows || []);
}

function renderFraudAlerts(rows) {
  if (!els.fraudAlertsTable) return;

  if (!rows.length) {
    els.fraudAlertsTable.innerHTML = '<tr><td colspan="6" class="empty">No fraud alerts logged yet.</td></tr>';
    return;
  }

  els.fraudAlertsTable.innerHTML = rows.map((row) => {
    const username = row.username ? `@${row.username}` : (row.displayName || "—");
    const banned = Boolean(row.isBanned);
    return `
      <tr class="fraud-row">
        <td>${formatDate(row.createdAt)}</td>
        <td><code>${row.userId || "—"}</code></td>
        <td>${username}</td>
        <td><span class="badge badge--ended">${row.eventType}</span></td>
        <td class="fraud-detail">${row.detail || "—"}</td>
        <td>
          <button
            type="button"
            class="btn-ban"
            data-ban-user="${row.userId}"
            ${!row.userId || banned ? "disabled" : ""}
          >${banned ? "BANNED" : "BAN USER"}</button>
        </td>
      </tr>
    `;
  }).join("");
}

async function banFraudUser(userId) {
  if (!userId) return;
  if (!window.confirm(`Ban Telegram user ${userId}? They will not be able to open the bot again.`)) {
    return;
  }

  const { ok, result } = await api("/api/admin/ban-user", {
    method: "POST",
    body: JSON.stringify({ userId, reason: "Banned from admin Fraud Alerts panel" })
  });

  if (!ok) {
    showToast(result.error || "Ban failed.");
    return;
  }

  showToast(`User ${userId} banned.`);
  await loadFraudAlerts();
}

async function loadFraudAlerts() {
  const { ok, result } = await api("/api/admin/fraud-alerts?limit=100");

  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  renderFraudAlerts(result.rows || []);
}

async function sendBroadcast(event) {
  event.preventDefault();

  const message = els.broadcastMessage ? els.broadcastMessage.value.trim() : "";
  if (!message) {
    showToast("Enter a broadcast message.");
    return;
  }

  if (!window.confirm(`Send this message to all active players?\n\n${message.slice(0, 180)}${message.length > 180 ? "..." : ""}`)) {
    return;
  }

  if (els.broadcastSubmit) {
    els.broadcastSubmit.disabled = true;
    els.broadcastSubmit.textContent = "Sending...";
  }

  if (els.broadcastStatus) {
    els.broadcastStatus.hidden = false;
    els.broadcastStatus.textContent = "Broadcast in progress. Please wait...";
  }

  try {
    const { ok, result, status } = await api("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ message })
    });

    if (!ok) {
      showToast(result.error || `Broadcast failed (${status || "error"}).`);
      if (els.broadcastStatus) {
        els.broadcastStatus.textContent = result.error || "Broadcast failed.";
      }
      return;
    }

    const summary = `Sent ${formatNumber(result.sent)} / ${formatNumber(result.total)} (${formatNumber(result.failed)} failed).`;
    showToast(summary);
    if (els.broadcastStatus) {
      els.broadcastStatus.textContent = summary;
    }
    if (els.broadcastMessage) els.broadcastMessage.value = "";
  } catch (error) {
    console.error("BROADCAST_ERROR:", error);
    showToast("Broadcast failed unexpectedly.");
    if (els.broadcastStatus) {
      els.broadcastStatus.textContent = "Broadcast failed unexpectedly.";
    }
  } finally {
    if (els.broadcastSubmit) {
      els.broadcastSubmit.disabled = false;
      els.broadcastSubmit.textContent = "SEND BROADCAST";
    }
  }
}

function fillGameSettingsForm(settings) {
  if (!settings) return;

  const fields = {
    premium_spin_stars: document.getElementById("premiumSpinStars"),
    cash_10_interval: document.getElementById("cash10Interval"),
    cash_5_interval: document.getElementById("cash5Interval"),
    cash_2_interval: document.getElementById("cash2Interval")
  };

  Object.entries(fields).forEach(([key, input]) => {
    if (input && settings[key] !== undefined) {
      input.value = settings[key];
    }
  });
}

async function loadGameSettings() {
  const { ok, result } = await api("/api/admin/game-settings");

  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  fillGameSettingsForm(result.settings || {});
}

async function saveGameSettings(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    premium_spin_stars: Number(data.get("premium_spin_stars")),
    cash_10_interval: Number(data.get("cash_10_interval")),
    cash_5_interval: Number(data.get("cash_5_interval")),
    cash_2_interval: Number(data.get("cash_2_interval"))
  };

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }

  try {
    const { ok, result } = await api("/api/admin/game-settings", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!ok) {
      showToast(result.error || "Could not save settings.");
      return;
    }

    fillGameSettingsForm(result.settings || payload);
    showToast("Game settings saved.");
    await loadDashboard();
  } catch (error) {
    console.error("SAVE_GAME_SETTINGS_ERROR:", error);
    showToast("Could not save settings.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "SAVE CONFIG";
    }
  }
}

async function giveManualReward(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const userId = String(data.get("userId") || "").trim();
  const amount = Number(data.get("amount") || 0);
  const type = String(data.get("type") || "coins");

  if (!userId || amount <= 0) {
    showToast("Enter a valid Telegram ID and amount.");
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Processing...";
  }

  try {
    const { ok, result } = await api("/api/admin/give-reward", {
      method: "POST",
      body: JSON.stringify({ userId, amount, type })
    });

    if (!ok) {
      showToast(result.error || "Reward failed.");
      return;
    }

    const label = type === "tickets" ? "tickets" : "coins";
    showToast(`Granted ${formatNumber(amount)} ${label}${result.notified ? " and notified user." : "."}`);
    form.reset();
    await loadPlayers();
  } catch (error) {
    console.error("GIVE_REWARD_ERROR:", error);
    showToast("Reward failed unexpectedly.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "GIVE REWARD";
    }
  }
}

function handleLogout() {
  adminSecret = "";
  localStorage.removeItem(SECRET_KEY);
  if (els.secretInput) els.secretInput.value = "";
  showLogin();
}

function switchView(view) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });

  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}View`);
  });

  const titles = {
    dashboard: "Dashboard",
    broadcast: "Broadcast",
    gameSettings: "Game Settings",
    spinWinners: "Lucky Spin Winners",
    fraud: "Fraud Alerts",
    promoCodes: "Promo Codes",
    players: "User Management",
    tournaments: "Tournaments",
    revenue: "Revenue",
    payouts: "Payouts"
  };

  if (els.viewTitle) els.viewTitle.textContent = titles[view] || "Dashboard";
  loadCurrentView(view);
}

async function loadCurrentView(view = getActiveView()) {
  if (view === "dashboard") await loadDashboard();
  if (view === "broadcast") return;
  if (view === "gameSettings") await loadGameSettings();
  if (view === "promoCodes") await loadPromoCodes();
  if (view === "spinWinners") await loadSpinWinners();
  if (view === "fraud") await loadFraudAlerts();
  if (view === "players") await loadPlayers();
  if (view === "tournaments") await loadTournaments();
  if (view === "revenue") await loadRevenue();
  if (view === "payouts") await loadPayouts();
}

function getActiveView() {
  const active = document.querySelector(".nav-item.active");
  return active ? active.dataset.view : "dashboard";
}

function renderDashboardStats(data) {
  if (!els.dashboardStats || !data) return;

  const cards = [
    {
      label: "Total Revenue",
      value: formatStars(data.stars?.totalRevenue || 0),
      hint: "Telegram Stars from store purchases",
      accent: "hero-stat--gold"
    },
    {
      label: "Total Users",
      value: formatNumber(data.players.total),
      hint: "Registered players",
      accent: "hero-stat--violet"
    },
    {
      label: "Active Today",
      value: formatNumber(data.players.activeToday),
      hint: "Daily active users (DAU)",
      accent: "hero-stat--green"
    },
    {
      label: "Pending Cash Payouts",
      value: formatNumber(data.payouts?.pendingCash || 0),
      hint: "Lucky Spin cash winners awaiting payout",
      accent: "hero-stat--red"
    }
  ];

  els.dashboardStats.innerHTML = cards.map((card) => `
    <article class="hero-stat ${card.accent}">
      <span class="hero-stat__label">${card.label}</span>
      <strong class="hero-stat__value">${card.value}</strong>
      <small class="hero-stat__hint">${card.hint}</small>
    </article>
  `).join("");

  renderSpinMonitor(data.spinMonitor || null);
}

function renderSpinMonitor(spinMonitor) {
  if (!els.spinMonitorCount || !els.spinMonitorMilestones) return;

  const count = number(spinMonitor?.globalSpinCount);
  const milestones = spinMonitor?.milestones || {};

  els.spinMonitorCount.textContent = formatNumber(count);

  const rows = [
    ["$10 Cash", milestones.remainingCash10, milestones.nextCash10],
    ["$5 Cash", milestones.remainingCash5, milestones.nextCash5],
    ["$2 Cash", milestones.remainingCash2, milestones.nextCash2]
  ];

  els.spinMonitorMilestones.innerHTML = rows.map(([label, remaining, nextAt]) => `
    <div class="spin-monitor__row">
      <span>${label}</span>
      <strong>${formatNumber(remaining || 0)} spins left</strong>
      <small>at spin #${formatNumber(nextAt || 0)}</small>
    </div>
  `).join("");
}

function number(value) {
  return Number(value || 0);
}

function renderActiveTournament(tournament) {
  if (!els.activeTournamentCard) return;

  if (!tournament) {
    els.activeTournamentCard.innerHTML = '<p class="empty">No live tournament. Create one in Tournaments.</p>';
    return;
  }

  els.activeTournamentCard.innerHTML = `
    <p><strong>${tournament.title}</strong></p>
    <p class="empty">Entry: ${formatNumber(tournament.entryFee)} coins · Prize pool: ${formatNumber(tournament.prizePool)}</p>
    <p class="empty">Ends: ${formatDate(tournament.endsAt)}</p>
    <span class="badge badge--active">Live</span>
  `;
}

async function loadDashboard() {
  const { ok, result } = await api("/api/admin/dashboard");
  if (!ok) {
    if (els.adminApp && els.adminApp.style.display === "none") {
      showLogin("Session expired.");
    } else {
      showToast("Could not refresh dashboard.");
    }
    return;
  }

  dashboardData = result;
  renderDashboardStats(result);
  renderActiveTournament(result.tournaments.active);
}

function renderUserProfileCard(profile) {
  if (!els.userProfileCard || !profile) return;

  activeProfile = profile;
  els.userProfileCard.hidden = false;

  if (els.profileDisplayName) {
    els.profileDisplayName.textContent = profile.displayName || profile.username || profile.userId;
  }
  if (els.profileUserMeta) {
    const username = profile.username ? `@${profile.username}` : "no username";
    els.profileUserMeta.textContent = `${username} · ${profile.userId}`;
  }
  if (els.profileCoins) els.profileCoins.value = profile.coins;
  if (els.profileTickets) els.profileTickets.value = profile.tickets;
  if (els.profileTotalSpins) els.profileTotalSpins.value = formatNumber(profile.totalSpins);
  if (els.profileRegistrationDate) {
    els.profileRegistrationDate.value = formatDate(profile.registrationDate);
  }

  const banned = Boolean(profile.isBanned);
  if (els.profileBanBadge) {
    els.profileBanBadge.textContent = banned ? "Banned" : "Active";
    els.profileBanBadge.className = `badge ${banned ? "badge--ended" : "badge--active"}`;
  }
  if (els.profileBanButton) els.profileBanButton.hidden = banned;
  if (els.profileUnbanButton) els.profileUnbanButton.hidden = !banned;
}

async function searchUserProfile(event) {
  event.preventDefault();

  const query = els.profileSearchInput ? els.profileSearchInput.value.trim() : "";
  if (!query) {
    showToast("Enter Telegram ID or username.");
    return;
  }

  const params = new URLSearchParams({ query });
  const { ok, result } = await api(`/api/admin/user-profile?${params.toString()}`);

  if (!ok) {
    showToast(result.error === "USER_NOT_FOUND" ? "User not found." : (result.error || "Search failed."));
    if (els.userProfileCard) els.userProfileCard.hidden = true;
    activeProfile = null;
    return;
  }

  renderUserProfileCard(result.profile);
}

async function updateUserProfile() {
  if (!activeProfile) {
    showToast("Search for a user first.");
    return;
  }

  const payload = {
    userId: activeProfile.userId,
    coins: Number(els.profileCoins ? els.profileCoins.value : activeProfile.coins),
    tickets: Number(els.profileTickets ? els.profileTickets.value : activeProfile.tickets)
  };

  if (els.profileUpdateButton) {
    els.profileUpdateButton.disabled = true;
    els.profileUpdateButton.textContent = "Updating...";
  }

  try {
    const { ok, result } = await api("/api/admin/user-profile", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!ok) {
      showToast(result.error || "Update failed.");
      return;
    }

    renderUserProfileCard(result.profile);
    showToast("Profile updated.");
    await loadPlayers();
  } catch (error) {
    console.error("UPDATE_PROFILE_ERROR:", error);
    showToast("Update failed unexpectedly.");
  } finally {
    if (els.profileUpdateButton) {
      els.profileUpdateButton.disabled = false;
      els.profileUpdateButton.textContent = "UPDATE PROFILE";
    }
  }
}

async function setProfileBanState(shouldBan) {
  if (!activeProfile) {
    showToast("Search for a user first.");
    return;
  }

  if (shouldBan && !window.confirm(`Ban user ${activeProfile.userId}?`)) {
    return;
  }

  const { ok, result } = await api("/api/admin/user-profile", {
    method: "POST",
    body: JSON.stringify({
      userId: activeProfile.userId,
      isBanned: shouldBan,
      banReason: shouldBan ? "Banned from User Management panel" : ""
    })
  });

  if (!ok) {
    showToast(result.error || "Ban update failed.");
    return;
  }

  renderUserProfileCard(result.profile);
  showToast(shouldBan ? "User banned." : "User unbanned.");
}

function renderPromoCodes(rows) {
  if (!els.promoCodesTable) return;

  if (!rows.length) {
    els.promoCodesTable.innerHTML = '<tr><td colspan="5" class="empty">No promo codes yet.</td></tr>';
    return;
  }

  els.promoCodesTable.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${row.code}</strong></td>
      <td>${formatNumber(row.coinReward)}</td>
      <td>${formatNumber(row.ticketReward)}</td>
      <td>${formatNumber(row.usesCount)} / ${formatNumber(row.maxUses)}</td>
      <td>${formatDate(row.createdAt)}</td>
    </tr>
  `).join("");
}

async function loadPromoCodes() {
  const { ok, result } = await api("/api/admin/promo-codes");
  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  renderPromoCodes(result.rows || []);
}

async function createPromoCode(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    code: String(data.get("code") || "").trim(),
    maxUses: Number(data.get("maxUses") || 1),
    coinReward: Number(data.get("coinReward") || 0),
    ticketReward: Number(data.get("ticketReward") || 0)
  };

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Creating...";
  }

  try {
    const { ok, result } = await api("/api/admin/promo-codes", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!ok) {
      showToast(result.error || "Could not create promo code.");
      return;
    }

    form.reset();
    showToast(`Promo code ${result.promo.code} created.`);
    await loadPromoCodes();
  } catch (error) {
    console.error("CREATE_PROMO_ERROR:", error);
    showToast("Could not create promo code.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "CREATE CODE";
    }
  }
}

function renderPlayers(rows) {
  if (!els.playersTable) return;

  if (!rows.length) {
    els.playersTable.innerHTML = '<tr><td colspan="6" class="empty">No players found.</td></tr>';
    return;
  }

  els.playersTable.innerHTML = rows.map((row) => `
    <tr>
      <td>
        <strong>${row.name}</strong><br />
        <small>${row.userId}</small>
      </td>
      <td>${formatNumber(row.coins)}</td>
      <td>${formatNumber(row.taps)}</td>
      <td>${formatNumber(row.cityValue)}</td>
      <td>${formatDate(row.lastSeenAt)}</td>
      <td>
        <button class="table-action" type="button" data-grant="${row.userId}">Grant coins</button>
      </td>
    </tr>
  `).join("");
}

async function loadPlayers() {
  const search = els.playerSearch ? els.playerSearch.value.trim() : "";
  const query = new URLSearchParams({ limit: "100", search });
  const { ok, result } = await api(`/api/admin/players?${query.toString()}`);

  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  playersCache = result.rows || [];
  renderPlayers(playersCache);
}

async function grantCoins(userId) {
  const amount = window.prompt("How many coins to grant?", "1000");
  if (!amount) return;

  const { ok, result } = await api("/api/admin/grant-coins", {
    method: "POST",
    body: JSON.stringify({ userId, amount: Number(amount) })
  });

  if (!ok) {
    showToast(result.error || "Grant failed.");
    return;
  }

  showToast(`Granted ${formatNumber(amount)} coins.`);
  await loadPlayers();
}

function tournamentBadge(status) {
  return `<span class="badge badge--${status}">${status}</span>`;
}

async function loadTournaments() {
  const { ok, result } = await api("/api/admin/tournaments");
  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  const rows = result.rows || [];
  if (!els.tournamentsList) return;

  if (!rows.length) {
    els.tournamentsList.innerHTML = '<p class="empty">No tournaments yet.</p>';
    return;
  }

  els.tournamentsList.innerHTML = rows.map((row) => `
    <div class="tournament-item">
      <div>
        <strong>${row.title}</strong>
        <small>Entry ${formatNumber(row.entryFee)} · ${row.bracketLabel || "All levels"} · ${formatNumber(row.entries)} players · Ends ${formatDate(row.endsAt)}</small>
      </div>
      <div class="tournament-actions">
        ${tournamentBadge(row.status)}
        ${row.status !== "active" ? `<button type="button" data-activate="${row.id}">Activate</button>` : ""}
        ${row.status !== "ended" ? `<button class="btn-danger" type="button" data-end="${row.id}">End & pay prizes</button>` : ""}
      </div>
    </div>
  `).join("");
}

async function createTournament(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const payload = {
    title: data.get("title"),
    description: data.get("description"),
    entryFee: Number(data.get("entryFee") || 0),
    durationHours: Number(data.get("durationHours") || 24),
    prizeWinner: Number(data.get("prizeWinner") || 0),
    prizeRunnerUp: Number(data.get("prizeRunnerUp") || 0),
    prizeThird: Number(data.get("prizeThird") || 0),
    bracketMinLevel: Number(data.get("bracketMinLevel") || 0),
    bracketMaxLevel: Number(data.get("bracketMaxLevel") || 0),
    activate: Boolean(data.get("activate"))
  };

  const { ok, result } = await api("/api/admin/tournaments", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!ok) {
    showToast(result.error || "Could not create tournament.");
    return;
  }

  form.reset();
  showToast("Tournament created.");
  await loadTournaments();
  await loadDashboard();
}

async function setTournamentStatus(tournamentId, status) {
  const { ok, result } = await api("/api/admin/tournaments/status", {
    method: "POST",
    body: JSON.stringify({ tournamentId, status })
  });

  if (!ok) {
    showToast(result.error || "Status update failed.");
    return;
  }

  showToast(status === "ended" ? "Tournament ended. Prizes paid." : "Tournament updated.");
  await loadTournaments();
  await loadDashboard();
}

function renderRevenueSummary(data) {
  if (!els.revenueSummary) return;

  if (!data) {
    els.revenueSummary.innerHTML = '<p class="empty">No data.</p>';
    return;
  }

  els.revenueSummary.innerHTML = `
    <div class="stat-card" style="margin-bottom:12px"><span>Total</span><strong>${formatMoney(data.revenue.total)}</strong></div>
    <div class="stat-card" style="margin-bottom:12px"><span>Tournament Fees</span><strong>${formatMoney(data.revenue.tournamentFees)}</strong></div>
    <div class="stat-card"><span>Ad Revenue</span><strong>${formatMoney(data.revenue.adRevenue)}</strong></div>
  `;
}

function renderMetrics(rows) {
  if (!els.metricsTable) return;

  if (!rows.length) {
    els.metricsTable.innerHTML = '<tr><td colspan="4" class="empty">No entries yet.</td></tr>';
    return;
  }

  els.metricsTable.innerHTML = rows.map((row) => `
    <tr>
      <td>${formatDate(row.created_at)}</td>
      <td>${row.metric_type}</td>
      <td>${formatMoney(row.amount)}</td>
      <td>${row.notes || "—"}</td>
    </tr>
  `).join("");
}

async function loadRevenue() {
  const [{ ok, result }, metricsRes] = await Promise.all([
    api("/api/admin/dashboard"),
    api("/api/admin/metrics")
  ]);

  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  dashboardData = result;
  renderRevenueSummary(result);
  renderMetrics(metricsRes.ok ? metricsRes.result.rows || [] : []);
}

function renderPayouts(rows) {
  if (!els.payoutsTable) return;

  if (!rows.length) {
    els.payoutsTable.innerHTML = '<tr><td colspan="6" class="empty">No pending payouts.</td></tr>';
    return;
  }

  els.payoutsTable.innerHTML = rows.map((row) => {
    const handle = row.username ? `@${row.username}` : (row.display_name || row.user_id);
    return `
      <tr>
        <td>${handle}</td>
        <td>${formatMoney(row.amount_usd)}</td>
        <td>${row.prize_id || "—"}</td>
        <td><span class="badge ${payoutStatusClass(row.status)}">${payoutStatusLabel(row.status)}</span></td>
        <td>${formatDate(row.created_at)}</td>
        <td>
          <button type="button" class="btn-paid" data-complete-payout="${row.id}" ${row.status === "completed" ? "disabled" : ""}>MARK AS PAID</button>
        </td>
      </tr>
    `;
  }).join("");

  els.payoutsTable.querySelectorAll("[data-complete-payout]").forEach((button) => {
    button.addEventListener("click", async () => {
      const payoutId = Number(button.dataset.completePayout);
      const { ok, result } = await api("/api/admin/payouts/status", {
        method: "POST",
        body: JSON.stringify({ id: payoutId, status: "completed" })
      });

      if (!ok) {
        showToast(result.error || "Could not update payout.");
        return;
      }

      showToast("Payout marked completed.");
      await loadPayouts();
    });
  });
}

async function loadPayouts() {
  const { ok, result } = await api("/api/admin/payouts?status=pending");
  if (!ok) {
    showLogin("Session expired.");
    return;
  }

  renderPayouts(result.rows || []);
}

async function logRevenue(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);

  const { ok, result } = await api("/api/admin/metrics", {
    method: "POST",
    body: JSON.stringify({
      metricType: data.get("metricType"),
      amount: Number(data.get("amount") || 0),
      notes: data.get("notes")
    })
  });

  if (!ok) {
    showToast(result.error || "Could not save revenue.");
    return;
  }

  form.reset();
  showToast("Revenue logged.");
  await loadRevenue();
}

if (els.spinWinnerFilters) {
  els.spinWinnerFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-spin-filter]");
    if (!button) return;
    spinWinnerFilter = button.dataset.spinFilter || "all";
    els.spinWinnerFilters.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });
    loadSpinWinners();
  });
}

if (els.spinWinnersTable) {
  els.spinWinnersTable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mark-paid]");
    if (!button || button.disabled) return;
    markSpinWinnerPaid(Number(button.dataset.markPaid));
  });
}

if (els.fraudAlertsTable) {
  els.fraudAlertsTable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ban-user]");
    if (!button || button.disabled) return;
    banFraudUser(button.dataset.banUser);
  });
}

if (els.profileSearchForm) {
  els.profileSearchForm.addEventListener("submit", searchUserProfile);
}

if (els.profileUpdateButton) {
  els.profileUpdateButton.addEventListener("click", () => updateUserProfile().catch(() => showToast("Update failed.")));
}

if (els.profileBanButton) {
  els.profileBanButton.addEventListener("click", () => setProfileBanState(true).catch(() => showToast("Ban failed.")));
}

if (els.profileUnbanButton) {
  els.profileUnbanButton.addEventListener("click", () => setProfileBanState(false).catch(() => showToast("Unban failed.")));
}

if (els.createPromoForm) {
  els.createPromoForm.addEventListener("submit", createPromoCode);
}

if (els.broadcastForm) {
  els.broadcastForm.addEventListener("submit", sendBroadcast);
}

if (els.gameSettingsForm) {
  els.gameSettingsForm.addEventListener("submit", saveGameSettings);
}

if (els.giveRewardForm) {
  els.giveRewardForm.addEventListener("submit", giveManualReward);
}

if (els.loginForm) {
  els.loginForm.addEventListener("submit", handleLogin);
}

if (els.logoutButton) {
  els.logoutButton.addEventListener("click", handleLogout);
}

if (els.refreshButton) {
  els.refreshButton.addEventListener("click", () => loadCurrentView());
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-goto]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.goto));
});

if (els.playerSearch) {
  els.playerSearch.addEventListener("input", () => loadPlayers());
}

if (els.playersTable) {
  els.playersTable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-grant]");
    if (!button) return;
    grantCoins(button.dataset.grant);
  });
}

if (els.createTournamentForm) {
  els.createTournamentForm.addEventListener("submit", createTournament);
}

if (els.tournamentsList) {
  els.tournamentsList.addEventListener("click", (event) => {
    const activate = event.target.closest("[data-activate]");
    if (activate) {
      setTournamentStatus(activate.dataset.activate, "active");
      return;
    }

    const end = event.target.closest("[data-end]");
    if (end && window.confirm("End tournament and pay top 3 prizes?")) {
      setTournamentStatus(end.dataset.end, "ended");
    }
  });
}

if (els.logRevenueForm) {
  els.logRevenueForm.addEventListener("submit", logRevenue);
}

showLogin();

(async function init() {
  if (!adminSecret) return;

  const check = await verifySecret(adminSecret);
  if (!check.valid) {
    localStorage.removeItem(SECRET_KEY);
    showLogin(check.message || "Session expired. Sign in again.");
    return;
  }

  showApp();
  renderDashboardFromCache();
  loadDashboard().catch(() => {});
})();
