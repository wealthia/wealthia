(() => {
  const STORAGE_KEY = "vitrine_state_v1";

  const MATERIALS = [
    { id: "silk", name: "Silk", color: "#d9c4a5" },
    { id: "ink", name: "Ink", color: "#5c6b7a" },
    { id: "ember", name: "Ember", color: "#c45a3a" },
    { id: "gilt", name: "Gilt", color: "#e8c484" }
  ];

  const GIFTS = [
    {
      id: "paper_crane",
      name: "Paper Crane",
      rarity: "common",
      blurb: "Folded calm for quiet desks.",
      recipe: { silk: 1, ink: 1 },
      stars: 15,
      gradient: "linear-gradient(160deg, #d7d0c4, #8a8378)"
    },
    {
      id: "aurora_ribbon",
      name: "Aurora Ribbon",
      rarity: "rare",
      blurb: "Soft light wrapped in gilt thread.",
      recipe: { silk: 1, gilt: 2 },
      stars: 35,
      gradient: "linear-gradient(160deg, #f3dfb2, #c9a05a 55%, #7a5224)"
    },
    {
      id: "ember_lantern",
      name: "Ember Lantern",
      rarity: "rare",
      blurb: "Warm glow for late evenings.",
      recipe: { ember: 2, ink: 1 },
      stars: 40,
      gradient: "linear-gradient(160deg, #f0b090, #c45a3a 60%, #5a2a1c)"
    },
    {
      id: "obsidian_seal",
      name: "Obsidian Seal",
      rarity: "epic",
      blurb: "A mark that says the piece is yours.",
      recipe: { ink: 2, gilt: 1, ember: 1 },
      stars: 75,
      gradient: "linear-gradient(160deg, #f8e7c2, #8a6a3a 40%, #2a2420 85%)"
    },
    {
      id: "velvet_case",
      name: "Velvet Case",
      rarity: "epic",
      blurb: "For the gift you refuse to rush.",
      recipe: { silk: 2, ember: 1, gilt: 1 },
      stars: 90,
      gradient: "linear-gradient(160deg, #f8e7c2, #e0a85a 35%, #c45a3a 80%)"
    }
  ];

  const SHOP_PACKS = [
    {
      id: "pack_silk",
      name: "Silk Bundle",
      blurb: "Exactly 3 Silk",
      stars: 20,
      materials: { silk: 3 }
    },
    {
      id: "pack_gilt",
      name: "Gilt Filament",
      blurb: "Exactly 2 Gilt + 1 Ember",
      stars: 45,
      materials: { gilt: 2, ember: 1 }
    },
    {
      id: "pack_atelier",
      name: "Atelier Crate",
      blurb: "1 of each material",
      stars: 60,
      materials: { silk: 1, ink: 1, ember: 1, gilt: 1 }
    }
  ];

  const defaultState = () => ({
    essence: 0,
    materials: { silk: 0, ink: 0, ember: 0, gilt: 0 },
    collection: [],
    lastClaimDate: "",
    selectedSendId: null,
    featuredGiftId: "aurora_ribbon"
  });

  let state = loadState();
  let toastTimer = null;
  let selectedSendUid = null;

  const els = {
    essenceValue: document.getElementById("essenceValue"),
    claimButton: document.getElementById("claimButton"),
    claimLabel: document.getElementById("claimLabel"),
    claimHint: document.getElementById("claimHint"),
    materialStrip: document.getElementById("materialStrip"),
    recipeList: document.getElementById("recipeList"),
    craftStage: document.getElementById("craftStage"),
    craftOrb: document.getElementById("craftOrb"),
    craftLabel: document.getElementById("craftLabel"),
    gallery: document.getElementById("gallery"),
    collectionSummary: document.getElementById("collectionSummary"),
    shopGrid: document.getElementById("shopGrid"),
    sendPicker: document.getElementById("sendPicker"),
    sendButton: document.getElementById("sendButton"),
    toast: document.getElementById("toast"),
    revealModal: document.getElementById("revealModal"),
    revealVisual: document.getElementById("revealVisual"),
    revealName: document.getElementById("revealName"),
    revealRarity: document.getElementById("revealRarity"),
    revealClose: document.getElementById("revealClose"),
    featuredGift: document.getElementById("featuredGift"),
    featuredVisual: document.getElementById("featuredVisual"),
    featuredName: document.getElementById("featuredName"),
    featuredMeta: document.getElementById("featuredMeta")
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
    if (!els.toast) return;
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

  function canAffordRecipe(recipe) {
    return Object.entries(recipe).every(([key, need]) => Number(state.materials[key] || 0) >= need);
  }

  function spendMaterials(recipe) {
    Object.entries(recipe).forEach(([key, need]) => {
      state.materials[key] = Math.max(0, Number(state.materials[key] || 0) - need);
    });
  }

  function addMaterials(bag) {
    Object.entries(bag).forEach(([key, amount]) => {
      state.materials[key] = Number(state.materials[key] || 0) + Number(amount || 0);
    });
  }

  function recipeLabel(recipe) {
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

  function initTelegram() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor("#0a0908");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#070605");
    } catch {
      // Ignore Telegram host quirks in browser preview.
    }
  }

  function switchPanel(name) {
    document.querySelectorAll(".panel").forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    document.querySelectorAll(".dock__item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.nav === name);
    });

    if (name === "atelier") renderAtelier();
    if (name === "collection") renderCollection();
    if (name === "shop") renderShop();
    if (name === "send") renderSend();
  }

  function renderHome() {
    const featured = giftById(state.featuredGiftId);
    els.featuredGift.dataset.rarity = featured.rarity;
    els.featuredVisual.style.background = featured.gradient;
    els.featuredName.textContent = featured.name;
    els.featuredMeta.textContent = "Today’s showcase · clear craft path";

    const claimed = claimedToday();
    els.claimButton.classList.toggle("cta--claimed", claimed);
    els.claimButton.disabled = claimed;
    els.claimLabel.textContent = claimed ? "Materials claimed today" : "Claim today’s materials";
    els.claimHint.textContent = claimed
      ? "Come back tomorrow for a fresh drop"
      : "+1 Silk · +1 Ink · +1 Gilt";
  }

  function renderWallet() {
    els.essenceValue.textContent = String(state.essence);
  }

  function renderMaterials() {
    els.materialStrip.innerHTML = MATERIALS.map((mat) => `
      <article class="material-chip">
        <div class="material-chip__swatch" style="background:${mat.color}"></div>
        <strong>${Number(state.materials[mat.id] || 0)}</strong>
        <span>${mat.name}</span>
      </article>
    `).join("");
  }

  function renderAtelier() {
    renderMaterials();
    els.recipeList.innerHTML = GIFTS.map((gift) => {
      const ready = canAffordRecipe(gift.recipe);
      return `
        <button class="recipe-card ${ready ? "" : "is-locked"}" type="button" data-craft="${gift.id}">
          <div class="recipe-card__preview" data-rarity="${gift.rarity}" style="background:${gift.gradient}"></div>
          <div>
            <h3>${gift.name}</h3>
            <p>${gift.blurb}</p>
            <p>${recipeLabel(gift.recipe)}</p>
          </div>
          <span class="recipe-card__cost">${ready ? "Craft" : "Need more"}</span>
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
      els.gallery.innerHTML = `
        <div class="empty-note">
          Your gallery is empty.<br />Claim materials on Home, then craft in Atelier.
        </div>
      `;
      return;
    }

    els.gallery.innerHTML = state.collection
      .slice()
      .reverse()
      .map((item) => {
        const gift = giftById(item.giftId);
        return `
          <article class="gift-tile">
            <div class="gift-tile__visual" style="background:${gift.gradient}"></div>
            <h3>${gift.name}</h3>
            <p>${gift.rarity}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderShop() {
    const giftCards = GIFTS.map((gift) => `
      <button class="shop-card" type="button" data-buy-gift="${gift.id}">
        <div class="shop-card__visual" style="background:${gift.gradient}"></div>
        <h3>${gift.name}</h3>
        <p>${gift.rarity} · instant own</p>
        <span class="shop-card__price">${gift.stars} Stars</span>
      </button>
    `).join("");

    const packCards = SHOP_PACKS.map((pack) => `
      <button class="shop-card" type="button" data-buy-pack="${pack.id}">
        <div class="shop-card__visual" style="background:linear-gradient(160deg,#f0d7a8,#6d4a24)"></div>
        <h3>${pack.name}</h3>
        <p>${pack.blurb}</p>
        <span class="shop-card__price">${pack.stars} Stars</span>
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
      els.sendPicker.innerHTML = `
        <div class="empty-note">
          Craft or buy a gift first, then share it with a friend.
        </div>
      `;
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
          <button class="send-card ${selected ? "is-selected" : ""}" type="button" data-send-uid="${item.uid}">
            <div class="send-card__visual" style="background:${gift.gradient}"></div>
            <h3>${gift.name}</h3>
            <p>${gift.rarity}</p>
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
    els.revealVisual.style.background = gift.gradient;
    els.revealName.textContent = gift.name;
    els.revealRarity.textContent = gift.rarity;
    els.revealModal.hidden = false;
  }

  function closeReveal() {
    els.revealModal.hidden = true;
  }

  async function craftGift(giftId) {
    const gift = giftById(giftId);
    if (!canAffordRecipe(gift.recipe)) {
      showToast("Not enough materials for this recipe.");
      return;
    }

    els.craftStage.hidden = false;
    els.craftOrb.style.background = gift.gradient;
    els.craftLabel.textContent = "Composing…";

    await wait(1100);

    spendMaterials(gift.recipe);
    const owned = {
      uid: `${gift.id}_${Date.now()}`,
      giftId: gift.id,
      craftedAt: new Date().toISOString()
    };
    state.collection.push(owned);
    state.essence += gift.rarity === "epic" ? 25 : gift.rarity === "rare" ? 12 : 5;
    state.featuredGiftId = gift.id;
    saveState();

    els.craftStage.hidden = true;
    renderWallet();
    renderAtelier();
    openReveal(gift);
    showToast(`${gift.name} placed in your gallery.`);
  }

  function claimDaily() {
    if (claimedToday()) {
      showToast("Already claimed today. Return tomorrow.");
      return;
    }

    addMaterials({ silk: 1, ink: 1, gilt: 1 });
    state.lastClaimDate = todayKey();
    state.essence += 3;
    saveState();
    renderWallet();
    renderHome();
    showToast("Materials claimed · Silk, Ink, Gilt");
    switchPanel("atelier");
  }

  function buyGift(giftId) {
    const gift = giftById(giftId);
    const tg = window.Telegram && window.Telegram.WebApp;

    // MVP: clear-price purchase simulation until Stars invoice is wired.
    const confirmBuy = window.confirm(
      `Buy ${gift.name} for ${gift.stars} Stars?\n\nYou get exactly this gift — no random roll.`
    );
    if (!confirmBuy) return;

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
    showToast(`${gift.name} added · ${gift.stars} Stars (demo purchase)`);

    if (tg && typeof tg.HapticFeedback?.notificationOccurred === "function") {
      tg.HapticFeedback.notificationOccurred("success");
    }
  }

  function buyPack(packId) {
    const pack = SHOP_PACKS.find((p) => p.id === packId);
    if (!pack) return;

    const confirmBuy = window.confirm(
      `Buy ${pack.name} for ${pack.stars} Stars?\n\n${pack.blurb}`
    );
    if (!confirmBuy) return;

    addMaterials(pack.materials);
    state.essence += 5;
    saveState();
    renderWallet();
    renderAtelier();
    showToast(`${pack.name} delivered · contents as listed`);
    switchPanel("atelier");
  }

  function shareSelectedGift() {
    if (!selectedSendUid) return;
    const item = state.collection.find((entry) => entry.uid === selectedSendUid);
    if (!item) return;

    const gift = giftById(item.giftId);
    const text =
      `I crafted ${gift.name} in VITRINE — a premium gift atelier.\n` +
      `No spins. Clear recipes. Real collection energy.\n` +
      `https://wealthia.github.io/wealthia/vitrine/`;

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent("https://wealthia.github.io/wealthia/vitrine/")}&text=${encodeURIComponent(text)}`;
    const tg = window.Telegram && window.Telegram.WebApp;

    try {
      if (tg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink(shareUrl);
        showToast("Pick a friend to share your gift.");
        return;
      }
    } catch {
      // Fall through.
    }

    if (navigator.share) {
      navigator.share({ title: "VITRINE", text }).catch(() => {
        copyFallback(text);
      });
      return;
    }

    copyFallback(text);
  }

  function copyFallback(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast("Share text copied."));
      return;
    }
    showToast("Open Telegram and share your gift card.");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function bindNav() {
    document.querySelectorAll(".dock__item").forEach((btn) => {
      btn.addEventListener("click", () => switchPanel(btn.dataset.nav));
    });
  }

  function bindActions() {
    els.claimButton.addEventListener("click", claimDaily);
    els.sendButton.addEventListener("click", shareSelectedGift);
    els.revealClose.addEventListener("click", () => {
      closeReveal();
      switchPanel("collection");
    });
  }

  function boot() {
    initTelegram();
    bindNav();
    bindActions();
    renderWallet();
    renderHome();
    renderAtelier();
    renderCollection();
    renderShop();
    renderSend();
  }

  boot();
})();
