(() => {
  const STORAGE_KEY = "merge_arena_v2";
  const API_URL = (window.WEALTHIA_CONFIG && window.WEALTHIA_CONFIG.API_URL) ||
    "https://merge-arena-api.onrender.com";
  const COLS = 4;
  const ROWS = 4;
  const SIZE = COLS * ROWS;
  const ENERGY_MAX = 20;

  const UNIT_DEFS = [
    // Commons — Get Hero pool
    { id: "spark", name: "Spark", icon: "⚡", face: "⚡", rarity: "common", role: "Striker", basePower: 12, vibe: "zap", blurb: "Fast fuse fuel." },
    { id: "blade", name: "Blade", icon: "🗡", face: "⚔", rarity: "common", role: "Duelist", basePower: 14, vibe: "slash", blurb: "Clean edge damage." },
    { id: "ember", name: "Ember", icon: "🔥", face: "🔥", rarity: "common", role: "Burner", basePower: 13, vibe: "fire", blurb: "Leaves a hot trail." },
    { id: "frost", name: "Frost", icon: "❄️", face: "❄️", rarity: "common", role: "Freezer", basePower: 13, vibe: "ice", blurb: "Chills the lane." },
    { id: "fang", name: "Fang", icon: "🐺", face: "🐺", rarity: "common", role: "Beast", basePower: 15, vibe: "beast", blurb: "Bites above weight." },
    { id: "dart", name: "Dart", icon: "🏹", face: "🏹", rarity: "common", role: "Archer", basePower: 12, vibe: "bow", blurb: "Picks soft targets." },
    { id: "brew", name: "Brew", icon: "🧪", face: "🧪", rarity: "common", role: "Alchemist", basePower: 11, vibe: "brew", blurb: "Weird flask power." },
    { id: "cobble", name: "Cobble", icon: "🪨", face: "🪨", rarity: "common", role: "Tanklet", basePower: 16, vibe: "heavy", blurb: "Slow, stubborn rock." },

    // Rares — fuse L3+ or shop
    { id: "ward", name: "Ward", icon: "🛡", face: "🛡", rarity: "rare", role: "Guardian", basePower: 22, vibe: "guard", blurb: "Holds the line." },
    { id: "nova", name: "Nova", icon: "✦", face: "🌟", rarity: "rare", role: "Burst", basePower: 26, vibe: "glow", blurb: "Starflash strike." },
    { id: "tide", name: "Tide", icon: "🌊", face: "🌊", rarity: "rare", role: "Wave", basePower: 24, vibe: "tide", blurb: "Pushes the board." },
    { id: "quake", name: "Quake", icon: "🌋", face: "🌋", rarity: "rare", role: "Breaker", basePower: 25, vibe: "quake", blurb: "Cracks enemy armor." },
    { id: "mirage", name: "Mirage", icon: "🪞", face: "🪞", rarity: "rare", role: "Trickster", basePower: 23, vibe: "ghost", blurb: "Hard to pin down." },

    // Epics
    { id: "phantom", name: "Phantom", icon: "👁", face: "👻", rarity: "epic", role: "Haunt", basePower: 40, vibe: "ghost", blurb: "Slips through steel." },
    { id: "titan", name: "Titan", icon: "🏛", face: "🗿", rarity: "epic", role: "Colossus", basePower: 48, vibe: "heavy", blurb: "Arena-shaking mass." },
    { id: "venom", name: "Venom", icon: "🐍", face: "🐍", rarity: "epic", role: "Assassin", basePower: 44, vibe: "venom", blurb: "Toxic finishers." },
    { id: "tempest", name: "Tempest", icon: "🌪", face: "🌪", rarity: "epic", role: "Storm", basePower: 46, vibe: "storm", blurb: "Spins the fight wild." },

    // Legendaries
    { id: "sovereign", name: "Sovereign", icon: "👑", face: "🦁", rarity: "legendary", role: "King", basePower: 72, vibe: "royal", blurb: "Rules the clash." },
    { id: "eclipse", name: "Eclipse", icon: "🌑", face: "🌑", rarity: "legendary", role: "Void", basePower: 78, vibe: "eclipse", blurb: "Eats the light." },
    { id: "aurora", name: "Aurora", icon: "🌈", face: "🦊", rarity: "legendary", role: "Myth", basePower: 75, vibe: "aurora", blurb: "Skyfire legend." },
    { id: "panda", name: "Panda King", icon: "🐼", face: "🐼", rarity: "legendary", role: "Mascot", basePower: 80, vibe: "royal", blurb: "Arena’s secret boss cheer." }
  ];

  const BUDDY_LINES = [
    { title: "Arena Panda", line: "Merge twins — I cheer louder every fuse!" },
    { title: "Arena Panda", line: "Get Hero! New fighters can surprise you." },
    { title: "Arena Panda", line: "Same heroes? Drag them together — boom!" },
    { title: "Arena Panda", line: "Squad looking spicy. Enter Fight when ready." },
    { title: "Arena Panda", line: "Hero Vault is huge now — unlock them all!" },
    { title: "Arena Panda", line: "Rare drop? Lucky! Fuse it higher." }
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
    legend_summon: {
      title: "Legend Call",
      text: "Summon a Legendary onto your board now.",
      stars: 180,
      apply(state) {
        return placeGuaranteed(state, "legendary");
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

  // Soft currency spends — gems actually do something fun
  const GEM_SHOP = {
    gem_energy_sip: {
      title: "Crystal Sip",
      text: "+5 energy from your gem stash.",
      gems: 50,
      apply(st) {
        st.energy = Math.min(ENERGY_MAX, st.energy + 5);
        st.lastEnergyAt = Date.now();
        return null;
      }
    },
    gem_lucky_drop: {
      title: "Lucky Drop",
      text: "Spin a gem chest — Rare often, Epic sometimes.",
      gems: 100,
      apply(st) {
        const roll = Math.random();
        const rarity = roll < 0.72 ? "rare" : roll < 0.97 ? "epic" : "legendary";
        const err = placeGuaranteed(st, rarity);
        if (err) return err;
        st._lastGemLoot = rarity;
        return null;
      }
    },
    gem_auto_fuse: {
      title: "Instant Fuse",
      text: "Auto-merge one matching pair on the board.",
      gems: 80,
      apply(st) {
        for (let i = 0; i < SIZE; i += 1) {
          const a = st.board[i];
          if (!a || a.level >= 5) continue;
          for (let j = i + 1; j < SIZE; j += 1) {
            const b = st.board[j];
            if (!b || b.id !== a.id || b.level !== a.level) continue;
            const merged = makeUnit(a.id, a.level + 1);
            merged.rarity = rarityForLevel(merged.level);
            st.board[j] = merged;
            st.board[i] = null;
            st.merges += 1;
            st.gems += merged.level >= 4 ? 15 : 5;
            if (!st.discovered.includes(merged.id)) st.discovered.push(merged.id);
            st._lastGemLoot = `${defById(merged.id).name} L${merged.level}`;
            return null;
          }
        }
        return "No matching pair to fuse yet.";
      }
    },
    gem_power_charm: {
      title: "Power Charm",
      text: "+40% squad power for your next fight only.",
      gems: 120,
      apply(st) {
        st.charmBattles = Math.max(0, Number(st.charmBattles || 0)) + 1;
        return null;
      }
    },
    gem_board_breeze: {
      title: "Board Breeze",
      text: "Clear your weakest hero and free a slot.",
      gems: 70,
      apply(st) {
        let weakestIdx = -1;
        let weakestPow = Infinity;
        st.board.forEach((u, i) => {
          if (!u) return;
          const p = powerOf(u);
          if (p < weakestPow) {
            weakestPow = p;
            weakestIdx = i;
          }
        });
        if (weakestIdx < 0) return "Board is empty — nothing to clear.";
        const gone = st.board[weakestIdx];
        st.board[weakestIdx] = null;
        st._lastGemLoot = defById(gone.id).name;
        return null;
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
    charmBattles: 0,
    dailyStreak: 0,
    dailyClaimDate: "",
    referralCount: 0,
    referredBy: "",
    referralClaimed: false,
    adLastClaimAt: 0,
    soundOn: true,
    discovered: ["spark", "blade"],
    board: Array(SIZE).fill(null),
    lastEnergyAt: Date.now()
  });

  const SYNERGIES = [
    { roles: ["Burner", "Freezer"], bonus: 0.12, label: "Fire & Ice" },
    { roles: ["Guardian", "Tanklet"], bonus: 0.1, label: "Iron Wall" },
    { roles: ["Assassin", "Haunt"], bonus: 0.14, label: "Shadow Pair" },
    { roles: ["Storm", "Burst"], bonus: 0.12, label: "Sky Burst" },
    { roles: ["Beast", "Duelist"], bonus: 0.1, label: "Blood Duel" },
    { roles: ["King", "Mascot"], bonus: 0.18, label: "Royal Panda" }
  ];

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
  let adsgramController = null;
  let playerId = "";
  let audioCtx = null;

  const $ = (id) => document.getElementById(id);

  const els = {
    energyValue: $("energyValue"),
    gemValue: $("gemValue"),
    gemChip: $("gemChip"),
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
    buddyTitle: $("buddyTitle"),
    buddyLine: $("buddyLine"),
    arenaBuddy: $("arenaBuddy"),
    clashPanel: $("clashPanel"),
    clashStatus: $("clashStatus"),
    clashYou: $("clashYou"),
    clashEnemy: $("clashEnemy"),
    clashFill: $("clashFill"),
    clashTip: $("clashTip"),
    rosterGrid: $("rosterGrid"),
    dailyClaim: $("dailyClaim"),
    dailyStreak: $("dailyStreak"),
    dailyTip: $("dailyTip"),
    dailyCard: $("dailyCard"),
    synergyText: $("synergyText"),
    inviteShare: $("inviteShare"),
    inviteCopy: $("inviteCopy"),
    inviteMeta: $("inviteMeta"),
    leaderboard: $("leaderboard"),
    soundToggle: $("soundToggle"),
    battleStage: $("battleStage"),
    battleFx: $("battleFx"),
    payNote: $("payNote"),
    adEnergyBtn: $("adEnergyBtn"),
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
    if (result.user && result.user.id) playerId = String(result.user.id);
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

  function activeSynergies() {
    const roles = {};
    state.board.forEach((u) => {
      if (!u) return;
      const role = defById(u.id).role || "";
      if (!role) return;
      roles[role] = (roles[role] || 0) + 1;
    });
    return SYNERGIES.filter((s) => s.roles.every((role) => (roles[role] || 0) >= 1));
  }

  function synergyBonus() {
    return activeSynergies().reduce((sum, s) => sum + s.bonus, 0);
  }

  function squadPower() {
    const raw = state.board.reduce((sum, u) => sum + powerOf(u), 0);
    let mult = 1 + synergyBonus();
    if (state.surgeBattles > 0) mult += 0.3;
    if (state.charmBattles > 0) mult += 0.4;
    return Math.round(raw * mult);
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function yesterdayKey() {
    return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  }

  function dailyRewardForStreak(streak) {
    const s = Math.max(1, streak);
    return {
      gems: 30 + s * 15,
      energy: Math.min(8, 2 + Math.floor(s / 2))
    };
  }

  function playTone(kind) {
    if (!state.soundOn) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      const map = {
        merge: [520, 740],
        summon: [360, 480],
        hit: [180, 120],
        win: [440, 660, 880],
        lose: [220, 160],
        claim: [500, 700],
        click: [300, 340]
      };
      const freqs = map[kind] || map.click;
      freqs.forEach((freq, i) => {
        const o = i === 0 ? osc : audioCtx.createOscillator();
        const g = i === 0 ? gain : audioCtx.createGain();
        if (i > 0) {
          o.connect(g);
          g.connect(audioCtx.destination);
        }
        o.type = kind === "hit" ? "square" : "sine";
        o.frequency.setValueAtTime(freq, now + i * 0.07);
        g.gain.setValueAtTime(0.0001, now + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.05, now + i * 0.07 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.16);
        o.start(now + i * 0.07);
        o.stop(now + i * 0.07 + 0.18);
      });
    } catch {
      // ignore audio failures
    }
  }

  function getInviteLink() {
    const cfg = window.WEALTHIA_CONFIG || {};
    const bot = String(cfg.BOT_USERNAME || "MergeArenaBot").replace(/^@/, "");
    const id = playerId || (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user && window.Telegram.WebApp.initDataUnsafe.user.id) || "";
    if (!id) return `https://t.me/${bot}`;
    return `https://t.me/${bot}?start=maref_${id}`;
  }

  function parseStartReferrer() {
    const tg = window.Telegram && window.Telegram.WebApp;
    const start = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param
      ? String(tg.initDataUnsafe.start_param)
      : "";
    const match = start.match(/(?:maref_|ref_)?(\d{5,})/);
    return match ? match[1] : "";
  }

  function applyReferralIfNeeded() {
    const ref = parseStartReferrer();
    if (!ref || state.referralClaimed) return;
    const me = String(playerId || "");
    if (!me || ref === me) return;
    state.referredBy = ref;
    state.referralClaimed = true;
    state.gems += 25;
    state.energy = ENERGY_MAX;
    state.lastEnergyAt = Date.now();
    // Credit inviter locally when this device is the inviter later via invite meta;
    // also stash a one-time inviter bonus marker for cloud-aware clients.
    try {
      const key = `merge_arena_ref_bonus_${ref}`;
      const n = Number(localStorage.getItem(key) || 0) + 1;
      localStorage.setItem(key, String(n));
    } catch {
      // ignore
    }
    saveState();
    showToast(`Welcome gift: +25 💎 · full ${ENERGY_MAX} ⚡`);
  }

  function collectPendingInviteBonus() {
    if (!playerId) return;
    try {
      const key = `merge_arena_ref_bonus_${playerId}`;
      const n = Number(localStorage.getItem(key) || 0);
      if (n <= 0) return;
      localStorage.removeItem(key);
      state.referralCount = Number(state.referralCount || 0) + n;
      state.gems += n * 40;
      state.energy = ENERGY_MAX;
      state.lastEnergyAt = Date.now();
      saveState();
      showToast(`Invite bonus · ${n} friend${n > 1 ? "s" : ""} · +${n * 40} 💎 · full ${ENERGY_MAX} ⚡`);
    } catch {
      // ignore
    }
  }

  function initAdsGram() {
    const cfg = window.WEALTHIA_CONFIG || {};
    const blockId = String(cfg.ADSGRAM_BLOCK_ID || "").trim();
    if (!blockId || !window.Adsgram) return;
    try {
      adsgramController = window.Adsgram.init({
        blockId,
        debug: Boolean(cfg.ADSGRAM_DEBUG)
      });
    } catch {
      adsgramController = null;
    }
  }

  async function watchAdForEnergy() {
    const now = Date.now();
    if (now - Number(state.adLastClaimAt || 0) < 60000) {
      showToast("Ad cooldown — wait a minute.");
      return;
    }
    let watched = false;
    if (adsgramController) {
      try {
        const result = await adsgramController.show();
        watched = Boolean(result && result.done);
        if (!watched) {
          showToast((result && result.description) || "Watch the full ad to charge.");
          return;
        }
      } catch (error) {
        showToast((error && error.description) || "Ad unavailable right now.");
        return;
      }
    } else {
      // Demo fallback when AdsGram block is missing / not ready
      watched = window.confirm("Demo ad complete?\n\nOK = grant +4 energy");
      if (!watched) return;
    }
    state.adLastClaimAt = now;
    state.energy = Math.min(ENERGY_MAX, state.energy + 4);
    state.lastEnergyAt = now;
    saveState();
    renderHud();
    playTone("claim");
    haptic("success");
    showToast("+4 energy from Watch & Charge");
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

  function randomSummonId() {
    // Mostly commons, with spicy rare/epic spice so the vault fills up
    const roll = Math.random();
    if (roll < 0.78) return randomCommonId();
    if (roll < 0.96) return unitForRarity("rare").id;
    return unitForRarity("epic").id;
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
    const level = rarity === "legendary" ? 5 : rarity === "epic" ? 4 : 3;
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
    const buddy = document.getElementById("arenaBuddy");
    const clash = document.getElementById("clashPanel");
    const appH = app ? app.clientHeight : window.innerHeight;
    // Bottom controls get priority; board stays compact
    const reserved =
      (dock ? Math.max(dock.offsetHeight, 64) : 64) +
      (actions ? Math.max(actions.offsetHeight, 56) : 56) +
      (hud ? hud.offsetHeight : 30) +
      (wave ? wave.offsetHeight : 36) +
      (hint ? Math.max(hint.offsetHeight, 18) : 18) +
      (strip ? Math.max(strip.offsetHeight || 48, 48) : 48) +
      (buddy ? Math.max(buddy.offsetHeight || 54, 54) : 54) +
      (clash ? Math.max(clash.offsetHeight || 72, 72) : 72) +
      28;
    const appW = app ? app.clientWidth : window.innerWidth;
    const styles = window.getComputedStyle(wrap);
    const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const availW = Math.max(160, Math.min(appW - 28, (wrap.parentElement ? wrap.parentElement.clientWidth : appW) - 8) - padX);
    const fromViewport = Math.max(140, appH - reserved);
    if (availW < 40) return;
    // Hard cap ~30% of height so clash panel stays visible
    const maxBoard = Math.floor(appH * 0.3);
    const size = Math.floor(Math.min(availW, fromViewport, maxBoard));
    els.board.style.width = `${size}px`;
    els.board.style.height = `${size}px`;
    els.board.style.maxWidth = "100%";
    els.board.style.maxHeight = "100%";
    wrap.style.width = `${size + padX}px`;
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
    if (name === "rank") {
      renderGlory();
      loadLeaderboard();
    }
    if (name === "play") requestAnimationFrame(fitBoard);
  }

  function renderHud() {
    regenEnergy();
    els.energyValue.textContent = String(state.energy);
    if (els.energyChip) els.energyChip.title = `Energy ${state.energy}/${ENERGY_MAX}`;
    els.gemValue.textContent = String(state.gems);
    if (els.gemChip) {
      els.gemChip.title = state.charmBattles > 0
        ? `Gems ${state.gems} · Power Charm ready`
        : `Gems ${state.gems} · Tap to open Gem Vault`;
    }
    els.trophyValue.textContent = String(state.trophies);
    els.waveTitle.textContent = `Arena ${state.wave}`;
    const power = squadPower();
    els.powerValue.textContent = String(power);
    state.highestPower = Math.max(state.highestPower, power);
    els.summonButton.disabled = state.energy < 1 || emptySlots().length === 0;
    els.battleButton.disabled = battleBusy || state.energy < 1 || power <= 0;
  }

  function cheerBuddy(kind) {
    if (!els.buddyLine || !els.arenaBuddy) return;
    const power = squadPower();
    let pick = BUDDY_LINES[0];
    if (kind === "summon") pick = BUDDY_LINES[1];
    else if (kind === "merge") pick = { title: "Arena Panda", line: "Fusion pop! That one felt 3D." };
    else if (kind === "fight") pick = { title: "Arena Panda", line: "Go go! Smash Arena " + state.wave + "!" };
    else if (kind === "win") pick = { title: "Arena Panda", line: "Victory dance! You cleared it." };
    else if (kind === "lose") pick = { title: "Arena Panda", line: "Shake it off — fuse stronger and retry." };
    else if (power >= 80) pick = BUDDY_LINES[3];
    else if (power >= 40) pick = BUDDY_LINES[4];
    else if (!state.board.some(Boolean)) pick = BUDDY_LINES[1];
    else pick = BUDDY_LINES[Math.floor(Math.random() * BUDDY_LINES.length)];
    if (els.buddyTitle) els.buddyTitle.textContent = pick.title;
    els.buddyLine.textContent = pick.line;
    els.arenaBuddy.classList.remove("is-cheer");
    void els.arenaBuddy.offsetWidth;
    els.arenaBuddy.classList.add("is-cheer");
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
        node.dataset.vibe = def.vibe || "zap";
        node.dataset.hero = def.id;
        node.dataset.index = String(i);
        node.innerHTML = `
          <span class="unit__lvl">L${unit.level}</span>
          <div class="unit__stage">
            <span class="unit__glow"></span>
            <span class="unit__shadow"></span>
            <span class="unit__char" aria-hidden="true">${def.face || def.icon}</span>
            <span class="unit__ring"></span>
          </div>
          <span class="unit__name">${def.name}</span>
          <span class="unit__pow">${powerOf(unit)}</span>
        `;
        bindUnitDrag(node, i);
        cell.appendChild(node);
      }
      els.board.appendChild(cell);
    }
    renderStrip();
    renderClash();
    renderHud();
    requestAnimationFrame(fitBoard);
  }

  function renderClash() {
    if (!els.clashPanel) return;
    const you = squadPower();
    const enemy = enemyPower(state.wave);
    const ratio = enemy > 0 ? Math.min(1.2, you / enemy) : 0;
    const fill = Math.max(6, Math.min(100, Math.round(ratio * 100)));
    if (els.clashYou) els.clashYou.textContent = String(you);
    if (els.clashEnemy) els.clashEnemy.textContent = String(enemy);
    if (els.clashFill) els.clashFill.style.width = `${fill}%`;

    let status = "Keep forging";
    let tip = "Fuse matching heroes to raise squad power.";
    let tone = "warn";
    const occupied = state.board.filter(Boolean).length;
    const canMerge = state.board.some((a, i) =>
      a && state.board.some((b, j) => j > i && b && a.id === b.id && a.level === b.level && a.level < 5)
    );

    if (you <= 0) {
      status = "Need heroes";
      tip = "Tap Get Hero — drop fighters onto the floor.";
      tone = "idle";
    } else if (you >= enemy) {
      status = "Ready to smash";
      tip = `Arena ${state.wave} looks beatable. Enter Fight when ready.`;
      tone = "ready";
    } else if (canMerge) {
      status = "Fusion available";
      tip = "Drag matching heroes together — one fuse can flip the fight.";
      tone = "fuse";
    } else if (occupied >= SIZE) {
      status = "Board packed";
      tip = "No empty slots. Fuse twins or fight with what you have.";
      tone = "warn";
    } else {
      const need = Math.max(1, enemy - you);
      status = `Need +${need} power`;
      tip = "Get Hero, then fuse twins before the clash.";
      tone = "warn";
    }

    const syn = activeSynergies();
    if (syn.length && els.clashTip) {
      tip = `${syn.map((s) => s.label).join(" + ")} active · ${tip}`;
    }

    if (els.clashStatus) els.clashStatus.textContent = status;
    if (els.clashTip) els.clashTip.textContent = tip;
    els.clashPanel.dataset.tone = tone;
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
        return `<div class="strip-card" data-rarity="${def.rarity}"><strong>${def.face || def.icon} ${def.name}</strong><span>L${level} · x${count}</span></div>`;
      })
      .join("");
  }

  function renderRoster() {
    const unlockedCount = UNIT_DEFS.filter((d) => state.discovered.includes(d.id)).length;
    const headP = document.querySelector("#view-roster .section-head p");
    if (headP) {
      headP.textContent = `${unlockedCount}/${UNIT_DEFS.length} unlocked · Fuse twins. Collect legends.`;
    }
    const order = ["common", "rare", "epic", "legendary"];
    const sorted = [...UNIT_DEFS].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
    els.rosterGrid.innerHTML = sorted.map((def) => {
      const unlocked = state.discovered.includes(def.id);
      return `
        <article class="roster-card ${unlocked ? "" : "is-locked"}" data-rarity="${def.rarity}">
          <div class="roster-card__unit" data-rarity="${def.rarity}" data-hero="${def.id}" data-vibe="${def.vibe}">
            ${unlocked ? (def.face || def.icon) : "?"}
          </div>
          <div class="roster-card__meta">
            <span class="roster-card__rarity">${def.rarity}</span>
            <span class="roster-card__role">${def.role || "Hero"}</span>
          </div>
          <h3>${unlocked ? def.name : "Locked"}</h3>
          <p>${unlocked ? (def.blurb || `${def.rarity} fighter`) : "Keep merging to reveal"} · ${def.basePower}⚡</p>
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
    renderDaily();
    renderSynergyCard();
    renderInvite();
  }

  function renderDaily() {
    if (!els.dailyClaim) return;
    const today = todayKey();
    const claimed = state.dailyClaimDate === today;
    const streak = Number(state.dailyStreak || 0);
    const nextStreak = claimed ? streak : (state.dailyClaimDate === yesterdayKey() ? streak + 1 : 1);
    const reward = dailyRewardForStreak(Math.max(1, nextStreak));
    if (els.dailyStreak) els.dailyStreak.textContent = `Streak ${streak}`;
    if (els.dailyTip) {
      els.dailyTip.textContent = claimed
        ? "Claimed today. Come back tomorrow for a bigger chest."
        : `Ready: +${reward.gems} 💎 and +${reward.energy} ⚡`;
    }
    els.dailyClaim.disabled = claimed;
    els.dailyClaim.textContent = claimed ? "Claimed" : "Claim";
    if (els.dailyCard) els.dailyCard.dataset.ready = claimed ? "0" : "1";
  }

  function claimDaily() {
    const today = todayKey();
    if (state.dailyClaimDate === today) {
      showToast("Already claimed today.");
      return;
    }
    const streak = state.dailyClaimDate === yesterdayKey()
      ? Number(state.dailyStreak || 0) + 1
      : 1;
    const reward = dailyRewardForStreak(streak);
    state.dailyStreak = streak;
    state.dailyClaimDate = today;
    state.gems += reward.gems;
    state.energy = Math.min(ENERGY_MAX, state.energy + reward.energy);
    state.lastEnergyAt = Date.now();
    saveState();
    renderHud();
    renderGlory();
    playTone("claim");
    haptic("success");
    cheerBuddy("win");
    showToast(`Daily claimed · +${reward.gems} 💎 +${reward.energy} ⚡ · streak ${streak}`);
  }

  function renderSynergyCard() {
    if (!els.synergyText) return;
    const list = activeSynergies();
    if (!list.length) {
      els.synergyText.textContent = "No synergy yet — mix roles like Burner+Freezer or King+Panda.";
      return;
    }
    const bonus = Math.round(synergyBonus() * 100);
    els.synergyText.textContent = list.map((s) => s.label).join(" · ") + ` · +${bonus}% power`;
  }

  function renderInvite() {
    if (els.inviteMeta) {
      els.inviteMeta.textContent = `${state.referralCount || 0} friends joined`;
    }
  }

  async function loadLeaderboard() {
    if (!els.leaderboard) return;
    els.leaderboard.innerHTML = `<div class="leaderboard__empty">Loading ranks…</div>`;
    try {
      const { ok, result } = await api("/api/merge-arena/leaderboard?sort=trophies");
      const rows = (ok && result && result.rows) || [];
      if (!rows.length) {
        els.leaderboard.innerHTML = `<div class="leaderboard__empty">Be first on the board — win a fight!</div>`;
        return;
      }
      els.leaderboard.innerHTML = rows.map((row) => `
        <div class="leaderboard__row ${String(row.userId) === String(playerId) ? "is-me" : ""}">
          <span class="leaderboard__rank">#${row.rank}</span>
          <span class="leaderboard__name">${row.name}</span>
          <strong class="leaderboard__score">${row.trophies} 🏆</strong>
          <span class="leaderboard__wave">A${row.bestWave}</span>
        </div>
      `).join("");
    } catch {
      els.leaderboard.innerHTML = `<div class="leaderboard__empty">Ranks offline — keep climbing locally.</div>`;
    }
  }

  async function shareInvite() {
    const link = getInviteLink();
    const text = `Merge heroes. Climb arenas. Join my MERGE ARENA squad:\n${link}`;
    const tg = window.Telegram && window.Telegram.WebApp;
    playTone("click");
    if (tg && typeof tg.openTelegramLink === "function") {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Merge heroes with me in MERGE ARENA!")}`);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "MERGE ARENA", text, url: link });
        return;
      } catch {
        // fall through
      }
    }
    await copyInvite();
  }

  async function copyInvite() {
    const link = getInviteLink();
    try {
      await navigator.clipboard.writeText(link);
      showToast("Invite link copied");
    } catch {
      window.prompt("Copy invite link", link);
    }
    playTone("click");
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
      cheerBuddy("merge");
      showToast(`Fusion! ${defById(merged.id).name} L${merged.level}`);
      playTone("merge");
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

    const id = forceId || randomSummonId();
    const unit = makeUnit(id, forceLevel || 1);
    if (forceLevel) unit.rarity = rarityForLevel(forceLevel);
    // Keep natural rarity for spicy Get Hero drops
    if (!forceId && !forceLevel) unit.rarity = defById(id).rarity;
    const slot = slots[Math.floor(Math.random() * slots.length)];
    state.board[slot] = unit;
    discover(id);
    saveState();
    renderBoard();
    if (!forceId) {
      cheerBuddy("summon");
      showToast(`${defById(id).name} enters the arena`);
      playTone("summon");
    }
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
    cheerBuddy("fight");
    playTone("hit");

    const wave = state.wave;
    const enemy = enemyPower(wave);
    const syn = activeSynergies();
    els.battleModal.hidden = false;
    if (els.battleStage) els.battleStage.classList.add("is-fighting");
    els.fighterYou.textContent = `YOU ${power}`;
    els.fighterEnemy.textContent = `L${wave} ${enemy}`;
    els.youBar.style.width = "100%";
    els.enemyBar.style.width = "100%";
    els.battleLog.textContent = syn.length
      ? `${syn[0].label} ignites the clash…`
      : "Clash ignites…";
    if (els.battleFx) els.battleFx.textContent = "💥";

    await wait(500);
    els.battleLog.textContent = "Heroes collide!";
    playTone("hit");
    await wait(400);

    const youRatio = power / (power + enemy);
    const steps = 10;
    for (let i = 1; i <= steps; i += 1) {
      const progress = i / steps;
      const youLeft = Math.max(0, 100 - progress * 100 * (1 - youRatio) * 1.35);
      const enemyLeft = Math.max(0, 100 - progress * 100 * youRatio * 1.35);
      els.youBar.style.width = `${youLeft}%`;
      els.enemyBar.style.width = `${enemyLeft}%`;
      if (els.battleStage) {
        els.battleStage.classList.toggle("is-shake", i % 2 === 0);
      }
      if (els.battleFx) {
        els.battleFx.textContent = i % 3 === 0 ? "⚡" : i % 2 === 0 ? "💥" : "✦";
      }
      if (i % 2 === 0) playTone("hit");
      await wait(110);
    }

    const won = power >= enemy;
    if (state.surgeBattles > 0) state.surgeBattles -= 1;
    if (state.charmBattles > 0) state.charmBattles -= 1;

    if (won) {
      const trophyGain = 8 + wave * 2;
      const gemGain = 20 + wave * 5;
      state.wins += 1;
      state.trophies += trophyGain;
      state.gems += gemGain;
      state.wave += 1;
      state.bestWave = Math.max(state.bestWave, state.wave);
      consumeWeakest();
      saveState();
      els.battleModal.hidden = true;
      if (els.battleStage) els.battleStage.classList.remove("is-fighting", "is-shake");
      showResult(true, wave, trophyGain, gemGain);
      playTone("win");
      haptic("success");
    } else {
      const loss = Math.min(state.trophies, 4 + Math.floor(wave / 2));
      const gemGain = 5;
      state.trophies = Math.max(0, state.trophies - loss);
      state.gems += gemGain;
      consumeWeakest();
      saveState();
      els.battleModal.hidden = true;
      if (els.battleStage) els.battleStage.classList.remove("is-fighting", "is-shake");
      showResult(false, wave, -loss, gemGain);
      playTone("lose");
      haptic("error");
    }

    battleBusy = false;
    cheerBuddy(won ? "win" : "lose");
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
    if (productId === "ad_energy") {
      watchAdForEnergy();
      return;
    }
    if (GEM_SHOP[productId]) {
      openGemSpend(productId);
      return;
    }
    const product = SHOP[productId];
    if (!product) return;
    pendingPurchase = productId;
    els.payTitle.textContent = product.title;
    els.payText.textContent = `${product.text} · Exact price: ${product.stars} Stars`;
    if (els.payConfirm) els.payConfirm.textContent = "Pay Stars";
    if (els.payNote) {
      els.payNote.textContent = "Opens Telegram Stars invoice when available.";
    }
    els.payModal.hidden = false;
  }

  function openGemSpend(productId) {
    const product = GEM_SHOP[productId];
    if (!product) return;
    pendingPurchase = productId;
    els.payTitle.textContent = product.title;
    els.payText.textContent = `${product.text} · Costs ${product.gems} 💎 (you have ${state.gems})`;
    if (els.payConfirm) els.payConfirm.textContent = `Spend ${product.gems} 💎`;
    els.payModal.hidden = false;
  }

  function closePay() {
    pendingPurchase = null;
    els.payModal.hidden = true;
    if (els.payConfirm) els.payConfirm.textContent = "Pay Stars";
  }

  async function confirmPay() {
    if (!pendingPurchase) return;
    const productId = pendingPurchase;

    if (GEM_SHOP[productId]) {
      const product = GEM_SHOP[productId];
      if (state.gems < product.gems) {
        closePay();
        showToast(`Need ${product.gems} 💎 — fuse & fight to earn more.`);
        return;
      }
      state.gems -= product.gems;
      delete state._lastGemLoot;
      const err = product.apply(state);
      if (typeof err === "string") {
        state.gems += product.gems;
        closePay();
        showToast(err);
        return;
      }
      const loot = state._lastGemLoot;
      delete state._lastGemLoot;
      saveState();
      closePay();
      renderBoard();
      renderHud();
      cheerBuddy("summon");
      playTone("claim");
      showToast(loot ? `${product.title}: ${loot}` : `${product.title} unlocked`);
      haptic("success");
      if (
        productId === "gem_lucky_drop" ||
        productId === "gem_auto_fuse" ||
        productId === "gem_board_breeze"
      ) {
        switchView("play");
      }
      return;
    }

    const product = SHOP[productId];
    if (!product) return;

    const tg = window.Telegram && window.Telegram.WebApp;
    const canInvoice = Boolean(sessionToken && tg && typeof tg.openInvoice === "function");

    if (canInvoice) {
      try {
        if (els.payConfirm) {
          els.payConfirm.disabled = true;
          els.payConfirm.textContent = "Opening…";
        }
        const { ok, result } = await api("/api/merge-arena/stars/invoice", {
          method: "POST",
          body: { productId }
        });
        if (!ok || !result?.invoiceLink) {
          throw new Error((result && result.error) || "Invoice unavailable");
        }
        closePay();
        tg.openInvoice(String(result.invoiceLink), (status) => {
          if (status === "paid") {
            const err = product.apply(state);
            if (typeof err === "string") {
              showToast(err);
              return;
            }
            saveState();
            renderBoard();
            renderHud();
            playTone("claim");
            haptic("success");
            showToast(`${product.title} secured with Stars`);
            if (productId === "rare_summon" || productId === "epic_summon" || productId === "legend_summon") {
              switchView("play");
            }
          } else if (status === "cancelled") {
            showToast("Payment cancelled");
          } else if (status === "failed") {
            showToast("Payment failed");
          }
        });
        return;
      } catch (error) {
        showToast((error && error.message) || "Stars invoice failed — using demo.");
      } finally {
        if (els.payConfirm) {
          els.payConfirm.disabled = false;
          els.payConfirm.textContent = "Pay Stars";
        }
      }
    }

    // Demo Stars purchase fallback
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
    playTone("claim");
    showToast(`${product.title} secured`);
    haptic("success");
    if (productId === "rare_summon" || productId === "epic_summon" || productId === "legend_summon") {
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
    if (els.gemChip) {
      els.gemChip.addEventListener("click", () => {
        switchView("shop");
        const vault = document.querySelector(".shop-lane");
        if (vault && vault.scrollIntoView) vault.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast(`Gem Vault open · ${state.gems} 💎 ready`);
      });
    }
    if (els.dailyClaim) els.dailyClaim.addEventListener("click", () => claimDaily());
    if (els.inviteShare) els.inviteShare.addEventListener("click", () => shareInvite());
    if (els.inviteCopy) els.inviteCopy.addEventListener("click", () => copyInvite());
    if (els.adEnergyBtn) {
      els.adEnergyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        watchAdForEnergy();
      });
    }
    if (els.soundToggle) {
      els.soundToggle.addEventListener("click", () => {
        state.soundOn = !state.soundOn;
        els.soundToggle.textContent = state.soundOn ? "🔊" : "🔇";
        saveState();
        if (state.soundOn) playTone("click");
        showToast(state.soundOn ? "Sound on" : "Sound muted");
      });
    }
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
    initAdsGram();
    fitViewport();
    window.addEventListener("resize", fitViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitViewport);
    }
    seedIfEmpty();
    bind();
    if (els.soundToggle) els.soundToggle.textContent = state.soundOn ? "🔊" : "🔇";
    renderBoard();
    cheerBuddy("idle");
    renderRoster();
    renderGlory();
    openTutorial();
    connectCloud().then(() => {
      applyReferralIfNeeded();
      renderInvite();
    });
    const tag = document.getElementById("buildTag");
    if (tag) {
      setTimeout(() => showToast(`Build ${tag.textContent} · full pack live`), 500);
    }
    if (state.dailyClaimDate !== todayKey()) {
      setTimeout(() => showToast("Daily Chest ready in Glory"), 1400);
    }
    if (state.energy <= 3) {
      setTimeout(() => showToast("Energy low — Watch & Charge or Star Market."), 2200);
    }
  }

  boot();
})();
