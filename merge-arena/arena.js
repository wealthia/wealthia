(() => {
  const STORAGE_KEY = "merge_arena_v2";
  const API_URL = (window.WEALTHIA_CONFIG && window.WEALTHIA_CONFIG.API_URL) ||
    "https://merge-arena-api.onrender.com";
  const COLS = 4;
  const ROWS = 4;
  const SIZE = COLS * ROWS;
  const ENERGY_MAX = 20;

  const UNIT_DEFS = [
    { id: "spark", name: "Spark", icon: "⚡", rarity: "common", basePower: 12 },
    { id: "blade", name: "Blade", icon: "🗡", rarity: "common", basePower: 14 },
    { id: "ward", name: "Ward", icon: "🛡", rarity: "rare", basePower: 22 },
    { id: "nova", name: "Nova", icon: "✦", rarity: "rare", basePower: 26 },
    { id: "phantom", name: "Phantom", icon: "👁", rarity: "epic", basePower: 40 },
    { id: "titan", name: "Titan", icon: "🏛", rarity: "epic", basePower: 48 },
    { id: "sovereign", name: "Sovereign", icon: "👑", rarity: "legendary", basePower: 72 }
  ];

  const SHOP = {
    energy_refill: {
      title: "Full Charge",
      text: "Snap back to 20 energy and keep the streak.",
      stars: 25,
      apply(state) {
        state.energy = ENERGY_MAX;
      }
    },
    energy_pack: {
      title: "Energy Sip",
      text: "+10 energy for one more merge run.",
      stars: 15,
      apply(state) {
        state.energy = Math.min(ENERGY_MAX, state.energy + 10);
      }
    },
    rare_summon: {
      title: "Rare Drop",
      text: "A guaranteed Rare lands on your board now.",
      stars: 40,
      apply(state) {
        return placeGuaranteed(state, "rare");
      }
    },
    epic_summon: {
      title: "Epic Strike",
      text: "Drop a heavy Epic and swing the fight.",
      stars: 90,
      apply(state) {
        return placeGuaranteed(state, "epic");
      }
    },
    power_surge: {
      title: "Power Surge",
      text: "+30% squad power for your next 3 fights.",
      stars: 35,
      apply(state) {
        state.surgeBattles = Math.max(0, Number(state.surgeBattles || 0)) + 3;
      }
    },
    gem_starter: {
      title: "Gem Cache",
      text: "+500 gems. Pure progress fuel.",
      stars: 50,
      apply(state) {
        state.gems += 500;
      }
    }
  };

  const TUTORIAL_KEY = "merge_arena_tutorial_v1";
  const TUTORIAL_STEPS = [
    {
      art: "⚡",
      title: "Build your squad",
      text: "Tap Get Hero. Fresh fighters drop onto the arena floor."
    },
    {
      art: "◈",
      title: "Fuse the twins",
      text: "Drag two matching heroes together. They merge and level up."
    },
    {
      art: "⚔",
      title: "Win the clash",
      text: "When your Squad Power leads, hit Enter Fight and climb."
    }
  ];

  const defaultState = () => ({
    energy: 12,
    gems: 80,
    trophies: 0,
    wave: 1,
    bestWave: 1,
    wins: 0,
    merges: 0,
    highestPower: 0,
    surgeBattles: 0,
    discovered: ["spark", "blade"],
    board: Array(SIZE).fill(null),
    lastEnergyAt: Date.now()
  });

  let state = loadState();
  let toastTimer = null;
  let drag = null;
  let pendingPurchase = null;
  let battleBusy = false;
  let sessionToken = "";
  let cloudReady = false;
  let saveTimer = null;
  let syncing = false;
  let tutorialIndex = 0;

  const $ = (id) => document.getElementById(id);

  const els = {
    energyValue: $("energyValue"),
    gemValue: $("gemValue"),
    trophyValue: $("trophyValue"),
    cloudChip: $("cloudChip"),
    cloudValue: $("cloudValue"),
    energyChip: $("energyChip"),
    waveTitle: $("waveTitle"),
    powerValue: $("powerValue"),
    board: $("board"),
    boardHint: $("boardHint"),
    summonButton: $("summonButton"),
    battleButton: $("battleButton"),
    unitStrip: $("unitStrip"),
    rosterGrid: $("rosterGrid"),
    toast: $("toast"),
    battleModal: $("battleModal"),
    fighterYou: $("fighterYou"),
    fighterEnemy: $("fighterEnemy"),
    youBar: $("youBar"),
    enemyBar: $("enemyBar"),
    battleLog: $("battleLog"),
    resultModal: $("resultModal"),
    resultEyebrow: $("resultEyebrow"),
    resultTitle: $("resultTitle"),
    resultText: $("resultText"),
    resultRewards: $("resultRewards"),
    resultClose: $("resultClose"),
    payModal: $("payModal"),
    payTitle: $("payTitle"),
    payText: $("payText"),
    payCancel: $("payCancel"),
    payConfirm: $("payConfirm"),
    gloryWave: $("gloryWave"),
    gloryTrophies: $("gloryTrophies"),
    gloryWins: $("gloryWins"),
    gloryMerges: $("gloryMerges"),
    gloryPower: $("gloryPower"),
    tutorial: $("tutorial"),
    tutorialArt: $("tutorialArt"),
    tutorialStep: $("tutorialStep"),
    tutorialTitle: $("tutorialTitle"),
    tutorialText: $("tutorialText"),
    tutorialDots: $("tutorialDots"),
    tutorialNext: $("tutorialNext"),
    tutorialSkip: $("tutorialSkip")
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        board: Array.isArray(parsed.board) && parsed.board.length === SIZE
          ? parsed.board
          : base.board,
        discovered: Array.isArray(parsed.discovered) ? parsed.discovered : base.discovered
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    queueCloudSave();
  }

  function getTelegramInitData() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return tg && tg.initData ? String(tg.initData) : "";
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }
    return { ok: response.ok, status: response.status, result };
  }

  async function ensureSession() {
    const initData = getTelegramInitData();
    if (!initData) {
      setCloudStatus("local", "warn");
      showToast("Open from Telegram bot (not browser)");
      return false;
    }
    setCloudStatus("auth…", "busy");
    const { ok, result, status } = await api("/api/merge-arena/session", {
      method: "POST",
      body: { initData }
    });
    if (!ok || !result?.token) {
      const reason = (result && (result.reason || result.error)) || `HTTP ${status}`;
      setCloudStatus("off", "bad");
      showToast(`Cloud off: ${reason}`);
      console.warn("MERGE_ARENA_SESSION_FAIL", status, result);
      return false;
    }
    sessionToken = String(result.token);
    return true;
  }

  async function loadCloudState() {
    const { ok, result } = await api("/api/merge-arena/state");
    if (!ok || !result?.state) return false;
    const remote = result.state;
    const base = defaultState();
    state = {
      ...base,
      ...remote,
      board: Array.isArray(remote.board) && remote.board.length === SIZE
        ? remote.board
        : base.board,
      discovered: Array.isArray(remote.discovered) ? remote.discovered : base.discovered
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  }

  function queueCloudSave() {
    if (!cloudReady || !sessionToken) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      pushCloudState().catch(() => {});
    }, 700);
  }

  async function pushCloudState() {
    if (!sessionToken || syncing) return false;
    syncing = true;
    try {
      const { ok, result, status } = await api("/api/merge-arena/state", {
        method: "POST",
        body: { state }
      });
      if (!ok) {
        const reason = (result && (result.error || result.message)) || `HTTP ${status}`;
        setCloudStatus("save✗", "bad");
        showToast(`Save failed: ${reason}`);
        return false;
      }
      return true;
    } finally {
      syncing = false;
    }
  }

  async function connectCloud() {
    try {
      setCloudStatus("…", "busy");
      const authed = await ensureSession();
      if (!authed) return;
      await loadCloudState();
      seedIfEmpty();
      cloudReady = true;
      const saved = await pushCloudState();
      renderBoard();
      renderRoster();
      renderGlory();
      if (saved) {
        setCloudStatus("on", "ok");
      }
    } catch (error) {
      setCloudStatus("err", "bad");
      showToast("Cloud wake failed — retry in bot");
      console.warn("MERGE_ARENA_CLOUD_FAIL", error);
    }
  }

  function setCloudStatus(text, kind) {
    const short =
      text === "on" ? "●" :
      text === "off" || text === "err" || text === "save✗" ? "!" :
      text === "local" ? "L" :
      text === "auth…" || text === "…" || text === "…" ? "·" :
      "·";
    if (els.cloudValue) els.cloudValue.textContent = short;
    if (els.cloudChip) {
      els.cloudChip.dataset.kind = kind || "";
      els.cloudChip.title = `Cloud: ${text}`;
    }
  }

  function showToast(msg) {
    els.toast.hidden = false;
    els.toast.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 3500);
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function defById(id) {
    return UNIT_DEFS.find((u) => u.id === id) || UNIT_DEFS[0];
  }

  function rarityForLevel(level) {
    if (level >= 5) return "legendary";
    if (level >= 4) return "epic";
    if (level >= 3) return "rare";
    return "common";
  }

  function powerOf(unit) {
    if (!unit) return 0;
    const def = defById(unit.id);
    const lvl = Number(unit.level || 1);
    return Math.round(def.basePower * Math.pow(1.65, lvl - 1));
  }

  function squadPower() {
    const raw = state.board.reduce((sum, u) => sum + powerOf(u), 0);
    if (state.surgeBattles > 0) return Math.round(raw * 1.3);
    return raw;
  }

  function enemyPower(wave) {
    return Math.round(28 + wave * 18 + Math.pow(wave, 1.35) * 4);
  }

  function emptySlots() {
    const slots = [];
    state.board.forEach((u, i) => {
      if (!u) slots.push(i);
    });
    return slots;
  }

  function randomCommonId() {
    const commons = UNIT_DEFS.filter((u) => u.rarity === "common");
    return commons[Math.floor(Math.random() * commons.length)].id;
  }

  function unitForRarity(rarity) {
    const pool = UNIT_DEFS.filter((u) => u.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)] || UNIT_DEFS[0];
  }

  function makeUnit(id, level = 1) {
    const def = defById(id);
    return {
      uid: `${id}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      id,
      level,
      rarity: rarityForLevel(level) === "common" ? def.rarity : rarityForLevel(level)
    };
  }

  function discover(id) {
    if (!state.discovered.includes(id)) state.discovered.push(id);
  }

  function placeGuaranteed(st, rarity) {
    const slots = [];
    st.board.forEach((u, i) => {
      if (!u) slots.push(i);
    });
    if (!slots.length) return "Board is full. Merge first.";
    const def = unitForRarity(rarity);
    const level = rarity === "epic" ? 4 : 3;
    const unit = makeUnit(def.id, level);
    unit.rarity = rarity;
    st.board[slots[0]] = unit;
    if (!st.discovered.includes(def.id)) st.discovered.push(def.id);
    return null;
  }

  function regenEnergy() {
    const now = Date.now();
    const lastEnergyAt = Number(state.lastEnergyAt || now);
    const elapsed = now - lastEnergyAt;
    const gained = Math.floor(elapsed / 60000);
    if (gained > 0 && state.energy < ENERGY_MAX) {
      state.energy = Math.min(ENERGY_MAX, state.energy + gained);
      state.lastEnergyAt = lastEnergyAt + gained * 60000;
      saveState();
    }
  }

  function fitViewport() {
    const tg = window.Telegram && window.Telegram.WebApp;
    const h = Math.round(
      (tg && (tg.viewportStableHeight || tg.viewportHeight)) ||
      window.visualViewport?.height ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      0
    );
    if (h > 0) {
      document.documentElement.style.setProperty("--app-h", `${h}px`);
    }
    fitBoard();
  }

  function fitBoard() {
    const wrap = els.board && els.board.parentElement;
    if (!wrap || !els.board) return;
    const app = document.getElementById("app");
    const dock = document.querySelector(".dock");
    const actions = document.querySelector(".play-actions");
    const hud = document.querySelector(".hud");
    const wave = document.querySelector(".wave-bar");
    const hint = document.getElementById("boardHint");
    const strip = document.getElementById("unitStrip");
    const appH = app ? app.clientHeight : window.innerHeight;
    const reserved =
      (dock ? dock.offsetHeight : 48) +
      (actions ? actions.offsetHeight : 44) +
      (hud ? hud.offsetHeight : 30) +
      (wave ? wave.offsetHeight : 36) +
      (hint ? hint.offsetHeight : 16) +
      (strip ? Math.min(strip.offsetHeight || 42, 42) : 42) +
      20;
    const styles = window.getComputedStyle(wrap);
    const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const availW = Math.max(0, wrap.clientWidth - padX);
    const fromWrap = Math.max(0, wrap.clientHeight - padY);
    const fromViewport = Math.max(120, appH - reserved);
    const availH = Math.max(120, Math.min(fromWrap || fromViewport, fromViewport));
    if (availW < 40) return;
    // Square board that leaves room for buttons + strip + dock
    const size = Math.floor(Math.min(availW, availH));
    els.board.style.width = `${size}px`;
    els.board.style.height = `${size}px`;
    els.board.style.maxWidth = "100%";
    els.board.style.maxHeight = "100%";
  }

  function initTelegram() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) {
      fitViewport();
      return;
    }
    try {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if (tg.setHeaderColor) tg.setHeaderColor("#07131A");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#07131A");
      fitViewport();
      if (tg.onEvent) {
        tg.onEvent("viewportChanged", fitViewport);
      }
    } catch {
      fitViewport();
    }
  }

  function switchView(name) {
    document.querySelectorAll(".view").forEach((view) => {
      const active = view.dataset.view === name;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
    });
    document.querySelectorAll(".dock__item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.nav === name);
    });
    if (name === "roster") renderRoster();
    if (name === "rank") renderGlory();
    if (name === "play") requestAnimationFrame(fitBoard);
  }

  function renderHud() {
    regenEnergy();
    els.energyValue.textContent = String(state.energy);
    if (els.energyChip) els.energyChip.title = `Energy ${state.energy}/${ENERGY_MAX}`;
    els.gemValue.textContent = String(state.gems);
    els.trophyValue.textContent = String(state.trophies);
    els.waveTitle.textContent = `Arena ${state.wave}`;
    const power = squadPower();
    els.powerValue.textContent = String(power);
    state.highestPower = Math.max(state.highestPower, power);
    els.summonButton.disabled = state.energy < 1 || emptySlots().length === 0;
    els.battleButton.disabled = battleBusy || state.energy < 1 || power <= 0;
  }

  function renderBoard() {
    els.board.innerHTML = "";
    for (let i = 0; i < SIZE; i += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = String(i);
      const unit = state.board[i];
      if (unit) {
        const def = defById(unit.id);
        const node = document.createElement("div");
        node.className = "unit";
        node.dataset.rarity = unit.rarity || def.rarity;
        node.dataset.index = String(i);
        node.innerHTML = `
          <span class="unit__lvl">L${unit.level}</span>
          <span class="unit__icon">${def.icon}</span>
          <span class="unit__pow">${powerOf(unit)}</span>
        `;
        bindUnitDrag(node, i);
        cell.appendChild(node);
      }
      els.board.appendChild(cell);
    }
    renderStrip();
    renderHud();
    requestAnimationFrame(fitBoard);
  }

  function renderStrip() {
    const counts = {};
    state.board.forEach((u) => {
      if (!u) return;
      const key = `${u.id}_${u.level}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts);
    if (!entries.length) {
      els.unitStrip.innerHTML = `<div class="strip-card"><strong>Empty floor</strong><span>Tap Get Hero</span></div>`;
      return;
    }
    els.unitStrip.innerHTML = entries
      .map(([key, count]) => {
        const [id, level] = key.split("_");
        const def = defById(id);
        return `<div class="strip-card"><strong>${def.icon} ${def.name}</strong><span>L${level} · x${count}</span></div>`;
      })
      .join("");
  }

  function renderRoster() {
    els.rosterGrid.innerHTML = UNIT_DEFS.map((def) => {
      const unlocked = state.discovered.includes(def.id);
      return `
        <article class="roster-card ${unlocked ? "" : "is-locked"}">
          <div class="roster-card__unit" data-rarity="${def.rarity}" style="background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(0,0,0,.2))">
            ${unlocked ? def.icon : "?"}
          </div>
          <h3>${unlocked ? def.name : "Locked"}</h3>
          <p>${def.rarity} · base ${def.basePower}</p>
        </article>
      `;
    }).join("");
  }

  function renderGlory() {
    els.gloryWave.textContent = String(state.bestWave);
    els.gloryTrophies.textContent = String(state.trophies);
    els.gloryWins.textContent = String(state.wins);
    els.gloryMerges.textContent = String(state.merges);
    els.gloryPower.textContent = String(state.highestPower);
  }

  function bindUnitDrag(node, index) {
    node.addEventListener("pointerdown", (event) => {
      if (battleBusy) return;
      event.preventDefault();
      drag = {
        from: index,
        node,
        pointerId: event.pointerId
      };
      node.classList.add("is-dragging");
      node.setPointerCapture(event.pointerId);
    });

    node.addEventListener("pointermove", (event) => {
      if (!drag || drag.from !== index) return;
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const cell = el && el.closest ? el.closest(".cell") : null;
      document.querySelectorAll(".cell").forEach((c) => {
        c.classList.remove("is-over", "is-merge");
      });
      if (!cell) return;
      const to = Number(cell.dataset.index);
      if (Number.isNaN(to) || to === drag.from) return;
      cell.classList.add("is-over");
      const a = state.board[drag.from];
      const b = state.board[to];
      if (a && b && a.id === b.id && a.level === b.level && a.level < 5) {
        cell.classList.add("is-merge");
      }
    });

    node.addEventListener("pointerup", (event) => {
      if (!drag || drag.from !== index) return;
      node.classList.remove("is-dragging");
      try {
        node.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const cell = el && el.closest ? el.closest(".cell") : null;
      document.querySelectorAll(".cell").forEach((c) => {
        c.classList.remove("is-over", "is-merge");
      });
      if (cell) {
        const to = Number(cell.dataset.index);
        if (!Number.isNaN(to) && to !== drag.from) {
          tryMove(drag.from, to);
        }
      }
      drag = null;
    });

    node.addEventListener("pointercancel", () => {
      if (!drag || drag.from !== index) return;
      node.classList.remove("is-dragging");
      document.querySelectorAll(".cell").forEach((c) => {
        c.classList.remove("is-over", "is-merge");
      });
      drag = null;
    });
  }

  function tryMove(from, to) {
    const a = state.board[from];
    const b = state.board[to];
    if (!a) return;

    if (!b) {
      state.board[to] = a;
      state.board[from] = null;
      saveState();
      renderBoard();
      return;
    }

    if (a.id === b.id && a.level === b.level && a.level < 5) {
      const merged = makeUnit(a.id, a.level + 1);
      merged.rarity = rarityForLevel(merged.level);
      if (merged.level >= 3) merged.rarity = rarityForLevel(merged.level);
      state.board[to] = merged;
      state.board[from] = null;
      state.merges += 1;
      state.gems += merged.level >= 4 ? 25 : 10;
      discover(merged.id);
      saveState();
      renderBoard();
      showToast(`Fusion! ${defById(merged.id).name} L${merged.level}`);
      haptic("success");
      return;
    }

    state.board[from] = b;
    state.board[to] = a;
    saveState();
    renderBoard();
  }

  function summon(forceId, forceLevel) {
    const slots = emptySlots();
    if (!slots.length) {
      showToast("Board packed — fuse heroes first.");
      return false;
    }
    if (state.energy < 1 && !forceId) {
      openPay("energy_pack");
      showToast("Out of energy. Hit the Star Market.");
      return false;
    }

    if (!forceId) {
      state.energy -= 1;
      state.lastEnergyAt = Date.now();
    }

    const id = forceId || randomCommonId();
    const unit = makeUnit(id, forceLevel || 1);
    if (forceLevel) unit.rarity = rarityForLevel(forceLevel);
    const slot = slots[Math.floor(Math.random() * slots.length)];
    state.board[slot] = unit;
    discover(id);
    saveState();
    renderBoard();
    if (!forceId) showToast(`${defById(id).name} enters the arena`);
    haptic("light");
    return true;
  }

  async function startBattle() {
    if (battleBusy) return;
    const power = squadPower();
    if (power <= 0) {
      showToast("Recruit a hero before the clash.");
      return;
    }
    if (state.energy < 1) {
      openPay("energy_refill");
      showToast("Need energy to fight.");
      return;
    }

    battleBusy = true;
    state.energy -= 1;
    state.lastEnergyAt = Date.now();
    saveState();
    renderHud();

    const wave = state.wave;
    const enemy = enemyPower(wave);
    els.battleModal.hidden = false;
    els.fighterYou.textContent = `YOU ${power}`;
    els.fighterEnemy.textContent = `L${wave} ${enemy}`;
    els.youBar.style.width = "100%";
    els.enemyBar.style.width = "100%";
    els.battleLog.textContent = "Clash ignites…";

    await wait(700);
    els.battleLog.textContent = "Heroes collide!";
    await wait(700);

    // visual HP race based on power ratio
    const youRatio = power / (power + enemy);
    const steps = 8;
    for (let i = 1; i <= steps; i += 1) {
      const progress = i / steps;
      const youLeft = Math.max(0, 100 - progress * 100 * (1 - youRatio) * 1.35);
      const enemyLeft = Math.max(0, 100 - progress * 100 * youRatio * 1.35);
      els.youBar.style.width = `${youLeft}%`;
      els.enemyBar.style.width = `${enemyLeft}%`;
      await wait(120);
    }

    const won = power >= enemy;
    if (state.surgeBattles > 0) state.surgeBattles -= 1;

    if (won) {
      const trophyGain = 8 + wave * 2;
      const gemGain = 20 + wave * 5;
      state.wins += 1;
      state.trophies += trophyGain;
      state.gems += gemGain;
      state.wave += 1;
      state.bestWave = Math.max(state.bestWave, state.wave);
      // consume 1 random weakest unit as battle cost feel
      consumeWeakest();
      saveState();
      els.battleModal.hidden = true;
      showResult(true, wave, trophyGain, gemGain);
      haptic("success");
    } else {
      // soft loss: lose some trophies, keep wave
      const loss = Math.min(state.trophies, 4 + Math.floor(wave / 2));
      const gemGain = 5;
      state.trophies = Math.max(0, state.trophies - loss);
      state.gems += gemGain;
      consumeWeakest();
      saveState();
      els.battleModal.hidden = true;
      showResult(false, wave, -loss, gemGain);
      haptic("error");
    }

    battleBusy = false;
    renderBoard();
  }

  function consumeWeakest() {
    let weakestIdx = -1;
    let weakestPow = Infinity;
    state.board.forEach((u, i) => {
      if (!u) return;
      const p = powerOf(u);
      if (p < weakestPow) {
        weakestPow = p;
        weakestIdx = i;
      }
    });
    if (weakestIdx >= 0) state.board[weakestIdx] = null;
  }

  function showResult(won, wave, trophies, gems) {
    els.resultModal.hidden = false;
    els.resultEyebrow.textContent = won ? "Victory" : "Defeat";
    els.resultTitle.textContent = won ? `Arena ${wave} Cleared` : `Arena ${wave} Hold`;
    els.resultText.textContent = won
      ? "Your squad dominated. Next arena unlocked!"
      : "Fuse higher and come back swinging.";
    els.resultRewards.innerHTML = `
      <span>${trophies >= 0 ? "+" : ""}${trophies} 🏆</span>
      <span>+${Math.max(0, gems)} 💎</span>
      ${won ? "<span>Next arena unlocked</span>" : "<span>Forge stronger</span>"}
    `;
  }

  function openPay(productId) {
    const product = SHOP[productId];
    if (!product) return;
    pendingPurchase = productId;
    els.payTitle.textContent = product.title;
    els.payText.textContent = `${product.text} · Exact price: ${product.stars} Stars`;
    els.payModal.hidden = false;
  }

  function closePay() {
    pendingPurchase = null;
    els.payModal.hidden = true;
  }

  function confirmPay() {
    if (!pendingPurchase) return;
    const productId = pendingPurchase;
    const product = SHOP[productId];
    if (!product) return;

    // Demo Stars purchase — exact item, no RNG shop packs.
    const ok = window.confirm(
      `Pay ${product.stars} Stars for ${product.title}?\n\nYou get exactly what is listed.`
    );
    if (!ok) return;

    const err = product.apply(state);
    if (typeof err === "string") {
      closePay();
      showToast(err);
      return;
    }

    saveState();
    closePay();
    renderBoard();
    renderHud();
    showToast(`${product.title} secured`);
    haptic("success");
    if (productId === "rare_summon" || productId === "epic_summon") {
      switchView("play");
    }
  }

  function tutorialDone() {
    try {
      return localStorage.getItem(TUTORIAL_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markTutorialDone() {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      // ignore
    }
  }

  function renderTutorialStep() {
    const step = TUTORIAL_STEPS[tutorialIndex];
    if (!step || !els.tutorial) return;
    els.tutorialArt.textContent = step.art;
    els.tutorialStep.textContent = `${tutorialIndex + 1} / ${TUTORIAL_STEPS.length}`;
    els.tutorialTitle.textContent = step.title;
    els.tutorialText.textContent = step.text;
    els.tutorialNext.textContent =
      tutorialIndex >= TUTORIAL_STEPS.length - 1 ? "Enter Arena" : "Next";
    if (els.tutorialDots) {
      [...els.tutorialDots.children].forEach((dot, i) => {
        dot.classList.toggle("is-on", i === tutorialIndex);
      });
    }
  }

  function openTutorial() {
    if (!els.tutorial || tutorialDone()) return;
    tutorialIndex = 0;
    els.tutorial.hidden = false;
    renderTutorialStep();
  }

  function closeTutorial() {
    if (!els.tutorial) return;
    els.tutorial.hidden = true;
    markTutorialDone();
    showToast("Arena unlocked — fuse and climb");
  }

  function advanceTutorial() {
    if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
      closeTutorial();
      return;
    }
    tutorialIndex += 1;
    renderTutorialStep();
  }

  function haptic(type) {
    const tg = window.Telegram && window.Telegram.WebApp;
    try {
      if (tg && tg.HapticFeedback) {
        if (type === "success" || type === "error") {
          tg.HapticFeedback.notificationOccurred(type === "success" ? "success" : "error");
        } else if (tg.HapticFeedback.impactOccurred) {
          tg.HapticFeedback.impactOccurred("light");
        }
      }
    } catch {
      // ignore
    }
  }

  function bind() {
    document.querySelectorAll(".dock__item").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.nav));
    });

    els.summonButton.addEventListener("click", () => summon());
    els.battleButton.addEventListener("click", () => startBattle());
    els.energyChip.addEventListener("click", () => {
      switchView("shop");
      openPay("energy_refill");
    });
    if (els.cloudChip) {
      els.cloudChip.addEventListener("click", () => {
        connectCloud();
      });
    }

    document.querySelectorAll("[data-buy]").forEach((card) => {
      const buy = () => openPay(card.dataset.buy);
      card.addEventListener("click", buy);
      const cta = card.querySelector(".offer__cta");
      if (cta) cta.addEventListener("click", (e) => {
        e.stopPropagation();
        buy();
      });
    });

    els.resultClose.addEventListener("click", () => {
      els.resultModal.hidden = true;
    });
    els.payCancel.addEventListener("click", closePay);
    els.payConfirm.addEventListener("click", confirmPay);
    if (els.tutorialNext) {
      els.tutorialNext.addEventListener("click", () => advanceTutorial());
    }
    if (els.tutorialSkip) {
      els.tutorialSkip.addEventListener("click", () => closeTutorial());
    }
  }

  function seedIfEmpty() {
    if (state.board.some(Boolean)) return;
    // gentle onboarding: 2 units ready to merge
    state.board[5] = makeUnit("spark", 1);
    state.board[6] = makeUnit("spark", 1);
    state.board[9] = makeUnit("blade", 1);
    discover("spark");
    discover("blade");
    saveState();
  }

  function boot() {
    initTelegram();
    fitViewport();
    window.addEventListener("resize", fitViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitViewport);
    }
    seedIfEmpty();
    bind();
    renderBoard();
    renderRoster();
    renderGlory();
    openTutorial();
    connectCloud();
    if (state.energy <= 3) {
      setTimeout(() => showToast("Energy low — Star Market keeps you climbing."), 900);
    }
  }

  boot();
})();
