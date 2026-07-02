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
  toast: document.getElementById("toast")
};

function formatNumber(value) {
  return Math.floor(Number(value || 0)).toLocaleString("en-US");
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
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

  let { ok, status, result } = await api("/api/admin/auth", {
    method: "POST",
    body: JSON.stringify({ adminSecret: secret })
  });

  if (status === 404) {
    ({ ok, status, result } = await api("/api/admin/dashboard"));
  }

  if (!ok) {
    adminSecret = previous;
    return { valid: false, message: loginErrorMessage(status, result) };
  }

  if (!dashboardData) {
    const dash = await api("/api/admin/dashboard");
    if (dash.ok) dashboardData = dash.result;
  }

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
    players: "Players",
    tournaments: "Tournaments",
    revenue: "Revenue"
  };

  if (els.viewTitle) els.viewTitle.textContent = titles[view] || "Dashboard";
  loadCurrentView(view);
}

async function loadCurrentView(view = getActiveView()) {
  if (view === "dashboard") await loadDashboard();
  if (view === "players") await loadPlayers();
  if (view === "tournaments") await loadTournaments();
  if (view === "revenue") await loadRevenue();
}

function getActiveView() {
  const active = document.querySelector(".nav-item.active");
  return active ? active.dataset.view : "dashboard";
}

function renderDashboardStats(data) {
  if (!els.dashboardStats || !data) return;

  const cards = [
    ["Total Players", formatNumber(data.players.total)],
    ["Active Today", formatNumber(data.players.activeToday)],
    ["Total Coins", formatNumber(data.totals.coins)],
    ["Total Taps", formatNumber(data.totals.taps)],
    ["Tournament Fees", formatMoney(data.revenue.tournamentFees)],
    ["Ad Revenue", formatMoney(data.revenue.adRevenue)],
    ["Total Revenue", formatMoney(data.revenue.total)],
    ["Tournament Entries", formatNumber(data.tournaments.totalEntries)]
  ];

  els.dashboardStats.innerHTML = cards.map(([label, value]) => `
    <article class="stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
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
        <small>Entry ${formatNumber(row.entryFee)} · ${formatNumber(row.entries)} players · Ends ${formatDate(row.endsAt)}</small>
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
