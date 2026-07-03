// Cosmetic daily-contest leaders — never stored in DB, never paid out.
// Climb every 20 minutes; morning = middle ranks; after noon = pass leaders; freeze 23:00 UTC.
// Disable with CONTEST_SEEDS_ENABLED=false on Render.

const SEED_PLAYERS = [
  { userId: "contest_seed_1", name: "Marcus", referralCount: 4 },
  { userId: "contest_seed_2", name: "Emma", referralCount: 3 }
];

const SLOT_MINUTES = 20;
const GAIN_PER_SLOT = 14;
const LEADER_GAP = 520;
const NOON_UTC_HOUR = 12;
const FREEZE_UTC_HOUR = 23;

function contestSeedsEnabled() {
  return process.env.CONTEST_SEEDS_ENABLED !== "false";
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function contestSeedClock() {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const frozen = hour >= FREEZE_UTC_HOUR;
  const totalMinutes = frozen
    ? (FREEZE_UTC_HOUR - 1) * 60 + 59
    : hour * 60 + minute;
  const slotIndex = Math.floor(totalMinutes / SLOT_MINUTES);
  const slotProgress = (totalMinutes % SLOT_MINUTES) / SLOT_MINUTES;
  const effectiveSlot = slotIndex + slotProgress;

  const noonMinutes = NOON_UTC_HOUR * 60;
  const endMinutes = (FREEZE_UTC_HOUR - 1) * 60 + 59;
  let postNoonBlend = 0;
  if (totalMinutes >= noonMinutes) {
    postNoonBlend = Math.min(1, (totalMinutes - noonMinutes) / (endMinutes - noonMinutes));
  }

  return { effectiveSlot, frozen, postNoonBlend, hour };
}

function baseSlotScore(effectiveSlot) {
  return Math.floor(effectiveSlot * GAIN_PER_SLOT);
}

function medianScore(realScores) {
  const sorted = realScores.filter((score) => score > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.floor((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function morningTargets(effectiveSlot, realScores, topReal) {
  const base = baseSlotScore(effectiveSlot);
  const median = medianScore(realScores);

  let secondScore;
  if (topReal <= 0) {
    secondScore = Math.floor(base * 0.3);
  } else if (median > 0) {
    secondScore = Math.floor(Math.min(median * 0.68 + base * 0.12, topReal * 0.52));
  } else {
    secondScore = Math.floor(Math.min(base * 0.4, topReal * 0.35));
  }

  secondScore = Math.max(0, Math.min(secondScore, Math.max(0, topReal - 220)));
  const firstScore = secondScore > 0
    ? Math.min(secondScore + LEADER_GAP, Math.max(0, topReal - 140))
    : 0;

  return {
    [SEED_PLAYERS[0].userId]: Math.max(firstScore, 0),
    [SEED_PLAYERS[1].userId]: secondScore
  };
}

function afternoonTargets(effectiveSlot, realScores, topReal, postNoonBlend) {
  const morning = morningTargets(effectiveSlot, realScores, topReal);
  const climb = Math.pow(postNoonBlend, 0.55);
  const base = baseSlotScore(effectiveSlot);
  const endSecond = Math.max(topReal + 110, base + 180);
  const endFirst = endSecond + LEADER_GAP;

  return {
    [SEED_PLAYERS[0].userId]: Math.floor(
      morning[SEED_PLAYERS[0].userId] + (endFirst - morning[SEED_PLAYERS[0].userId]) * climb
    ),
    [SEED_PLAYERS[1].userId]: Math.floor(
      morning[SEED_PLAYERS[1].userId] + (endSecond - morning[SEED_PLAYERS[1].userId]) * climb
    )
  };
}

function contestSeedScores(options = {}) {
  const topReal = number(options.topRealScore);
  const realScores = Array.isArray(options.realScores)
    ? options.realScores.map(number)
    : [];
  const { effectiveSlot, postNoonBlend } = contestSeedClock();

  if (postNoonBlend <= 0) {
    return morningTargets(effectiveSlot, realScores, topReal);
  }

  return afternoonTargets(effectiveSlot, realScores, topReal, postNoonBlend);
}

function contestSeedGameRows(today, options = {}) {
  if (!contestSeedsEnabled()) return [];

  const legacyTop = typeof options === "number" ? options : number(options.topRealScore);
  const realScores = Array.isArray(options.realScores)
    ? options.realScores.map(number)
    : [];
  const topRealScore = legacyTop || realScores.reduce((max, score) => Math.max(max, score), 0);
  const scores = contestSeedScores({ topRealScore, realScores });

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
  SLOT_MINUTES,
  contestSeedsEnabled,
  contestSeedGameRows,
  contestSeedProfile,
  isContestSeedUserId,
  contestSeedScores
};
