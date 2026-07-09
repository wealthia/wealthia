(() => {
  const STORAGE_KEY = "merge_arena_v2";
  const API_URL = (window.WEALTHIA_CONFIG && window.WEALTHIA_CONFIG.API_URL) ||
    "https://merge-arena-api.onrender.com";
  const COLS = 4;
  const ROWS = 4;
  const SIZE = COLS * ROWS;
  // Mid energy economy — playable sessions, still need Stars/gems to spam.
  const ENERGY_MAX = 14;
  const ENERGY_REGEN_MS = 150000; // 1⚡ every 2.5 minutes
  const AD_ENERGY_GAIN = 3;
  const AD_ENERGY_COOLDOWN_MS = 2 * 60 * 1000;

  // 50 heroes — commons fuel merges; rares/epics/legends carry late gates
  const UNIT_DEFS = [
    // Commons (20)
    { id: "spark", name: "Spark", icon: "⚡", face: "⚡", rarity: "common", role: "Striker", basePower: 11, vibe: "zap", blurb: "Fast fuse fuel." , unlockWave: 1 },
    { id: "blade", name: "Blade", icon: "🗡", face: "⚔", rarity: "common", role: "Duelist", basePower: 13, vibe: "slash", blurb: "Clean edge damage." , unlockWave: 1 },
    { id: "ember", name: "Ember", icon: "🔥", face: "🔥", rarity: "common", role: "Burner", basePower: 12, vibe: "fire", blurb: "Leaves a hot trail." , unlockWave: 1 },
    { id: "frost", name: "Frost", icon: "❄️", face: "❄️", rarity: "common", role: "Freezer", basePower: 12, vibe: "ice", blurb: "Chills the lane." , unlockWave: 1 },
    { id: "fang", name: "Fang", icon: "🐺", face: "🐺", rarity: "common", role: "Beast", basePower: 14, vibe: "beast", blurb: "Bites above weight." , unlockWave: 2 },
    { id: "dart", name: "Dart", icon: "🏹", face: "🏹", rarity: "common", role: "Archer", basePower: 11, vibe: "bow", blurb: "Picks soft targets." , unlockWave: 2 },
    { id: "brew", name: "Brew", icon: "🧪", face: "🧪", rarity: "common", role: "Alchemist", basePower: 10, vibe: "brew", blurb: "Weird flask power." , unlockWave: 3 },
    { id: "cobble", name: "Cobble", icon: "🪨", face: "🪨", rarity: "common", role: "Tanklet", basePower: 15, vibe: "heavy", blurb: "Slow, stubborn rock." , unlockWave: 3 },
    { id: "pebble", name: "Pebble", icon: "🪨", face: "🪨", rarity: "common", role: "Tanklet", basePower: 14, vibe: "heavy", blurb: "Small stone, big block." , unlockWave: 4 },
    { id: "pixie", name: "Pixie", icon: "✨", face: "✨", rarity: "common", role: "Trickster", basePower: 10, vibe: "glow", blurb: "Sparkle and dodge." , unlockWave: 4 },
    { id: "scout", name: "Scout", icon: "🧭", face: "🧭", rarity: "common", role: "Archer", basePower: 11, vibe: "bow", blurb: "Maps the next clash." , unlockWave: 5 },
    { id: "cinder", name: "Cinder", icon: "🪵", face: "🪵", rarity: "common", role: "Burner", basePower: 12, vibe: "fire", blurb: "Smoldering scrap." , unlockWave: 5 },
    { id: "drizzle", name: "Drizzle", icon: "💧", face: "💧", rarity: "common", role: "Wave", basePower: 11, vibe: "tide", blurb: "Soft rain pressure." , unlockWave: 6 },
    { id: "sprout", name: "Sprout", icon: "🌱", face: "🌱", rarity: "common", role: "Healer", basePower: 10, vibe: "glow", blurb: "Tiny green grit." , unlockWave: 6 },
    { id: "buzz", name: "Buzz", icon: "🐝", face: "🐝", rarity: "common", role: "Striker", basePower: 12, vibe: "zap", blurb: "Stings then zips." , unlockWave: 8 },
    { id: "crumb", name: "Crumb", icon: "🍪", face: "🍪", rarity: "common", role: "Mascot", basePower: 9, vibe: "brew", blurb: "Snack-powered punch." , unlockWave: 8 },
    { id: "shade", name: "Shade", icon: "🕶", face: "🕶", rarity: "common", role: "Haunt", basePower: 12, vibe: "ghost", blurb: "Sneaks past guards." , unlockWave: 10 },
    { id: "bolt", name: "Bolt", icon: "🔩", face: "🔩", rarity: "common", role: "Breaker", basePower: 13, vibe: "quake", blurb: "Nuts-and-bolts bash." , unlockWave: 10 },
    { id: "howl", name: "Howl", icon: "🌙", face: "🌙", rarity: "common", role: "Beast", basePower: 13, vibe: "beast", blurb: "Night pack call." , unlockWave: 12 },
    { id: "glint", name: "Glint", icon: "💎", face: "💎", rarity: "common", role: "Burst", basePower: 11, vibe: "glow", blurb: "Tiny crystal flash." , unlockWave: 12 },

    // Rares (15)
    { id: "ward", name: "Ward", icon: "🛡", face: "🛡", rarity: "rare", role: "Guardian", basePower: 21, vibe: "guard", blurb: "Holds the line." , unlockWave: 5 },
    { id: "nova", name: "Nova", icon: "✦", face: "🌟", rarity: "rare", role: "Burst", basePower: 25, vibe: "glow", blurb: "Starflash strike." , unlockWave: 5 },
    { id: "tide", name: "Tide", icon: "🌊", face: "🌊", rarity: "rare", role: "Wave", basePower: 23, vibe: "tide", blurb: "Pushes the board." , unlockWave: 8 },
    { id: "quake", name: "Quake", icon: "🌋", face: "🌋", rarity: "rare", role: "Breaker", basePower: 24, vibe: "quake", blurb: "Cracks enemy armor." , unlockWave: 8 },
    { id: "mirage", name: "Mirage", icon: "🪞", face: "🪞", rarity: "rare", role: "Trickster", basePower: 22, vibe: "ghost", blurb: "Hard to pin down." , unlockWave: 10 },
    { id: "basil", name: "Basilisk", icon: "🦎", face: "🦎", rarity: "rare", role: "Assassin", basePower: 24, vibe: "venom", blurb: "Stone-cold stare." , unlockWave: 10 },
    { id: "aegis", name: "Aegis", icon: "🔰", face: "🔰", rarity: "rare", role: "Guardian", basePower: 23, vibe: "guard", blurb: "Shield wall specialist." , unlockWave: 12 },
    { id: "flare", name: "Flare", icon: "☄", face: "☄", rarity: "rare", role: "Burner", basePower: 24, vibe: "fire", blurb: "Comet-trail burn." , unlockWave: 12 },
    { id: "glacier", name: "Glacier", icon: "🧊", face: "🧊", rarity: "rare", role: "Freezer", basePower: 23, vibe: "ice", blurb: "Locks the lane cold." , unlockWave: 15 },
    { id: "raptor", name: "Raptor", icon: "🦖", face: "🦖", rarity: "rare", role: "Beast", basePower: 25, vibe: "beast", blurb: "Claws for days." , unlockWave: 15 },
    { id: "oracle", name: "Oracle", icon: "🔮", face: "🔮", rarity: "rare", role: "Myth", basePower: 22, vibe: "aurora", blurb: "Sees the next fuse." , unlockWave: 18 },
    { id: "volt", name: "Volt", icon: "⚡", face: "⚡", rarity: "rare", role: "Storm", basePower: 24, vibe: "storm", blurb: "Chain-zap specialist." , unlockWave: 18 },
    { id: "monk", name: "Monk", icon: "🧘", face: "🧘", rarity: "rare", role: "Healer", basePower: 21, vibe: "glow", blurb: "Calm power surge." , unlockWave: 20 },
    { id: "duelist", name: "Duelist", icon: "🤺", face: "🤺", rarity: "rare", role: "Duelist", basePower: 25, vibe: "slash", blurb: "One clean finish." , unlockWave: 20 },
    { id: "hex", name: "Hex", icon: "🧿", face: "🧿", rarity: "rare", role: "Haunt", basePower: 23, vibe: "ghost", blurb: "Curses the clash." , unlockWave: 20 },

    // Epics (10)
    { id: "phantom", name: "Phantom", icon: "👁", face: "👻", rarity: "epic", role: "Haunt", basePower: 38, vibe: "ghost", blurb: "Slips through steel." , unlockWave: 15 },
    { id: "titan", name: "Titan", icon: "🏛", face: "🗿", rarity: "epic", role: "Colossus", basePower: 46, vibe: "heavy", blurb: "Arena-shaking mass." , unlockWave: 15 },
    { id: "venom", name: "Venom", icon: "🐍", face: "🐍", rarity: "epic", role: "Assassin", basePower: 42, vibe: "venom", blurb: "Toxic finishers." , unlockWave: 20 },
    { id: "tempest", name: "Tempest", icon: "🌪", face: "🌪", rarity: "epic", role: "Storm", basePower: 44, vibe: "storm", blurb: "Spins the fight wild." , unlockWave: 20 },
    { id: "inferno", name: "Inferno", icon: "🔥", face: "🔥", rarity: "epic", role: "Burner", basePower: 45, vibe: "fire", blurb: "Whole-board heat." , unlockWave: 25 },
    { id: "cryo", name: "Cryo", icon: "❄️", face: "❄️", rarity: "epic", role: "Freezer", basePower: 43, vibe: "ice", blurb: "Deep-freeze lockdown." , unlockWave: 25 },
    { id: "behemoth", name: "Behemoth", icon: "🦏", face: "🦏", rarity: "epic", role: "Colossus", basePower: 47, vibe: "heavy", blurb: "Unstoppable charge." , unlockWave: 30 },
    { id: "specter", name: "Specter", icon: "💀", face: "💀", rarity: "epic", role: "Haunt", basePower: 41, vibe: "eclipse", blurb: "Drains enemy will." , unlockWave: 30 },
    { id: "raiden", name: "Raiden", icon: "⛈", face: "⛈", rarity: "epic", role: "Storm", basePower: 45, vibe: "storm", blurb: "Thunderclap finish." , unlockWave: 35 },
    { id: "bloom", name: "Bloom", icon: "🌸", face: "🌸", rarity: "epic", role: "Healer", basePower: 40, vibe: "aurora", blurb: "Petal-powered surge." , unlockWave: 35 },

    // Legendaries (5)
    { id: "sovereign", name: "Sovereign", icon: "👑", face: "🦁", rarity: "legendary", role: "King", basePower: 70, vibe: "royal", blurb: "Rules the clash." , unlockWave: 25 },
    { id: "eclipse", name: "Eclipse", icon: "🌑", face: "🌑", rarity: "legendary", role: "Void", basePower: 76, vibe: "eclipse", blurb: "Eats the light." , unlockWave: 30 },
    { id: "aurora", name: "Aurora", icon: "🌈", face: "🦊", rarity: "legendary", role: "Myth", basePower: 73, vibe: "aurora", blurb: "Skyfire legend." , unlockWave: 35 },
    { id: "panda", name: "Panda King", icon: "🐼", face: "🐼", rarity: "legendary", role: "Mascot", basePower: 78, vibe: "royal", blurb: "Arena’s secret boss cheer." , unlockWave: 40 },
    { id: "chronos", name: "Chronos", icon: "⏳", face: "⏳", rarity: "legendary", role: "Myth", basePower: 80, vibe: "aurora", blurb: "Bends the gate clock." , unlockWave: 50 }
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
      text: `Snap back to ${ENERGY_MAX} energy and keep climbing.`,
      stars: 30,
      apply(state) {
        state.energy = ENERGY_MAX;
        state.lastEnergyAt = Date.now();
      }
    },
    energy_pack: {
      title: "Energy Sip",
      text: "+6 energy for one more merge run.",
      stars: 20,
      apply(state) {
        state.energy = Math.min(ENERGY_MAX, state.energy + 6);
        state.lastEnergyAt = Date.now();
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
      text: "+3 energy from your gem stash.",
      gems: 75,
      apply(st) {
        st.energy = Math.min(ENERGY_MAX, st.energy + 3);
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
            st.gems += merged.level >= 4 ? 6 : 2;
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
    energy: 10,
    gems: 45,
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
    lastEnergyAt: Date.now(),
    passXp: 0,
    passClaimed: [],
    questDate: "",
    quests: {},
    ghostWins: 0,
    lastGhostAt: 0,
    lastRankId: "recruit"
  });

  // Rütbə ladder — slower climb; titles feel earned (no prestige/reset)
  const RANK_TIERS = [
    { id: "recruit", name: "Recruit", emoji: "🎖", min: 0 },
    { id: "scout", name: "Scout", emoji: "🧭", min: 120 },
    { id: "fighter", name: "Fighter", emoji: "⚔", min: 350 },
    { id: "veteran", name: "Veteran", emoji: "🛡", min: 800 },
    { id: "elite", name: "Elite", emoji: "✦", min: 1600 },
    { id: "champion", name: "Champion", emoji: "🏛", min: 2800 },
    { id: "warlord", name: "Warlord", emoji: "🔥", min: 4500 },
    { id: "legend", name: "Legend", emoji: "👑", min: 7500 },
    { id: "mythic", name: "Mythic", emoji: "🌈", min: 12000 },
    { id: "panda", name: "Panda Lord", emoji: "🐼", min: 18000 }
  ];

  const DAILY_EVENTS = [
    { id: "power", title: "Power Hour", text: "+12% squad power all day.", power: 0.12 },
    { id: "fuse", title: "Double Fuse", text: "Merges grant +1 bonus XP on Glory Pass.", fuseXp: 1 },
    { id: "gems", title: "Gem Rain", text: "+15% gems from wins today.", gemMult: 1.15 },
    { id: "boss", title: "Boss Rush", text: "Boss fights drop +12 extra gems.", bossGems: 12 },
    { id: "energy", title: "Spark Day", text: "Get Hero refunds 1 energy every 4th summon.", summonRefund: 4 }
  ];

  const QUEST_DEFS = [
    { id: "summon3", label: "Summon 3 heroes", target: 3, key: "summons", reward: { gems: 12 } },
    { id: "merge5", label: "Fuse 5 times", target: 5, key: "merges", reward: { gems: 18 } },
    { id: "win2", label: "Win 2 fights", target: 2, key: "wins", reward: { gems: 22, energy: 1 } },
    { id: "ghost1", label: "Beat 1 Ghost Rival", target: 1, key: "ghosts", reward: { gems: 15 } }
  ];

  const PASS_TRACK = [
    { xp: 0, label: "Kickoff", reward: { text: "Ready" } },
    { xp: 40, label: "Tier 1", reward: { gems: 20 } },
    { xp: 90, label: "Tier 2", reward: { energy: 1 } },
    { xp: 150, label: "Tier 3", reward: { gems: 35 } },
    { xp: 230, label: "Tier 4", reward: { gems: 50 } },
    { xp: 330, label: "Tier 5", reward: { energy: 2 } },
    { xp: 450, label: "Tier 6", reward: { gems: 80 } },
    { xp: 600, label: "Panda Cap", reward: { gems: 140 } }
  ];

  const ROLE_ABILITY = {
    Striker: { id: "crit", label: "Crit", mult: 0.04 },
    Duelist: { id: "crit", label: "Crit", mult: 0.05 },
    Burner: { id: "burn", label: "Burn", mult: 0.05 },
    Freezer: { id: "chill", label: "Chill", mult: 0.04 },
    Beast: { id: "rage", label: "Rage", mult: 0.05 },
    Archer: { id: "pierce", label: "Pierce", mult: 0.04 },
    Alchemist: { id: "brew", label: "Brew", mult: 0.03 },
    Tanklet: { id: "guard", label: "Guard", mult: 0.04 },
    Guardian: { id: "guard", label: "Guard", mult: 0.06 },
    Burst: { id: "crit", label: "Crit", mult: 0.05 },
    Wave: { id: "push", label: "Push", mult: 0.04 },
    Breaker: { id: "crush", label: "Crush", mult: 0.05 },
    Trickster: { id: "dodge", label: "Dodge", mult: 0.03 },
    Haunt: { id: "drain", label: "Drain", mult: 0.05 },
    Assassin: { id: "crit", label: "Crit", mult: 0.07 },
    Storm: { id: "shock", label: "Shock", mult: 0.05 },
    Colossus: { id: "crush", label: "Crush", mult: 0.06 },
    Healer: { id: "mend", label: "Mend", mult: 0.04 },
    Myth: { id: "aura", label: "Aura", mult: 0.06 },
    Void: { id: "void", label: "Void", mult: 0.07 },
    King: { id: "royal", label: "Royal", mult: 0.08 },
    Mascot: { id: "cheer", label: "Cheer", mult: 0.07 }
  };

  const SYNERGIES = [
    { roles: ["Burner", "Freezer"], bonus: 0.12, label: "Fire & Ice" },
    { roles: ["Guardian", "Tanklet"], bonus: 0.1, label: "Iron Wall" },
    { roles: ["Assassin", "Haunt"], bonus: 0.14, label: "Shadow Pair" },
    { roles: ["Storm", "Burst"], bonus: 0.12, label: "Sky Burst" },
    { roles: ["Beast", "Duelist"], bonus: 0.1, label: "Blood Duel" },
    { roles: ["King", "Mascot"], bonus: 0.18, label: "Royal Panda" },
    { roles: ["Healer", "Guardian"], bonus: 0.11, label: "Sanctuary" },
    { roles: ["Wave", "Storm"], bonus: 0.12, label: "Tempest Tide" },
    { roles: ["Myth", "Void"], bonus: 0.16, label: "Cosmic Gate" },
    { roles: ["Colossus", "Breaker"], bonus: 0.13, label: "Siege Crush" }
  ];

  const ARENA_THEMES = [
    { id: "ember", name: "Ember Wastes", emoji: "🔥", boss: "Magma Titan", accent: "#ff6b4a" },
    { id: "frost", name: "Frost Spire", emoji: "❄️", boss: "Glacier Queen", accent: "#7ec8ff" },
    { id: "neon", name: "Neon Circuit", emoji: "💠", boss: "Pulse Overlord", accent: "#3dffc8" },
    { id: "void", name: "Void Garden", emoji: "🌑", boss: "Eclipse Warden", accent: "#c9b8ff" },
    { id: "storm", name: "Storm Crown", emoji: "🌪", boss: "Tempest King", accent: "#ffd166" }
  ];

  const SEASON_MILESTONES = [
    { wave: 3, label: "Warm-up", reward: "+20 💎" },
    { wave: 5, label: "First Boss", reward: "Boss chest" },
    { wave: 10, label: "Hard Gate 10", reward: "Gate chest" },
    { wave: 15, label: "Storm Gate", reward: "Boss chest" },
    { wave: 20, label: "Hard Gate 20", reward: "Gate chest" },
    { wave: 25, label: "Void Trial", reward: "Boss chest" },
    { wave: 30, label: "Hard Gate 30", reward: "Gate chest" },
    { wave: 40, label: "Hard Gate 40", reward: "Gate chest" },
    { wave: 50, label: "Hard Gate 50", reward: "Panda title" }
  ];

  const PANDA_BEATS = {
    bossWin: [
      "Boss down! That roar shook the whole arena.",
      "You cooked the boss — I’m doing cartwheels!",
      "Boss chest unlocked. Flex that trophy climb."
    ],
    themeShift: [
      "New biome unlocked. Smell that fresh chaos?",
      "Theme swap! New colors, same panda hype.",
      "World changed — keep fusing through it."
    ],
    season: [
      "Season path glowing. Keep climbing.",
      "Milestone hit! Glory Track loves you.",
      "Path reward incoming — don’t stop now."
    ]
  };

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
    rankChip: $("rankChip"),
    rankEmoji: $("rankEmoji"),
    rankValue: $("rankValue"),
    rankBadge: $("rankBadge"),
    rankTitle: $("rankTitle"),
    rankProgress: $("rankProgress"),
    rankFill: $("rankFill"),
    rankLadder: $("rankLadder"),
    eventCard: $("eventCard"),
    eventTitle: $("eventTitle"),
    eventText: $("eventText"),
    eventTag: $("eventTag"),
    streakLadder: $("streakLadder"),
    questList: $("questList"),
    passXpLabel: $("passXpLabel"),
    passTrack: $("passTrack"),
    gloryGhost: $("gloryGhost"),
    gloryRank: $("gloryRank"),
    ghostFight: $("ghostFight"),
    ghostTip: $("ghostTip"),
    cloudChip: $("cloudChip"),
    cloudValue: $("cloudValue"),
    energyChip: $("energyChip"),
    waveTitle: $("waveTitle"),
    waveLabel: document.querySelector(".wave-bar__label"),
    themeChip: $("themeChip"),
    powerValue: $("powerValue"),
    board: $("board"),
    boardWrap: document.querySelector(".board-wrap"),
    boardHint: $("boardHint"),
    mergeFx: $("mergeFx"),
    seasonPath: $("seasonPath"),
    storyModal: $("storyModal"),
    storyTitle: $("storyTitle"),
    storyText: $("storyText"),
    storyClose: $("storyClose"),
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

  function normalizeState(raw) {
    const base = defaultState();
    const parsed = raw && typeof raw === "object" ? raw : {};
    const next = {
      ...base,
      ...parsed,
      board: Array.isArray(parsed.board) && parsed.board.length === SIZE
        ? parsed.board
        : base.board,
      discovered: Array.isArray(parsed.discovered) ? parsed.discovered : base.discovered
    };
    next.energy = Math.max(0, Math.min(ENERGY_MAX, Math.floor(Number(next.energy) || 0)));
    // Climb-gate vault without touching the live `state` binding (safe during first load).
    next.discovered = pruneDiscoveredList(next.discovered, next.board, next.bestWave, next.wave);
    return next;
  }

  function progressScore(s) {
    if (!s || typeof s !== "object") return -1;
    const units = Array.isArray(s.board) ? s.board.filter(Boolean).length : 0;
    return (
      Number(s.bestWave || 1) * 10000 +
      Number(s.wave || 1) * 1000 +
      Number(s.trophies || 0) * 5 +
      Number(s.wins || 0) * 25 +
      Number(s.merges || 0) * 2 +
      Number(s.passXp || 0) * 0.5 +
      Number(s.ghostWins || 0) * 8 +
      units * 15 +
      Number(s.gems || 0) * 0.01 +
      Number(s.highestPower || 0) * 0.1
    );
  }

  function mergeProgressStates(a, b) {
    // Field-wise keep the best climb so a stale/empty cloud (or day reload)
    // cannot wipe rank, trophies, vault, or board progress.
    const left = normalizeState(a);
    const right = normalizeState(b);
    const primary = progressScore(left) >= progressScore(right) ? left : right;
    const secondary = primary === left ? right : left;
    const merged = { ...primary };
    ["bestWave", "wave", "trophies", "wins", "merges", "highestPower", "passXp", "ghostWins", "gems", "referralCount"].forEach((key) => {
      merged[key] = Math.max(Number(primary[key] || 0), Number(secondary[key] || 0));
    });
    merged.energy = Math.max(Number(primary.energy || 0), Number(secondary.energy || 0));
    merged.energy = Math.min(ENERGY_MAX, merged.energy);
    merged.dailyStreak = Math.max(Number(primary.dailyStreak || 0), Number(secondary.dailyStreak || 0));
    // Keep the newer daily claim / quest day when dates differ
    if (String(secondary.dailyClaimDate || "") > String(primary.dailyClaimDate || "")) {
      merged.dailyClaimDate = secondary.dailyClaimDate;
    }
    if (String(secondary.questDate || "") > String(primary.questDate || "")) {
      merged.questDate = secondary.questDate;
      merged.quests = secondary.quests && typeof secondary.quests === "object" ? secondary.quests : merged.quests;
    }
    const disc = new Set([...(primary.discovered || []), ...(secondary.discovered || [])]);
    merged.discovered = UNIT_DEFS.map((d) => d.id).filter((id) => disc.has(id));
    const passClaimed = new Set([...(primary.passClaimed || []), ...(secondary.passClaimed || [])]);
    merged.passClaimed = [...passClaimed].map((n) => Math.floor(Number(n) || 0)).filter((n) => n > 0);
    // Prefer the board with more real units / power
    const boardScore = (board) => (Array.isArray(board) ? board : []).reduce((sum, u) => sum + (u ? powerOf(u) : 0), 0);
    if (boardScore(secondary.board) > boardScore(primary.board)) merged.board = secondary.board;
    const rankP = rankForTrophies(Number(merged.trophies || 0));
    const rankIdx = (id) => Math.max(0, RANK_TIERS.findIndex((t) => t.id === id));
    const bestRankId = [left.lastRankId, right.lastRankId, rankP.id].sort((a, b) => rankIdx(b) - rankIdx(a))[0];
    merged.lastRankId = bestRankId || rankP.id;
    // Keep referral flags if either side earned them
    merged.referralClaimed = Boolean(primary.referralClaimed || secondary.referralClaimed);
    if (!merged.referredBy && secondary.referredBy) merged.referredBy = secondary.referredBy;
    return normalizeState(merged);
  }

  function pickRicherState(a, b) {
    return mergeProgressStates(a, b);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return normalizeState(JSON.parse(raw));
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("MERGE_ARENA_LOCAL_SAVE_FAIL", error);
    }
    queueCloudSave();
  }

  function flushSaveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    if (!cloudReady || !sessionToken) return;
    clearTimeout(saveTimer);
    pushCloudState().catch(() => {});
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
    const localSnapshot = normalizeState(state);
    const { ok, result } = await api("/api/merge-arena/state");
    if (!ok) return false;
    if (!result?.state) {
      // No cloud row yet — keep local progress and upload it after connect.
      state = localSnapshot;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    }
    // Hydrate blob from SQL meta columns (survives if JSON state was thin/stale).
    const cloudRaw = { ...result.state };
    const meta = result.meta || {};
    if (meta.trophies != null) cloudRaw.trophies = Math.max(Number(cloudRaw.trophies || 0), Number(meta.trophies || 0));
    if (meta.bestWave != null) cloudRaw.bestWave = Math.max(Number(cloudRaw.bestWave || 1), Number(meta.bestWave || 1));
    if (meta.wins != null) cloudRaw.wins = Math.max(Number(cloudRaw.wins || 0), Number(meta.wins || 0));
    if (meta.merges != null) cloudRaw.merges = Math.max(Number(cloudRaw.merges || 0), Number(meta.merges || 0));
    // Field-wise merge — never let a day reload / empty cloud wipe rank climb.
    state = pickRicherState(localSnapshot, cloudRaw);
    pruneDiscovered();
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
    let p = def.basePower * Math.pow(1.65, lvl - 1);
    const ability = ROLE_ABILITY[def.role];
    if (ability) p *= 1 + ability.mult * Math.min(3, lvl);
    return Math.round(p);
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

  function abilityBonus() {
    let bonus = 0;
    const seen = {};
    state.board.forEach((u) => {
      if (!u) return;
      const def = defById(u.id);
      const ability = ROLE_ABILITY[def.role];
      if (!ability || seen[ability.id]) return;
      seen[ability.id] = true;
      bonus += ability.mult * 0.5;
    });
    return bonus;
  }

  function todayEvent() {
    const day = Math.floor(Date.now() / 86400000);
    return DAILY_EVENTS[day % DAILY_EVENTS.length];
  }

  function squadPower() {
    const raw = state.board.reduce((sum, u) => sum + powerOf(u), 0);
    let mult = 1 + synergyBonus() + abilityBonus();
    if (state.surgeBattles > 0) mult += 0.3;
    if (state.charmBattles > 0) mult += 0.4;
    const ev = todayEvent();
    if (ev.power) mult += ev.power;
    return Math.round(raw * mult);
  }

  function rankForTrophies(trophies) {
    let current = RANK_TIERS[0];
    for (const tier of RANK_TIERS) {
      if (trophies >= tier.min) current = tier;
    }
    return current;
  }

  function nextRank(tier) {
    const idx = RANK_TIERS.findIndex((t) => t.id === tier.id);
    return RANK_TIERS[idx + 1] || null;
  }

  function ensureQuests() {
    const today = todayKey();
    if (state.questDate === today && state.quests && typeof state.quests === "object") return;
    state.questDate = today;
    state.quests = {};
    QUEST_DEFS.forEach((q) => {
      state.quests[q.id] = { progress: 0, claimed: false };
    });
  }

  function bumpQuest(key, amount = 1) {
    ensureQuests();
    QUEST_DEFS.forEach((q) => {
      if (q.key !== key) return;
      const row = state.quests[q.id] || { progress: 0, claimed: false };
      row.progress = Math.min(q.target, Number(row.progress || 0) + amount);
      state.quests[q.id] = row;
    });
  }

  function claimQuest(id) {
    ensureQuests();
    const def = QUEST_DEFS.find((q) => q.id === id);
    const row = state.quests[id];
    if (!def || !row || row.claimed || row.progress < def.target) return;
    row.claimed = true;
    if (def.reward.gems) state.gems += def.reward.gems;
    if (def.reward.energy) {
      state.energy = Math.min(ENERGY_MAX, state.energy + def.reward.energy);
      state.lastEnergyAt = Date.now();
    }
    addPassXp(15);
    saveState();
    renderHud();
    renderGlory();
    playTone("claim");
    haptic("success");
    showToast(`Quest done · ${def.label}`);
  }

  function addPassXp(amount) {
    state.passXp = Math.max(0, Number(state.passXp || 0) + amount);
    if (!Array.isArray(state.passClaimed)) state.passClaimed = [];
    autoClaimPass();
  }

  function autoClaimPass() {
    if (!Array.isArray(state.passClaimed)) state.passClaimed = [];
    PASS_TRACK.forEach((tier, i) => {
      if (i === 0) return;
      if (state.passXp < tier.xp) return;
      if (state.passClaimed.includes(i)) return;
      state.passClaimed.push(i);
      if (Number(tier.reward?.gems) > 0) state.gems += Number(tier.reward.gems);
      if (Number(tier.reward?.energy) > 0) {
        state.energy = Math.min(ENERGY_MAX, state.energy + Number(tier.reward.energy));
        state.lastEnergyAt = Date.now();
      }
      showToast(`Glory Pass ${tier.label || "tier"} · loot unlocked`);
      playTone("claim");
    });
  }

  function checkRankUp() {
    const tier = rankForTrophies(state.trophies);
    if (state.lastRankId && state.lastRankId !== tier.id) {
      const prevIdx = RANK_TIERS.findIndex((t) => t.id === state.lastRankId);
      const nextIdx = RANK_TIERS.findIndex((t) => t.id === tier.id);
      if (nextIdx > prevIdx) {
        // Rarer ranks → slightly better gem toast, still lean overall
        state.gems += 28 + nextIdx * 12;
        showToast(`${tier.emoji} Rank up · ${tier.name}!`);
        playTone("rank");
        haptic("success");
        cheerBuddy("win");
      }
    }
    state.lastRankId = tier.id;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function yesterdayKey() {
    return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  }

  function dailyRewardForStreak(streak) {
    const s = Math.max(1, streak);
    // Lean daily gems — Crystal Sip should still feel costly
    const ladder = s >= 7 ? 1.25 : 1;
    return {
      gems: Math.round((14 + s * 8) * ladder),
      energy: Math.min(3, 1 + Math.floor((s - 1) / 3) + (s >= 7 ? 1 : 0))
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
        click: [300, 340],
        gate: [160, 240, 320],
        ghost: [280, 420, 560],
        rank: [480, 640, 800]
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
    state.gems += 18;
    state.energy = Math.min(ENERGY_MAX, Number(state.energy || 0) + 3);
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
    showToast("Welcome gift: +18 💎 · +3 ⚡");
  }

  function collectPendingInviteBonus() {
    if (!playerId) return;
    try {
      const key = `merge_arena_ref_bonus_${playerId}`;
      const n = Number(localStorage.getItem(key) || 0);
      if (n <= 0) return;
      localStorage.removeItem(key);
      state.referralCount = Number(state.referralCount || 0) + n;
      state.gems += n * 25;
      state.energy = Math.min(ENERGY_MAX, Number(state.energy || 0) + Math.min(4, n * 2));
      state.lastEnergyAt = Date.now();
      saveState();
      showToast(`Invite bonus · ${n} friend${n > 1 ? "s" : ""} · +${n * 25} 💎 · +${Math.min(4, n * 2)} ⚡`);
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
    if (now - Number(state.adLastClaimAt || 0) < AD_ENERGY_COOLDOWN_MS) {
      const left = Math.ceil((AD_ENERGY_COOLDOWN_MS - (now - Number(state.adLastClaimAt || 0))) / 60000);
      showToast(`Ad cooldown — wait ~${Math.max(1, left)} min.`);
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
      watched = window.confirm(`Demo ad complete?\n\nOK = grant +${AD_ENERGY_GAIN} energy`);
      if (!watched) return;
    }
    state.adLastClaimAt = now;
    state.energy = Math.min(ENERGY_MAX, state.energy + AD_ENERGY_GAIN);
    state.lastEnergyAt = now;
    saveState();
    renderHud();
    playTone("claim");
    haptic("success");
    showToast(`+${AD_ENERGY_GAIN} energy from Watch & Charge`);
  }

  function isBossWave(wave) {
    return wave > 0 && wave % 5 === 0;
  }

  function isHardGate(wave) {
    // Every 10 arenas: brutal checkpoint (10, 20, 30…)
    return wave > 0 && wave % 10 === 0;
  }

  function enemyPower(wave) {
    const w = Math.max(1, Number(wave) || 1);
    // Mid curve: early arenas beatable with light merges; late still needs fuses.
    let power = 22 + w * 14 + Math.pow(w, 1.28) * 3.1;
    power *= 1 + Math.floor((w - 1) / 5) * 0.035;
    if (isBossWave(w)) power *= 1.22;
    if (isHardGate(w)) power *= 1.38;
    return Math.round(power);
  }

  function foeHeroForWave(wave, seed = 0) {
    // Visual foes come from climb-appropriate heroes (not locked legends).
    const floor = Math.max(1, Number(wave) || 1);
    const pool = UNIT_DEFS.filter((d) => unlockWaveOf(d) <= floor + 2);
    const list = pool.length ? pool : UNIT_DEFS.filter((d) => d.rarity === "common");
    const idx = Math.abs(Math.floor(floor * 3 + seed)) % list.length;
    return list[idx];
  }

  function foeLabelForWave(wave) {
    const w = Math.max(1, Number(wave) || 1);
    if (isHardGate(w)) return `Hard Gate ${w}`;
    if (isBossWave(w)) {
      const boss = foeHeroForWave(w, 7);
      return `${boss.name} Boss`;
    }
    const foe = foeHeroForWave(w, 1);
    return foe.name;
  }

  function themeForWave(wave) {
    const idx = Math.floor(Math.max(0, wave - 1) / 5) % ARENA_THEMES.length;
    return ARENA_THEMES[idx];
  }

  function applyArenaTheme() {
    const theme = themeForWave(state.wave);
    const boss = isBossWave(state.wave);
    const hard = isHardGate(state.wave);
    document.body.dataset.theme = theme.id;
    document.body.dataset.boss = boss ? "1" : "0";
    document.body.dataset.hard = hard ? "1" : "0";
    document.body.classList.toggle("is-night", theme.id === "void" || boss || hard);
    if (els.themeChip) {
      els.themeChip.textContent = hard
        ? `${theme.emoji} HARD GATE · A${state.wave}`
        : boss
          ? `${theme.emoji} BOSS · ${theme.boss}`
          : `${theme.emoji} ${theme.name}`;
    }
    if (els.waveLabel) {
      els.waveLabel.textContent = hard ? "Hard Gate" : boss ? "Boss Arena" : "Arena";
    }
    if (els.boardWrap) {
      els.boardWrap.dataset.theme = theme.id;
      els.boardWrap.classList.toggle("is-boss", boss);
      els.boardWrap.classList.toggle("is-hard", hard);
    }
    return theme;
  }

  function showMergeFx(name, level) {
    if (!els.mergeFx) return;
    els.mergeFx.hidden = false;
    els.mergeFx.innerHTML = `
      <div class="merge-fx__burst"></div>
      <strong>FUSION</strong>
      <span>${name} → L${level}</span>
    `;
    els.mergeFx.classList.remove("is-on");
    void els.mergeFx.offsetWidth;
    els.mergeFx.classList.add("is-on");
    clearTimeout(showMergeFx._t);
    showMergeFx._t = setTimeout(() => {
      els.mergeFx.classList.remove("is-on");
      els.mergeFx.hidden = true;
    }, 900);
  }

  function showPandaStory(kind, extra) {
    const lines = PANDA_BEATS[kind] || PANDA_BEATS.themeShift;
    const line = lines[Math.floor(Math.random() * lines.length)];
    if (els.storyModal && els.storyTitle && els.storyText) {
      els.storyTitle.textContent = kind === "bossWin" ? "Panda Boss Beat" : "Panda Story";
      els.storyText.textContent = extra ? `${line} ${extra}` : line;
      els.storyModal.hidden = false;
    } else {
      showToast(line);
    }
    cheerBuddy(kind === "bossWin" ? "win" : "idle");
  }

  function renderSeasonPath() {
    if (!els.seasonPath) return;
    const best = Number(state.bestWave || 1);
    const nextIdx = SEASON_MILESTONES.findIndex((m) => best < m.wave);
    els.seasonPath.innerHTML = SEASON_MILESTONES.map((m, i) => {
      const done = best >= m.wave;
      const current = i === nextIdx;
      return `
        <div class="season-node ${done ? "is-done" : ""} ${current ? "is-next" : ""}">
          <strong>A${m.wave}</strong>
          <span>${m.label}</span>
          <em>${done ? "Claimed vibe" : m.reward}</em>
        </div>
      `;
    }).join("");
  }

  function emptySlots() {
    const slots = [];
    state.board.forEach((u, i) => {
      if (!u) slots.push(i);
    });
    return slots;
  }

  function unlockWaveOf(def) {
    return Math.max(1, Number(def && def.unlockWave) || 1);
  }

  function climbFloor(wave, bestWave) {
    return Math.max(1, Number(bestWave || wave || 1));
  }

  function isHeroUnlocked(id, wave = state.bestWave || state.wave || 1) {
    const def = defById(id);
    return unlockWaveOf(def) <= Math.max(1, Number(wave) || 1);
  }

  function pruneDiscoveredList(discovered, board, bestWave, wave) {
    // Keep starters + climb-eligible discoveries + anything already on the board.
    // Old saves that unlocked the whole vault get pruned to what the climb earned.
    const floor = climbFloor(wave, bestWave);
    const keep = new Set(["spark", "blade"]);
    (Array.isArray(discovered) ? discovered : []).forEach((id) => {
      const def = defById(id);
      if (def && unlockWaveOf(def) <= floor) keep.add(String(id));
    });
    (Array.isArray(board) ? board : []).forEach((u) => {
      if (u && u.id) keep.add(String(u.id));
    });
    return UNIT_DEFS.map((d) => d.id).filter((id) => keep.has(id));
  }

  function pruneDiscovered() {
    state.discovered = pruneDiscoveredList(
      state.discovered,
      state.board,
      state.bestWave,
      state.wave
    );
  }

  function availablePool(rarity) {
    const floor = climbFloor(state.wave, state.bestWave);
    let pool = UNIT_DEFS.filter((u) => isHeroUnlocked(u.id, floor));
    if (rarity) pool = pool.filter((u) => u.rarity === rarity);
    if (!pool.length) {
      pool = UNIT_DEFS.filter((u) => u.rarity === "common" && unlockWaveOf(u) <= 1);
    }
    return pool;
  }

  function randomCommonId() {
    const commons = availablePool("common");
    return commons[Math.floor(Math.random() * commons.length)].id;
  }

  function randomSummonId() {
    // Only from climb-unlocked heroes. Higher rarities stay rare and gated.
    const floor = climbFloor(state.wave, state.bestWave);
    const roll = Math.random();
    if (roll < 0.86) return randomCommonId();
    if (roll < 0.97) {
      const rares = availablePool("rare");
      if (rares.length) return rares[Math.floor(Math.random() * rares.length)].id;
      return randomCommonId();
    }
    if (floor >= 25 && roll >= 0.995) {
      const legends = availablePool("legendary");
      if (legends.length) return legends[Math.floor(Math.random() * legends.length)].id;
    }
    const epics = availablePool("epic");
    if (epics.length && floor >= 15) {
      return epics[Math.floor(Math.random() * epics.length)].id;
    }
    const rares = availablePool("rare");
    if (rares.length) return rares[Math.floor(Math.random() * rares.length)].id;
    return randomCommonId();
  }

  function unitForRarity(rarity, { gated = true } = {}) {
    const pool = gated
      ? availablePool(rarity)
      : UNIT_DEFS.filter((u) => u.rarity === rarity);
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
    // Only mark vault unlock when the hero is earned for current climb.
    if (!isHeroUnlocked(id)) return false;
    if (!state.discovered.includes(id)) {
      state.discovered.push(id);
      return true;
    }
    return false;
  }

  function grantClimbUnlocks() {
    // Clearing arenas opens new Get Hero pools — still must drop/summon to collect.
    const floor = climbFloor(state.wave, state.bestWave);
    const newly = UNIT_DEFS.filter(
      (d) => unlockWaveOf(d) === floor && !state.discovered.includes(d.id)
    );
    if (newly.length) {
      const names = newly.slice(0, 2).map((d) => d.name).join(", ");
      showToast(`New hero pool · Arena ${floor}+ : ${names}${newly.length > 2 ? "…" : ""}`);
    }
  }

  function placeGuaranteed(st, rarity) {
    const slots = [];
    st.board.forEach((u, i) => {
      if (!u) slots.push(i);
    });
    if (!slots.length) return "Board is full. Merge first.";
    // Star Market can pull the full rarity band (paid unlock path).
    const def = unitForRarity(rarity, { gated: false });
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
    const gained = Math.floor(elapsed / ENERGY_REGEN_MS);
    if (gained > 0 && state.energy < ENERGY_MAX) {
      state.energy = Math.min(ENERGY_MAX, state.energy + gained);
      state.lastEnergyAt = lastEnergyAt + gained * ENERGY_REGEN_MS;
      saveState();
    }
  }

  let fitTimer = null;
  let lastFitKey = "";

  function scheduleFit(force = false) {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => fitBoard(force), 80);
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
    scheduleFit();
  }

  function fitBoard(force = false) {
    const wrap = els.board && els.board.parentElement;
    if (!wrap || !els.board) return;
    // Only size the play board when play view is visible
    const play = document.getElementById("view-play");
    if (play && play.hidden) return;
    const app = document.getElementById("app");
    const dock = document.querySelector(".dock");
    const actions = document.querySelector(".play-actions");
    const hud = document.querySelector(".hud");
    const hudSub = document.querySelector(".hud-sub");
    const wave = document.querySelector(".wave-bar");
    const hint = document.getElementById("boardHint");
    const strip = document.getElementById("unitStrip");
    const buddy = document.getElementById("arenaBuddy");
    const clash = document.getElementById("clashPanel");
    const appH = app ? app.clientHeight : window.innerHeight;
    const reserved =
      (dock ? Math.max(dock.offsetHeight, 52) : 52) +
      (actions ? Math.max(actions.offsetHeight, 56) : 56) +
      (hud ? hud.offsetHeight : 30) +
      (hudSub ? hudSub.offsetHeight : 0) +
      (wave ? wave.offsetHeight : 36) +
      (hint ? Math.max(hint.offsetHeight, 18) : 18) +
      (strip ? Math.max(strip.offsetHeight || 48, 48) : 48) +
      (buddy ? Math.max(buddy.offsetHeight || 54, 54) : 54) +
      (clash ? Math.max(clash.offsetHeight || 72, 72) : 72) +
      28;
    const appW = app ? app.clientWidth : window.innerWidth;
    const styles = window.getComputedStyle(wrap);
    const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const availW = Math.max(160, Math.min(appW - 28, (wrap.parentElement ? wrap.parentElement.clientWidth : appW) - 8) - padX);
    const fromViewport = Math.max(140, appH - reserved);
    if (availW < 40) return;
    const maxBoard = Math.floor(appH * 0.3);
    const size = Math.floor(Math.min(availW, fromViewport, maxBoard));
    const key = `${size}x${padX}`;
    if (!force && key === lastFitKey) return;
    lastFitKey = key;
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
    // Switch tabs first so UI feels instant even if a render is heavy
    document.querySelectorAll(".view").forEach((view) => {
      const active = view.dataset.view === name;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
    });
    document.querySelectorAll(".dock__item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.nav === name);
    });
    requestAnimationFrame(() => {
      if (name === "roster") renderRoster();
      if (name === "ranks") renderRankPage();
      if (name === "rank") {
        renderGlory();
        loadLeaderboard();
      }
      if (name === "play") scheduleFit(true);
    });
  }

  function renderHud() {
    regenEnergy();
    els.energyValue.textContent = String(state.energy);
    if (els.energyChip) {
      const mins = (ENERGY_REGEN_MS / 60000).toFixed(1).replace(/\.0$/, "");
      els.energyChip.title = `Energy ${state.energy}/${ENERGY_MAX} · +1⚡ / ${mins}m · tap to buy`;
    }
    els.gemValue.textContent = String(state.gems);
    if (els.gemChip) {
      els.gemChip.title = state.charmBattles > 0
        ? `Gems ${state.gems} · Power Charm ready`
        : `Gems ${state.gems} · Tap to open Gem Vault`;
    }
    els.trophyValue.textContent = String(state.trophies);
    renderRankCard();
    const theme = applyArenaTheme();
    const boss = isBossWave(state.wave);
    const hard = isHardGate(state.wave);
    els.waveTitle.textContent = hard
      ? `Hard Gate ${state.wave}`
      : boss
        ? `Arena ${state.wave} · ${theme.boss}`
        : `Arena ${state.wave}`;
    const power = squadPower();
    els.powerValue.textContent = String(power);
    state.highestPower = Math.max(state.highestPower, power);
    els.summonButton.disabled = state.energy < 1 || emptySlots().length === 0;
    els.battleButton.disabled = battleBusy || state.energy < 1 || power <= 0;
    if (els.battleButton) {
      const small = els.battleButton.querySelector("small");
      if (small && !battleBusy) {
        small.textContent = hard ? "HARD · 1 energy" : boss ? "BOSS · 1 energy" : "1 energy";
      }
    }
  }

  function cheerBuddy(kind) {
    if (!els.buddyLine || !els.arenaBuddy) return;
    const power = squadPower();
    let pick = BUDDY_LINES[0];
    if (kind === "summon") pick = BUDDY_LINES[1];
    else if (kind === "merge") pick = { title: "Arena Panda", line: "Fusion pop! That one felt 3D." };
    else if (kind === "fight") {
      pick = isHardGate(state.wave)
        ? { title: "Arena Panda", line: `Hard Gate ${state.wave}! Fuse hard — this one bites.` }
        : isBossWave(state.wave)
          ? { title: "Arena Panda", line: `Boss time! ${themeForWave(state.wave).boss} awaits.` }
          : { title: "Arena Panda", line: "Go go! Smash Arena " + state.wave + "!" };
    }
    else if (kind === "win") {
      pick = isHardGate(Math.max(1, state.wave - 1))
        ? { title: "Arena Panda", line: "Hard Gate cleared! That was a real climb." }
        : isBossWave(Math.max(1, state.wave - 1))
          ? { title: "Arena Panda", line: "Boss crushed! Season path lights up." }
          : { title: "Arena Panda", line: "Victory dance! You cleared it." };
    }
    else if (kind === "lose") {
      pick = isHardGate(state.wave)
        ? { title: "Arena Panda", line: "Gate too tall — merge higher before retry." }
        : { title: "Arena Panda", line: "Shake it off — fuse stronger and retry." };
    }
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
    applyArenaTheme();
    scheduleFit();
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
    } else if (isHardGate(state.wave)) {
      status = you >= enemy ? "Gate ready" : "Hard Gate";
      tip = you >= enemy
        ? `Arena ${state.wave} Hard Gate is crackable — Enter Fight!`
        : `Hard Gate needs ~${enemy} power (you: ${you}). Fuse a bit more.`;
      tone = you >= enemy ? "ready" : "warn";
    } else if (isBossWave(state.wave)) {
      const foeName = foeLabelForWave(state.wave);
      status = you >= enemy ? "Boss ready" : "Boss ahead";
      tip = you >= enemy
        ? `${foeName} is vulnerable — Enter Fight!`
        : `Boss arena vs ${foeName}. Need ~${enemy} (you: ${you}).`;
      tone = you >= enemy ? "ready" : "warn";
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
    const poolOpen = UNIT_DEFS.filter((d) => isHeroUnlocked(d.id)).length;
    const headP = document.querySelector("#view-roster .section-head p");
    if (headP) {
      headP.textContent = `${unlockedCount}/${UNIT_DEFS.length} collected · ${poolOpen} in Get Hero pool · Win fights to open more`;
    }
    const order = ["common", "rare", "epic", "legendary"];
    const sorted = [...UNIT_DEFS].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
    els.rosterGrid.innerHTML = sorted.map((def) => {
      const unlocked = state.discovered.includes(def.id);
      const poolReady = isHeroUnlocked(def.id);
      const lockHint = poolReady
        ? "Win drops / Get Hero to collect"
        : `Reach Arena ${unlockWaveOf(def)}`;
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
          <p>${unlocked
            ? `${def.blurb || `${def.rarity} fighter`}${ROLE_ABILITY[def.role] ? ` · ${ROLE_ABILITY[def.role].label}` : ""}`
            : lockHint} · ${def.basePower}⚡</p>
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
    if (els.gloryGhost) els.gloryGhost.textContent = String(state.ghostWins || 0);
    const tier = rankForTrophies(state.trophies);
    if (els.gloryRank) els.gloryRank.textContent = tier.name;
    renderRankCard();
    renderDaily();
    renderQuests();
    renderPass();
    renderSynergyCard();
    renderInvite();
    renderSeasonPath();
    renderGhostCard();
  }

  function renderRankPage() {
    renderRankCard();
    renderEventCard();
    renderRankLadder();
  }

  function renderRankLadder() {
    if (!els.rankLadder) return;
    const current = rankForTrophies(state.trophies);
    els.rankLadder.innerHTML = RANK_TIERS.map((tier) => {
      const unlocked = state.trophies >= tier.min;
      const isCurrent = tier.id === current.id;
      return `
        <div class="rank-ladder__row ${unlocked ? "is-on" : ""} ${isCurrent ? "is-current" : ""}">
          <span class="rank-ladder__emoji">${tier.emoji}</span>
          <div>
            <strong>${tier.name}</strong>
            <em>${tier.min} 🏆</em>
          </div>
          <span class="rank-ladder__state">${isCurrent ? "NOW" : unlocked ? "OPEN" : "LOCKED"}</span>
        </div>
      `;
    }).join("");
  }

  function renderRankCard() {
    const tier = rankForTrophies(state.trophies);
    const nxt = nextRank(tier);
    if (els.rankEmoji) els.rankEmoji.textContent = tier.emoji;
    if (els.rankValue) els.rankValue.textContent = tier.name;
    if (els.rankChip) els.rankChip.title = `${tier.emoji} ${tier.name} · ${state.trophies} 🏆`;
    if (els.rankBadge) els.rankBadge.textContent = tier.emoji;
    if (els.rankTitle) els.rankTitle.textContent = tier.name;
    if (els.rankProgress) {
      els.rankProgress.textContent = nxt
        ? `${state.trophies} / ${nxt.min} 🏆 to ${nxt.name}`
        : `${state.trophies} 🏆 · Max rank`;
    }
    if (els.rankFill) {
      if (!nxt) {
        els.rankFill.style.width = "100%";
      } else {
        const span = Math.max(1, nxt.min - tier.min);
        const pct = Math.max(4, Math.min(100, Math.round(((state.trophies - tier.min) / span) * 100)));
        els.rankFill.style.width = `${pct}%`;
      }
    }
  }

  function renderEventCard() {
    const ev = todayEvent();
    if (els.eventTitle) els.eventTitle.textContent = ev.title;
    if (els.eventText) els.eventText.textContent = ev.text;
    if (els.eventTag) els.eventTag.textContent = "TODAY";
    if (els.eventCard) els.eventCard.dataset.event = ev.id;
  }

  function passRewardText(reward) {
    const r = reward && typeof reward === "object" ? reward : {};
    if (Number(r.gems) > 0) return `+${Number(r.gems)}💎`;
    if (Number(r.energy) > 0) return `+${Number(r.energy)}⚡`;
    if (r.text) return String(r.text);
    return "Ready";
  }

  function renderQuests() {
    if (!els.questList) return;
    ensureQuests();
    els.questList.innerHTML = QUEST_DEFS.map((q) => {
      const row = state.quests[q.id] || { progress: 0, claimed: false };
      const done = row.progress >= q.target;
      const claimed = Boolean(row.claimed);
      const status = claimed ? "Done" : done ? "Claim" : "Go";
      return `
        <div class="quest-row ${done ? "is-done" : ""} ${claimed ? "is-claimed" : ""}">
          <div>
            <strong>${q.label}</strong>
            <span>${Math.min(row.progress, q.target)}/${q.target}</span>
          </div>
          <button class="btn btn--ghost quest-claim" type="button" data-quest="${q.id}" ${!done || claimed ? "disabled" : ""}>
            ${status}
          </button>
        </div>
      `;
    }).join("");
  }

  function renderPass() {
    if (!els.passTrack) return;
    if (els.passXpLabel) els.passXpLabel.textContent = `${state.passXp || 0} XP`;
    const claimed = Array.isArray(state.passClaimed) ? state.passClaimed : [];
    els.passTrack.innerHTML = PASS_TRACK.map((tier, i) => {
      const unlocked = (state.passXp || 0) >= tier.xp;
      const got = i === 0 || claimed.includes(i);
      const label = tier.label || `Tier ${i}`;
      const reward = passRewardText(tier.reward);
      return `
        <div class="pass-node ${unlocked ? "is-on" : ""} ${got ? "is-got" : ""}">
          <strong>${label}</strong>
          <span>${Number(tier.xp) || 0} XP</span>
          <em>${reward}</em>
        </div>
      `;
    }).join("");
  }

  function renderGhostCard() {
    if (!els.ghostTip) return;
    const rival = Math.round(squadPower() * 0.82 + state.wave * 4);
    els.ghostTip.textContent = `Shadow rival ~${rival} power · free duel · wins: ${state.ghostWins || 0}`;
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
    if (els.streakLadder) {
      els.streakLadder.innerHTML = Array.from({ length: 7 }, (_, i) => {
        const day = i + 1;
        const lit = streak >= day;
        return `<span class="streak-pip ${lit ? "is-on" : ""}" title="Day ${day}">${day}</span>`;
      }).join("");
    }
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
    addPassXp(20);
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
      state.gems += merged.level >= 4 ? 8 : 3;
      discover(merged.id);
      bumpQuest("merges");
      const ev = todayEvent();
      addPassXp(8 + (ev.fuseXp || 0) * 8);
      saveState();
      renderBoard();
      cheerBuddy("merge");
      showMergeFx(defById(merged.id).name, merged.level);
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
      state._summonCount = Number(state._summonCount || 0) + 1;
      const ev = todayEvent();
      if (ev.summonRefund && state._summonCount % ev.summonRefund === 0) {
        state.energy = Math.min(ENERGY_MAX, state.energy + 1);
        showToast("Spark Day refund · +1 ⚡");
      }
    }

    const id = forceId || randomSummonId();
    const unit = makeUnit(id, forceLevel || 1);
    if (forceLevel) unit.rarity = rarityForLevel(forceLevel);
    // Keep natural rarity for spicy Get Hero drops
    if (!forceId && !forceLevel) unit.rarity = defById(id).rarity;
    const slot = slots[Math.floor(Math.random() * slots.length)];
    state.board[slot] = unit;
    discover(id);
    if (!forceId) {
      bumpQuest("summons");
      addPassXp(3);
    }
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
    const theme = themeForWave(wave);
    const boss = isBossWave(wave);
    const hard = isHardGate(wave);
    const enemy = enemyPower(wave);
    const foe = hard ? null : foeHeroForWave(wave, boss ? 7 : 1);
    const foeName = foeLabelForWave(wave);
    const syn = activeSynergies();
    els.battleModal.hidden = false;
    if (els.battleStage) {
      els.battleStage.classList.add("is-fighting");
      els.battleStage.dataset.theme = theme.id;
      els.battleStage.classList.toggle("is-boss", boss);
      els.battleStage.classList.toggle("is-hard", hard);
      els.battleStage.classList.toggle("is-night", theme.id === "void" || boss || hard);
    }
    els.fighterYou.textContent = `YOU ${power}`;
    els.fighterEnemy.textContent = hard
      ? `⛓ GATE ${enemy}`
      : `${(foe && (foe.face || foe.icon)) || theme.emoji} ${foeName} ${enemy}`;
    els.youBar.style.width = "100%";
    els.enemyBar.style.width = "100%";
    els.battleLog.textContent = hard
      ? `${theme.emoji} Hard Gate ${wave} — climb check…`
      : boss
        ? `${theme.emoji} Boss clash vs ${foeName}…`
        : syn.length
          ? `${syn[0].label} ignites the clash…`
          : `${theme.emoji} vs ${foeName}…`;
    if (els.battleFx) {
      els.battleFx.textContent = hard ? "⛓" : (foe && (foe.face || foe.icon)) || (boss ? "👹" : "💥");
    }

    await wait(500);
    els.battleLog.textContent = hard ? "Gate pressure!" : boss ? "Boss rage!" : "Heroes collide!";
    playTone("hit");
    await wait(400);

    const youRatio = power / (power + enemy);
    const steps = hard ? 12 : boss ? 11 : 9;
    for (let i = 1; i <= steps; i += 1) {
      const progress = i / steps;
      const youLeft = Math.max(0, 100 - progress * 100 * (1 - youRatio) * 1.25);
      const enemyLeft = Math.max(0, 100 - progress * 100 * youRatio * 1.25);
      els.youBar.style.width = `${youLeft}%`;
      els.enemyBar.style.width = `${enemyLeft}%`;
      if (els.battleStage) {
        els.battleStage.classList.toggle("is-shake", i % 2 === 0);
      }
      if (els.battleFx) {
        els.battleFx.textContent = hard
          ? (i % 2 === 0 ? "⛓" : "💥")
          : boss
            ? (i % 2 === 0 ? ((foe && (foe.face || foe.icon)) || "🔥") : "💥")
            : (i % 3 === 0 ? ((foe && (foe.face || foe.icon)) || "⚡") : i % 2 === 0 ? "💥" : "✦");
      }
      if (i % 2 === 0) playTone("hit");
      await wait(hard ? 95 : boss ? 100 : 110);
    }

    const won = power >= enemy;
    if (state.surgeBattles > 0) state.surgeBattles -= 1;
    if (state.charmBattles > 0) state.charmBattles -= 1;

    if (won) {
      // Slow trophy drip so ranks take real climb sessions
      let trophyGain = 3 + Math.floor(wave * 0.9);
      // Lean crystal drip — wins feel good, but Crystal Sip still needs Stars/gems buys
      let gemGain = 5 + Math.floor(wave * 1.5);
      if (boss) {
        trophyGain += 6;
        gemGain += 14;
        const ev = todayEvent();
        if (ev.bossGems) gemGain += ev.bossGems;
      }
      if (hard) {
        trophyGain += 10;
        gemGain += 28;
      }
      const ev = todayEvent();
      if (ev.gemMult) gemGain = Math.round(gemGain * ev.gemMult);
      const prevTheme = themeForWave(wave).id;
      state.wins += 1;
      state.trophies += trophyGain;
      state.gems += gemGain;
      state.wave += 1;
      state.bestWave = Math.max(state.bestWave, state.wave);
      grantClimbUnlocks();
      bumpQuest("wins");
      addPassXp(hard ? 25 : boss ? 18 : 12);
      checkRankUp();
      // Wins keep the full squad — no post-fight wipe.
      saveState();
      els.battleModal.hidden = true;
      if (els.battleStage) {
        els.battleStage.classList.remove("is-fighting", "is-shake", "is-boss", "is-hard", "is-night");
      }
      const foeLabel = hard ? `Hard Gate ${wave}` : boss ? foeName : "";
      showResult(true, wave, trophyGain, gemGain, foeLabel);
      playTone(hard ? "gate" : "win");
      haptic("success");
      if (hard) {
        setTimeout(() => showPandaStory("season", `Hard Gate ${wave} shattered.`), 700);
      } else if (boss) {
        setTimeout(() => showPandaStory("bossWin", `${foeName} defeated.`), 700);
      } else if (themeForWave(state.wave).id !== prevTheme) {
        setTimeout(() => showPandaStory("themeShift", `Welcome to ${themeForWave(state.wave).name}.`), 700);
      } else if (SEASON_MILESTONES.some((m) => m.wave === wave)) {
        setTimeout(() => showPandaStory("season", `Arena ${wave} milestone!`), 700);
      }
    } else {
      const loss = Math.min(state.trophies, (hard ? 10 : boss ? 6 : 4) + Math.floor(wave / 4));
      const gemGain = hard ? 6 : boss ? 4 : 2;
      state.trophies = Math.max(0, state.trophies - loss);
      state.gems += gemGain;
      checkRankUp();
      // Soft loss tax: sometimes drop the weakest unit (not every fight).
      if (Math.random() < 0.45) consumeWeakest();
      saveState();
      els.battleModal.hidden = true;
      if (els.battleStage) {
        els.battleStage.classList.remove("is-fighting", "is-shake", "is-boss", "is-hard", "is-night");
      }
      const foeLabel = hard ? `Hard Gate ${wave}` : boss ? foeName : "";
      showResult(false, wave, -loss, gemGain, foeLabel);
      playTone("lose");
      haptic("error");
    }

    battleBusy = false;
    cheerBuddy(won ? "win" : "lose");
    renderBoard();
  }

  async function startGhostFight() {
    if (battleBusy) return;
    const power = squadPower();
    if (power <= 0) {
      showToast("Need heroes before a ghost duel.");
      return;
    }
    const now = Date.now();
    if (now - Number(state.lastGhostAt || 0) < 20000) {
      showToast("Ghost cooling down — try again soon.");
      return;
    }

    battleBusy = true;
    state.lastGhostAt = now;
    const rival = Math.round(power * 0.92 + state.wave * 8 + Math.random() * 20);
    els.battleModal.hidden = false;
    if (els.battleStage) {
      els.battleStage.classList.add("is-fighting", "is-night");
      els.battleStage.classList.remove("is-boss", "is-hard");
    }
    els.fighterYou.textContent = `YOU ${power}`;
    els.fighterEnemy.textContent = `GHOST ${rival}`;
    els.youBar.style.width = "100%";
    els.enemyBar.style.width = "100%";
    els.battleLog.textContent = "Ghost Rival materializes…";
    if (els.battleFx) els.battleFx.textContent = "👻";
    cheerBuddy("fight");
    playTone("ghost");

    await wait(450);
    const youRatio = power / (power + rival);
    for (let i = 1; i <= 10; i += 1) {
      const progress = i / 10;
      els.youBar.style.width = `${Math.max(0, 100 - progress * 100 * (1 - youRatio) * 1.3)}%`;
      els.enemyBar.style.width = `${Math.max(0, 100 - progress * 100 * youRatio * 1.3)}%`;
      if (els.battleStage) els.battleStage.classList.toggle("is-shake", i % 2 === 0);
      if (els.battleFx) els.battleFx.textContent = i % 2 === 0 ? "👻" : "💥";
      if (i % 2 === 0) playTone("hit");
      await wait(100);
    }

    const won = power >= rival;
    if (won) {
      const gems = 8 + Math.floor(state.wave * 0.8);
      const trophies = 2 + Math.floor(state.wave / 5);
      state.ghostWins = Number(state.ghostWins || 0) + 1;
      state.gems += gems;
      state.trophies += trophies;
      bumpQuest("ghosts");
      addPassXp(10);
      checkRankUp();
      saveState();
      els.battleModal.hidden = true;
      if (els.battleStage) els.battleStage.classList.remove("is-fighting", "is-shake", "is-night");
      showResult(true, state.wave, trophies, gems, "");
      els.resultEyebrow.textContent = "Ghost Victory";
      els.resultTitle.textContent = "Shadow Rival Down";
      els.resultText.textContent = "Free duel won — Glory Pass XP gained.";
      playTone("ghost");
      haptic("success");
    } else {
      const gems = 2;
      state.gems += gems;
      saveState();
      els.battleModal.hidden = true;
      if (els.battleStage) els.battleStage.classList.remove("is-fighting", "is-shake", "is-night");
      showResult(false, state.wave, 0, gems, "");
      els.resultEyebrow.textContent = "Ghost Hold";
      els.resultTitle.textContent = "Shadow Still Stands";
      els.resultText.textContent = "Fuse higher and challenge again.";
      playTone("lose");
      haptic("error");
    }

    battleBusy = false;
    cheerBuddy(won ? "win" : "lose");
    renderBoard();
    renderGlory();
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

  function showResult(won, wave, trophies, gems, foeName) {
    els.resultModal.hidden = false;
    const hard = String(foeName || "").startsWith("Hard Gate");
    const boss = Boolean(foeName) && !hard;
    els.resultEyebrow.textContent = won
      ? (hard ? "Gate Cleared" : boss ? "Boss Victory" : "Victory")
      : (hard ? "Gate Hold" : boss ? "Boss Hold" : "Defeat");
    els.resultTitle.textContent = won
      ? (hard ? `Hard Gate ${wave} Cleared` : boss ? `${foeName} Down` : `Arena ${wave} Cleared`)
      : (hard ? `Hard Gate ${wave} Holds` : boss ? `${foeName} Holds` : `Arena ${wave} Holds`);
    els.resultText.textContent = won
      ? (hard
        ? "Brutal checkpoint beaten — keep climbing."
        : boss
          ? "Boss chest vibes. Keep climbing."
          : "Your squad smashed the gate.")
      : (hard
        ? "Every 10 is meant to hurt — fuse higher and retry."
        : "Fuse higher and come back swinging.");
    els.resultRewards.innerHTML = `
      <span>${trophies >= 0 ? "+" : ""}${trophies} 🏆</span>
      <span>+${Math.max(0, gems)} 💎</span>
      ${won
        ? (hard ? "<span>Gate chest</span>" : boss ? "<span>Boss chest</span>" : "<span>Next arena unlocked</span>")
        : "<span>Forge stronger</span>"}
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
    if (els.ghostFight) els.ghostFight.addEventListener("click", () => startGhostFight());
    if (els.rankChip) {
      els.rankChip.addEventListener("click", () => switchView("ranks"));
    }
    if (els.questList) {
      els.questList.addEventListener("click", (e) => {
        const btn = e.target && e.target.closest ? e.target.closest("[data-quest]") : null;
        if (!btn) return;
        claimQuest(btn.dataset.quest);
      });
    }
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
    if (els.storyClose) {
      els.storyClose.addEventListener("click", () => {
        if (els.storyModal) els.storyModal.hidden = true;
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
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSaveNow();
    });
    window.addEventListener("pagehide", flushSaveNow);
    window.addEventListener("beforeunload", flushSaveNow);
    ensureQuests();
    if (!state.lastRankId) state.lastRankId = rankForTrophies(state.trophies).id;
    pruneDiscovered();
    seedIfEmpty();
    bind();
    if (els.soundToggle) els.soundToggle.textContent = state.soundOn ? "🔊" : "🔇";
    applyArenaTheme();
    renderBoard();
    cheerBuddy("idle");
    renderRoster();
    renderGlory();
    openTutorial();
    connectCloud().then(() => {
      pruneDiscovered();
      applyReferralIfNeeded();
      collectPendingInviteBonus();
      renderInvite();
      renderHud();
      renderRoster();
      applyArenaTheme();
    });
    const tag = document.getElementById("buildTag");
    if (tag) {
      setTimeout(() => showToast(`Build ${tag.textContent} · slower ranks`), 500);
    }
    if (state.dailyClaimDate !== todayKey()) {
      setTimeout(() => showToast("Daily Chest ready in Glory"), 1400);
    }
    if (state.energy <= 3) {
      setTimeout(() => showToast("Energy scarce — Star Market or Crystal Sip."), 2200);
    }
  }

  boot();
})();
