// Cosmetic daily-contest leaders — never stored in DB, never paid out.
// Scores start near 0 at UTC midnight and climb slowly through the day.
// Disable with CONTEST_SEEDS_ENABLED=false on Render.

const SEED_PLAYERS = [
  { userId: "contest_seed_1", name: "Rəşad", referralCount: 4, pace: 1, maxScore: 1320 },
  { userId: "contest_seed_2", name: "Nərgiz", referralCount: 3, pace: 0.84, maxScore: 980 }
];

function utcDayFraction() {
  const now = new Date();
  return (now.getUTCHours() * 60 + now.getUTCMinutes()) / (24 * 60);
}

function contestSeedDailyScore(seed) {
  const dayFraction = utcDayFraction();
  const maxScore = seed.maxScore || 1200;
  // Slow morning, steady climb — mimics real players tapping through the day.
  const curve = Math.pow(dayFraction, 1.18);
  const minuteWobble = (new Date().getUTCMinutes() % 11) * seed.pace;
  return Math.floor(curve * maxScore * seed.pace + minuteWobble);
}

function contestSeedsEnabled() {
  return process.env.CONTEST_SEEDS_ENABLED !== "false";
}

function contestSeedGameRows(today) {
  if (!contestSeedsEnabled()) return [];

  return SEED_PLAYERS.map((seed) => ({
    user_id: seed.userId,
    daily_contest_score: contestSeedDailyScore(seed),
    contest_date: today,
    city_value: 0,
    _contestSeed: true
  }));
}

function contestSeedProfile(userId) {
  return SEED_PLAYERS.find((seed) => seed.userId === userId) || null;
}

function isContestSeedUserId(userId) {
  return String(userId).startsWith("contest_seed_");
}

module.exports = {
  SEED_PLAYERS,
  contestSeedsEnabled,
  contestSeedGameRows,
  contestSeedProfile,
  isContestSeedUserId,
  contestSeedDailyScore
};
