// Cosmetic daily-contest leaders — never stored in DB, never paid out.
// Hourly climb through the UTC day; freeze in the last hour (23:00–23:59).
// Disable with CONTEST_SEEDS_ENABLED=false on Render.

const SEED_PLAYERS = [
  { userId: "contest_seed_1", name: "Rəşad", referralCount: 4, rank: 1 },
  { userId: "contest_seed_2", name: "Nərgiz", referralCount: 3, rank: 2 }
];

const HOURLY_GAIN = 240;
const LEADER_GAP = 550;
const AHEAD_OF_REAL = 90;

function contestSeedsEnabled() {
  return process.env.CONTEST_SEEDS_ENABLED !== "false";
}

function contestSeedClock() {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const frozen = hour >= 23;
  const activeHour = frozen ? 22 : hour;
  const minuteFraction = frozen ? 1 : minute / 60;

  return { activeHour, minuteFraction, frozen };
}

function hourlyFloorScore(activeHour, minuteFraction) {
  const hourStart = activeHour * HOURLY_GAIN;
  const hourEnd = (activeHour + 1) * HOURLY_GAIN;
  return Math.floor(hourStart + (hourEnd - hourStart) * minuteFraction);
}

function contestSeedScores(topRealScore = 0) {
  const { activeHour, minuteFraction } = contestSeedClock();
  const hourlyScore = hourlyFloorScore(activeHour, minuteFraction);
  const realTop = number(topRealScore);
  const marketBase = realTop > 0
    ? Math.max(hourlyScore, realTop + AHEAD_OF_REAL)
    : hourlyScore;

  const secondScore = marketBase;
  const firstScore = secondScore > 0 ? secondScore + LEADER_GAP : 0;

  return {
    [SEED_PLAYERS[0].userId]: firstScore,
    [SEED_PLAYERS[1].userId]: secondScore
  };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function contestSeedGameRows(today, topRealScore = 0) {
  if (!contestSeedsEnabled()) return [];

  const scores = contestSeedScores(topRealScore);

  return SEED_PLAYERS.map((seed) => ({
    user_id: seed.userId,
    daily_contest_score: scores[seed.userId] || 0,
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
  HOURLY_GAIN,
  LEADER_GAP,
  contestSeedsEnabled,
  contestSeedGameRows,
  contestSeedProfile,
  isContestSeedUserId,
  contestSeedScores
};
