// Wealthia config — edit these values for your project
// Full monetization guide: MONETIZATION.md
window.WEALTHIA_CONFIG = {
  API_URL: "https://wealthia-backend.onrender.com",
  GAME_URL: "https://wealthia.github.io/wealthia/v5.html?v=2019",
  ADMIN_URL: "https://wealthia.github.io/wealthia/admin.html",

  // Your bot username without @ — used for invite links
  BOT_USERNAME: "WealthiaGameBot",

  // AdsGram rewarded ads: https://partner.adsgram.ai
  // Setup guide: ADSGRAM-SETUP.md
  // Leave empty for demo mode (no real ad revenue)
  ADSGRAM_BLOCK_ID: "37147",
  // Production bonus block — update when created on Production platform
  ADSGRAM_BONUS_BLOCK_ID: "37148",
  ADSGRAM_DEBUG: false,
  // Repeatable every 5 minutes (server: AD_REWARD_COOLDOWN_MS)
  AD_REWARD_COOLDOWN_MINUTES: 5,
  // Bonus ad: every 15 minutes, +150 coins
  AD_BONUS_REWARD_COOLDOWN_MINUTES: 15,
  BONUS_AD_REWARD: 150,

  // Partner monetization links (Earn tab rewards)
  SPONSOR_BOT_URL: "https://t.me/WealthiaGameBot",
  PARTNER_CHANNEL_URL: "https://t.me/weathia_official",

  // Premium boost prices shown in Earn tab (must match server STAR_PRODUCTS)
  STAR_PRICES: {
    refill_energy: 5,
    tap_boost_30: 10,
    endless_energy_30: 15,
    income_boost_30: 15
  },

  // Onboarding version — change to show tutorial again
  ONBOARDING_VERSION: "v1"
};
