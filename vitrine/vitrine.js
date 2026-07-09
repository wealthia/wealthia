(() => {
  const STORAGE_KEY = "vitrine_state_v2";

  const MATERIALS = [
    { id: "ribbon", name: "Ribbon", color: "#ff6b9d" },
    { id: "paper", name: "Paper", color: "#5aa8ff" },
    { id: "charm", name: "Charm", color: "#4dffc3" },
    { id: "spark", name: "Spark", color: "#ffd166" }
  ];

  const GIFTS = [
    {
      id: "candy_bow",
      name: "Candy Bow",
      rarity: "common",
      tone: "rose",
      blurb: "Soft pink wrap for sweet sends.",
      recipe: { ribbon: 1, paper: 1 },
      stars: 15
    },
    {
      id: "aurora_box",
      name: "Aurora Box",
      rarity: "rare",
      tone: "violet",
      blurb: "Glow wrap with a violet lid.",
      recipe: { ribbon: 1, spark: 2 },
      stars: 35
    },
    {
      id: "mint_parcel",
      name: "Mint Parcel",
      rarity: "rare",
      tone: "mint",
      blurb: "Fresh mint finish, clean and bright.",
      recipe: { charm: 2, paper: 1 },
      stars: 40
    },
    {
      id: "sky_keepsake",
      name: "Sky Keepsake",
      rarity: "epic",
      tone: "sky",
      blurb: "Blue-box energy for big moments.",
      recipe: { paper: 2, spark: 1, charm: 1 },
      stars: 75
    },
    {
      id: "sun_crate",
      name: "Sun Crate",
      rarity: "epic",
      tone: "sun",
      blurb: "Golden crate — the flex piece.",
      recipe: { spark: 2, ribbon: 1, charm: 1 },
      stars: 90
    }
  ];

  const SHOP_PACKS = [
    {
      id: "pack_ribbon",
      name: "Ribbon Pack",
      blurb: "Exactly 3 Ribbon",
      tone: "rose",
      stars: 20,
      materials: { ribbon: 3 }
    },
    {
      id: "pack_spark",
      name: "Spark Pack",
      blurb: "Exactly 2 Spark + 1 Charm",
      tone: "sun",
      stars: 45,
      materials: { spark: 2, charm: 1 }
    },
    {
      id: "pack_full",
      name: "Full Kit",
      blurb: "1 of each material",
      tone: "violet",
      stars: 60,
      materials: { ribbon: 1, paper: 1, charm: 1, spark: 1 }
    }
  ];

  const defaultState = () => ({
    essence: 0,
    materials: { ribbon: 0, paper: 0, charm: 0, spark: 0 },
    collection: [],
    lastClaimDate: "",
    featuredGiftId: "aurora_box"
  });

  let state = loadState();
  let toastTimer = null;
  let selectedSendUid = null;

  const $ = (id) => document.getElementById(id);

  const els = {
    essenceValue: $("essenceValue"),
    matsTotal: $("matsTotal"),
    claimButton: $("claimButton"),
    claimLabel: $("claimLabel"),
    goComposeButton: $("goComposeButton"),
    homeEyebrow: $("homeEyebrow"),
    homeTitle: $("homeTitle"),
    homeSub: $("homeSub"),
    heroBox: $("heroBox"),
    floatChip: $("floatChip"),
    materialStrip: $("materialStrip"),
    recipeList: $("recipeList"),
    craftStage: $("craftStage"),
    craftOrb: $("craftOrb"),
    craftLabel: $("craftLabel"),
    gallery: $("gallery"),
    collectionSummary: $("collectionSummary"),
    shopGrid: $("shopGrid"),
    sendPicker: $("sendPicker"),
    sendButton: $("sendButton"),
    toast: $("toast"),
    revealModal: $("revealModal"),
    revealVisual: $("revealVisual"),
    revealName: $("revealName"),
    revealRarity: $("revealRarity"),
    revealClose: $("revealClose")
  };

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        materials: { ...defaultState().materials, ...(parsed.materials || {}) },
        collection: Array.isArray(parsed.collection) ? parsed.collection : []
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showToast(message) {
    els.toast.hidden = false;
    els.toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2400);
  }

  function giftById(id) {
    return GIFTS.find((g) => g.id === id) || GIFTS[0];
  }

  function matsCount() {
    return Object.values(state.materials).reduce((sum, n) => sum + Number(n || 0), 0);
  }

  function canAfford(recipe) {
    return Object.entries(recipe).every(([key, need]) => Number(state.materials[key] || 0) >= need);
  }

  function spend(recipe) {
    Object.entries(recipe).forEach(([key, need]) => {
      state.materials[key] = Math.max(0, Number(state.materials[key] || 0) - need);
    });
  }

  function addMats(bag) {
    Object.entries(bag).forEach(([key, amount]) => {
      state.materials[key] = Number(state.materials[key] || 0) + Number(amount || 0);
    });
  }

  function recipeText(recipe) {
    return Object.entries(recipe)
      .map(([key, amount]) => {
        const mat = MATERIALS.find((m) => m.id === key);
        return `${amount} ${mat ? mat.name : key}`;
      })
      .join(" · ");
  }

  function claimedToday() {
    return state.lastClaimDate === todayKey();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function initTelegram() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor("#0b1020");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#0b1020");
    } catch {
      // browser preview
    }
  }

  function switchPanel(name) {
    document.querySelectorAll(".panel").forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    document.querySelectorAll(".dock__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.nav === name);
    });
    if (name === "atelier") renderAtelier();
    if (name === "collection") renderCollection();
    if (name === "shop") renderShop();
    if (name === "send") renderSend();
  }

  function renderWallet() {
    els.essenceValue.textContent = String(state.essence);
    els.matsTotal.textContent = String(matsCount());
  }

  function renderHome() {
    const featured = giftById(state.featuredGiftId);
    els.heroBox.dataset.tone = featured.tone;
    els.floatChip.textContent = featured.name;

    const claimed = claimedToday();
    els.claimButton.classList.toggle("btn--claimed", claimed);
    els.claimButton.classList.toggle("btn--glow", !claimed);
    els.claimButton.disabled = claimed;
    els.claimLabel.textContent = claimed ? "Come back tomorrow" : "Claim today’s kit";
    els.homeEyebrow.textContent = claimed ? "Kit claimed" : "Today’s drop";
    els.homeTitle.textContent = claimed ? "Your kit is ready to compose" : "Open your daily gift kit";
    els.homeSub.textContent = claimed
      ? "Head to Compose and make a gift with a clear recipe."
      : "One beautiful drop a day. Craft what you want — no spins, no random wins.";
  }

  function renderMaterials() {
    els.materialStrip.innerHTML = MATERIALS.map((mat) => `
      <article class="mat-chip">
        <div class="mat-chip__dot" style="background:${mat.color}"></div>
        <strong>${Number(state.materials[mat.id] || 0)}</strong>
        <span>${mat.name}</span>
      </article>
    `).join("");
  }

  function renderAtelier() {
    renderMaterials();
    els.recipeList.innerHTML = GIFTS.map((gift) => {
      const ready = canAfford(gift.recipe);
      return `
        <button class="compose-card ${ready ? "" : "is-locked"}" type="button" data-craft="${gift.id}">
          <div class="compose-card__box" data-tone="${gift.tone}"></div>
          <div>
            <h3>${gift.name}</h3>
            <p>${gift.blurb}</p>
            <p>${recipeText(gift.recipe)}</p>
          </div>
          <span class="compose-card__cta">${ready ? "Make" : "Need"}</span>
        </button>
      `;
    }).join("");

    els.recipeList.querySelectorAll("[data-craft]").forEach((btn) => {
      btn.addEventListener("click", () => craftGift(btn.dataset.craft));
    });
  }

  function renderCollection() {
    const unique = new Set(state.collection.map((item) => item.giftId));
    els.collectionSummary.textContent = `${state.collection.length} owned · ${unique.size}/${GIFTS.length} designs`;

    if (!state.collection.length) {
      els.gallery.innerHTML = `<div class="empty-note">No gifts yet.<br/>Claim today’s kit, then Compose one.</div>`;
      return;
    }

    els.gallery.innerHTML = state.collection
      .slice()
      .reverse()
      .map((item) => {
        const gift = giftById(item.giftId);
        return `
          <article class="gift-card" data-tone="${gift.tone}">
            <div class="gift-card__box" data-tone="${gift.tone}"></div>
            <div>
              <h3>${gift.name}</h3>
              <p>${gift.rarity}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderShop() {
    const giftCards = GIFTS.map((gift) => `
      <button class="offer-card" type="button" data-buy-gift="${gift.id}" data-tone="${gift.tone}">
        <div class="offer-card__box" data-tone="${gift.tone}"></div>
        <div>
          <h3>${gift.name}</h3>
          <p>${gift.rarity} · exact gift</p>
        </div>
        <span class="offer-card__price">${gift.stars} ★</span>
      </button>
    `).join("");

    const packCards = SHOP_PACKS.map((pack) => `
      <button class="offer-card" type="button" data-buy-pack="${pack.id}" data-tone="${pack.tone}">
        <div class="offer-card__box" data-tone="${pack.tone}"></div>
        <div>
          <h3>${pack.name}</h3>
          <p>${pack.blurb}</p>
        </div>
        <span class="offer-card__price">${pack.stars} ★</span>
      </button>
    `).join("");

    els.shopGrid.innerHTML = giftCards + packCards;

    els.shopGrid.querySelectorAll("[data-buy-gift]").forEach((btn) => {
      btn.addEventListener("click", () => buyGift(btn.dataset.buyGift));
    });
    els.shopGrid.querySelectorAll("[data-buy-pack]").forEach((btn) => {
      btn.addEventListener("click", () => buyPack(btn.dataset.buyPack));
    });
  }

  function renderSend() {
    if (!state.collection.length) {
      els.sendPicker.innerHTML = `<div class="empty-note">Make a gift first, then share it.</div>`;
      els.sendButton.disabled = true;
      return;
    }

    els.sendPicker.innerHTML = state.collection
      .slice()
      .reverse()
      .map((item) => {
        const gift = giftById(item.giftId);
        const selected = selectedSendUid === item.uid;
        return `
          <button class="gift-card ${selected ? "is-selected" : ""}" type="button" data-send-uid="${item.uid}" data-tone="${gift.tone}">
            <div class="gift-card__box" data-tone="${gift.tone}"></div>
            <div>
              <h3>${gift.name}</h3>
              <p>${gift.rarity}</p>
            </div>
          </button>
        `;
      })
      .join("");

    els.sendPicker.querySelectorAll("[data-send-uid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSendUid = btn.dataset.sendUid;
        renderSend();
      });
    });

    els.sendButton.disabled = !selectedSendUid;
  }

  function openReveal(gift) {
    els.revealVisual.dataset.tone = gift.tone;
    els.revealName.textContent = gift.name;
    els.revealRarity.textContent = gift.rarity;
    els.revealModal.hidden = false;
  }

  function closeReveal() {
    els.revealModal.hidden = true;
  }

  async function craftGift(giftId) {
    const gift = giftById(giftId);
    if (!canAfford(gift.recipe)) {
      showToast("Need more materials for this gift.");
      return;
    }

    els.craftStage.hidden = false;
    els.craftOrb.dataset.tone = gift.tone;
    els.craftLabel.textContent = "Wrapping…";
    await wait(1100);

    spend(gift.recipe);
    state.collection.push({
      uid: `${gift.id}_${Date.now()}`,
      giftId: gift.id,
      craftedAt: new Date().toISOString()
    });
    state.essence += gift.rarity === "epic" ? 25 : gift.rarity === "rare" ? 12 : 5;
    state.featuredGiftId = gift.id;
    saveState();

    els.craftStage.hidden = true;
    renderWallet();
    renderAtelier();
    openReveal(gift);
    showToast(`${gift.name} is yours.`);
  }

  function claimDaily() {
    if (claimedToday()) {
      showToast("Already claimed. Come back tomorrow.");
      return;
    }

    addMats({ ribbon: 1, paper: 1, spark: 1 });
    state.lastClaimDate = todayKey();
    state.essence += 3;
    saveState();
    renderWallet();
    renderHome();
    showToast("Kit claimed · Ribbon, Paper, Spark");

    // playful lid pop
    els.heroBox.style.animation = "none";
    void els.heroBox.offsetWidth;
    els.heroBox.style.animation = "bob 0.6s ease 2";
    window.setTimeout(() => {
      els.heroBox.style.animation = "";
    }, 1200);

    switchPanel("atelier");
  }

  function buyGift(giftId) {
    const gift = giftById(giftId);
    const ok = window.confirm(
      `Get ${gift.name} for ${gift.stars} Stars?\n\nExact gift. No random roll.`
    );
    if (!ok) return;

    state.collection.push({
      uid: `${gift.id}_shop_${Date.now()}`,
      giftId: gift.id,
      craftedAt: new Date().toISOString(),
      source: "shop"
    });
    state.featuredGiftId = gift.id;
    state.essence += 8;
    saveState();
    renderWallet();
    openReveal(gift);
    showToast(`${gift.name} added · ${gift.stars} Stars (demo)`);
  }

  function buyPack(packId) {
    const pack = SHOP_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    const ok = window.confirm(`Get ${pack.name} for ${pack.stars} Stars?\n\n${pack.blurb}`);
    if (!ok) return;

    addMats(pack.materials);
    state.essence += 5;
    saveState();
    renderWallet();
    renderAtelier();
    showToast(`${pack.name} delivered`);
    switchPanel("atelier");
  }

  function shareSelected() {
    if (!selectedSendUid) return;
    const item = state.collection.find((entry) => entry.uid === selectedSendUid);
    if (!item) return;
    const gift = giftById(item.giftId);
    const text =
      `I made ${gift.name} in VITRINE 🎁\n` +
      `Clear recipes. Exact gifts. No spins.\n` +
      `https://wealthia.github.io/wealthia/vitrine/`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent("https://wealthia.github.io/wealthia/vitrine/")}&text=${encodeURIComponent(text)}`;
    const tg = window.Telegram && window.Telegram.WebApp;

    try {
      if (tg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink(shareUrl);
        showToast("Pick a friend to send it.");
        return;
      }
    } catch {
      // fall through
    }

    if (navigator.share) {
      navigator.share({ title: "VITRINE", text }).catch(() => copyText(text));
      return;
    }
    copyText(text);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast("Share text copied."));
      return;
    }
    showToast("Open Telegram and share your gift.");
  }

  function bind() {
    document.querySelectorAll(".dock__btn").forEach((btn) => {
      btn.addEventListener("click", () => switchPanel(btn.dataset.nav));
    });
    els.claimButton.addEventListener("click", claimDaily);
    els.goComposeButton.addEventListener("click", () => switchPanel("atelier"));
    els.sendButton.addEventListener("click", shareSelected);
    els.revealClose.addEventListener("click", () => {
      closeReveal();
      switchPanel("collection");
    });
  }

  function boot() {
    initTelegram();
    bind();
    renderWallet();
    renderHome();
    renderAtelier();
    renderCollection();
    renderShop();
    renderSend();
  }

  boot();
})();
