// Wealthia config — edit these values for your project
// Full monetization guide: MONETIZATION.md
window.WEALTHIA_CONFIG = {
  API_URL: "https://wealthia-backend.onrender.com",
  GAME_URL: "https://wealthia.github.io/wealthia/v5.html?v=2114",
  ADMIN_URL: "https://wealthia.github.io/wealthia/admin.html",

  // Your bot username without @ — used for invite links
  BOT_USERNAME: "WealthiaGameBot",

  // Premium spin admin test bypass (Telegram user id)
  ADMIN_TELEGRAM_ID: "1988089728",

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

  // Social daily task (Tasks tab — URL also set on server via env)
  SOCIAL_TASKS: {
    joinTelegram: "https://t.me/weathia_official"
  },

  // Premium boost prices shown in Earn tab (must match server STAR_PRODUCTS)
  STAR_PRICES: {
    refill_energy: 5,
    tap_boost_30: 10,
    endless_energy_30: 15,
    income_boost_30: 15,
    premium_spin: 30
  },

  // Ticket store packs on Rank tab (must match server STAR_PRODUCTS)
  COIN_STORE_PACKS: [
    { productId: 'coins_5000', coins: 5000, stars: 10 },
    { productId: 'coins_15000', coins: 15000, stars: 25 },
    { productId: 'coins_50000', coins: 50000, stars: 70 },
    { productId: 'coins_150000', coins: 150000, stars: 180 },
    { productId: 'coins_500000', coins: 500000, stars: 450 },
  ],

  TICKET_STORE_PACKS: [
    { id: "tickets_1", tickets: 1, stars: 5 },
    { id: "tickets_5", tickets: 5, stars: 20 },
    { id: "tickets_10", tickets: 10, stars: 35 },
    { id: "tickets_50", tickets: 50, stars: 150 },
    { id: "tickets_100", tickets: 100, stars: 250 }
  ],

  // Premium spin cash prize claim support
  SUPPORT_TELEGRAM_URL: "https://t.me/WealthiaGameBot",

  // Onboarding version — change to show tutorial again
  ONBOARDING_VERSION: "v1",

  // Monthly Grand Prize campaign (config-only — no fake bots)
  // Highest City Value when endDate passes wins prizePool (paid manually via admin)
  GRAND_PRIZE: {
    enabled: false,
    title: "Grand Prize",
    prizePool: 1000,
    currency: "USD",
    // UTC date YYYY-MM-DD — contest ends at 23:59:59 UTC on this day
    endDate: "2026-08-03",
    // Show progress toward this City Value (coins + spent on upgrades)
    qualifyCityValue: 50000,
    // Milestone markers on the progress bar
    milestones: [10000, 25000, 50000, 100000],
    // Prizes for top 3 (display only — you pay manually)
    prizes: {
      first: 500,
      second: 300,
      third: 200
    },
    channelUrl: "https://t.me/weathia_official"
  },

  // Daily contest — highest City Value gained today (UTC) wins prize (paid manually)
  DAILY_PRIZE: {
    enabled: true,
    title: "Daily Prize",
    prize: 10,
    currency: "USD",
    minReferrals: 3,
    channelUrl: "https://t.me/weathia_official"
  }
};
