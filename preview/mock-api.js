export const PREVIEW_USER_ID = "preview_wealthia_player";

const tomorrow = new Date();
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
tomorrow.setUTCHours(0, 0, 0, 0);

export function buildMockSession() {
  return {
    userId: PREVIEW_USER_ID,
    token: "preview-token",
    game: {
      coins: 284500,
      totalBalance: 284500,
      energy: 860,
      currentEnergy: 860,
      maxEnergy: 1200,
      taps: 4820,
      spent: 156000,
      cityValue: 440500,
      tapValue: 24,
      hourlyProfit: 1850,
      offlineEarnings: 0,
      offlineCashAdded: 0,
      autoUpgrades: [],
      autoBuyEnabled: true,
      dailyScore: 1372,
      tickets: 1,
      ticketProgress: { current: 372, target: 1000, percent: 37 },
      dailyDate: new Date().toISOString().slice(0, 10),
      dailyStreak: 5,
      dailyTasksDate: new Date().toISOString(),
      dailyTasksNextRefresh: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      dailyReward: {
        streak: 5,
        claimedToday: false,
        nextAmount: 250
      },
      boosts: {
        tapActive: false,
        incomeActive: false,
        endlessActive: false,
        tapUntil: 0,
        incomeUntil: 0,
        endlessUntil: 0
      },
      dailyTasks: [
        {
          id: "tap_500",
          title: "Tap Master",
          description: "Tap 500 times today",
          type: "taps",
          target: 500,
          reward: 400,
          progress: 482,
          ready: false,
          claimed: false
        },
        {
          id: "city_10000",
          title: "City Builder",
          description: "Reach 10,000 City Value",
          type: "city_value",
          target: 10000,
          reward: 600,
          progress: 440500,
          ready: true,
          claimed: false
        },
        {
          id: "shop_5",
          title: "Shop Upgrade",
          description: "Reach Shop Level 5",
          type: "shop_level",
          target: 5,
          reward: 350,
          progress: 12,
          ready: true,
          claimed: false
        },
        {
          id: "join_channel",
          title: "Join Channel",
          description: "Subscribe to @weathia_official",
          type: "social",
          target: 1,
          reward: 500,
          progress: 0,
          ready: true,
          claimed: false
        }
      ],
      tasks: {
        tap100: true,
        earn500: true,
        shopUpgrade: true,
        bankOpen: true,
        invite: true,
        sponsor: false,
        channel: false
      },
      adReward: {
        nextAt: Date.now() + 45 * 1000,
        reward: 1500,
        cooldownMs: 60 * 1000
      },
      bonusAdReward: {
        nextAt: Date.now() + 30 * 1000,
        reward: 800,
        cooldownMs: 60 * 1000
      },
      buildings: {
        shop: 12,
        bank: 8,
        factory: 6,
        casino: 3
      },
      empireLevel: 18,
      casino: {
        level: 3,
        spunToday: false,
        canSpin: true
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
        score: 1372,
        date: new Date().toISOString().slice(0, 10),
        resetsAt: tomorrow.toISOString(),
        minReferrals: 1,
        eligible: true,
        tickets: 1,
        ticketProgress: { current: 372, target: 1000, percent: 37 }
      },
      referrals: {
        count: 5,
        required: 3,
        eligible: true
      },
      tickets: 1,
      ticketProgress: { current: 372, target: 1000, percent: 37 }
    }
  };
}

export function buildMockLeaderboard() {
  return {
    top3: [
      {
        rank: 1,
        userId: "player_murad",
        name: "Murad",
        cityValue: 520000,
        dailyScore: 2450,
        tickets: 2,
        score: 2,
        isYou: false,
        prizeEligible: true
      },
      {
        rank: 2,
        userId: PREVIEW_USER_ID,
        name: "You",
        cityValue: 440500,
        dailyScore: 1372,
        tickets: 1,
        score: 1,
        isYou: true,
        prizeEligible: true
      },
      {
        rank: 3,
        userId: "player_leyla",
        name: "Leyla",
        cityValue: 390200,
        dailyScore: 1180,
        tickets: 1,
        score: 1,
        isYou: false,
        prizeEligible: true
      }
    ],
    you: null,
    daily: {
      date: new Date().toISOString().slice(0, 10),
      resetsAt: tomorrow.toISOString(),
      minReferrals: 1,
      yourReferrals: 5,
      eligible: true,
      top3: [
        {
          rank: 1,
          userId: "player_murad",
          name: "Murad",
          cityValue: 520000,
          dailyScore: 2450,
          tickets: 2,
          score: 2,
          isYou: false,
          prizeEligible: true
        },
        {
          rank: 2,
          userId: PREVIEW_USER_ID,
          name: "You",
          cityValue: 440500,
          dailyScore: 1372,
          tickets: 1,
          score: 1,
          isYou: true,
          prizeEligible: true
        },
        {
          rank: 3,
          userId: "player_leyla",
          name: "Leyla",
          cityValue: 390200,
          dailyScore: 1180,
          tickets: 1,
          score: 1,
          isYou: false,
          prizeEligible: true
        }
      ],
      rows: [],
      you: null,
      yourRank: 2,
      yourScore: 1372,
      yourTickets: 1,
      ticketProgress: { current: 372, target: 1000, percent: 37 },
      lastWinner: {
        displayName: "Aysel",
        username: "aysel_w",
        label: "@aysel_w",
        tickets: 21,
        contestDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      }
    }
  };
}

export function buildMockTournament() {
  return {
    tournament: null
  };
}

export function buildMockHealth() {
  return {
    ok: true,
    database: true,
    telegram: { configured: true, username: "WealthiaGameBot" }
  };
}

export function buildMockPremiumSpinStatus() {
  return {
    ok: true,
    canSpin: true,
    priceStars: 1
  };
}
