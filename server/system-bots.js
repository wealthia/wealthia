const economy = require("./economy");

const SYSTEM_BOTS = [
  { botId: "contest_seed_1", name: "Marcus", referralCount: 4 },
  { botId: "contest_seed_2", name: "Emma", referralCount: 3 },
  { botId: "contest_seed_3", name: "Ryan", referralCount: 3 }
];

const TICK_SCORE_MIN = Math.max(
  1,
  Number(process.env.SYSTEM_BOT_TICK_SCORE_MIN || 50)
);
const TICK_SCORE_MAX = Math.max(
  TICK_SCORE_MIN,
  Number(process.env.SYSTEM_BOT_TICK_SCORE_MAX || 150)
);
const MAX_BOT_TICKETS = Math.max(
  1,
  Number(process.env.SYSTEM_BOT_MAX_TICKETS || 35)
);

function number(value) {
  return Number(value || 0);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function systemBotsEnabled() {
  return process.env.SYSTEM_BOTS_ENABLED !== "false";
}

function isSystemBotUserId(userId) {
  return String(userId).startsWith("contest_seed_");
}

function systemBotProfile(userId) {
  const bot = SYSTEM_BOTS.find((row) => row.botId === userId);
  if (!bot) return null;
  return {
    userId: bot.botId,
    name: bot.name,
    referralCount: bot.referralCount
  };
}

function maxBotDailyScore() {
  return MAX_BOT_TICKETS * economy.TICKETS_PER_SCORE;
}

function randomTickGain() {
  const span = TICK_SCORE_MAX - TICK_SCORE_MIN + 1;
  return TICK_SCORE_MIN + Math.floor(Math.random() * span);
}

async function ensureSystemBots(supabase, today = todayKey()) {
  const now = new Date().toISOString();

  for (const bot of SYSTEM_BOTS) {
    const { data: existing } = await supabase
      .from("system_bot_states")
      .select("bot_id, contest_date, daily_contest_score")
      .eq("bot_id", bot.botId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("system_bot_states").insert({
        bot_id: bot.botId,
        display_name: bot.name,
        referral_count: bot.referralCount,
        daily_contest_score: 0,
        contest_date: today,
        updated_at: now
      });
      continue;
    }

    if (existing.contest_date !== today) {
      await supabase
        .from("system_bot_states")
        .update({
          daily_contest_score: 0,
          contest_date: today,
          updated_at: now
        })
        .eq("bot_id", bot.botId);
    }
  }
}

async function resetSystemBots(supabase, today = todayKey()) {
  const now = new Date().toISOString();

  await supabase
    .from("system_bot_states")
    .update({
      daily_contest_score: 0,
      contest_date: today,
      updated_at: now
    })
    .neq("bot_id", "");
}

async function tickSystemBots(supabase, today = todayKey()) {
  if (!systemBotsEnabled()) {
    return { ok: true, skipped: true, reason: "DISABLED", updated: 0 };
  }

  await ensureSystemBots(supabase, today);

  const { data: bots, error } = await supabase
    .from("system_bot_states")
    .select("bot_id, daily_contest_score, contest_date")
    .in(
      "bot_id",
      SYSTEM_BOTS.map((bot) => bot.botId)
    );

  if (error) throw error;

  const maxScore = maxBotDailyScore();
  const updates = [];

  for (const bot of bots || []) {
    if (bot.contest_date !== today) continue;

    const current = number(bot.daily_contest_score);
    if (current >= maxScore) continue;

    const gain = randomTickGain();
    const nextScore = Math.min(maxScore, current + gain);
    if (nextScore <= current) continue;

    updates.push({
      bot_id: bot.bot_id,
      daily_contest_score: nextScore,
      tickets: economy.computeTickets(nextScore),
      gain
    });
  }

  const now = new Date().toISOString();
  for (const row of updates) {
    const { error: updateError } = await supabase
      .from("system_bot_states")
      .update({
        daily_contest_score: row.daily_contest_score,
        updated_at: now
      })
      .eq("bot_id", row.bot_id);

    if (updateError) throw updateError;
  }

  return {
    ok: true,
    updated: updates.length,
    bots: updates
  };
}

async function loadSystemBotGameRows(supabase, today = todayKey()) {
  if (!systemBotsEnabled()) return [];

  await ensureSystemBots(supabase, today);

  const { data: bots, error } = await supabase
    .from("system_bot_states")
    .select("bot_id, display_name, referral_count, daily_contest_score, contest_date")
    .eq("contest_date", today)
    .gt("daily_contest_score", 0);

  if (error) throw error;

  return (bots || []).map((bot) => ({
    user_id: bot.bot_id,
    daily_contest_score: number(bot.daily_contest_score),
    contest_date: today,
    city_value: 0,
    _systemBot: true
  }));
}

module.exports = {
  SYSTEM_BOTS,
  MAX_BOT_TICKETS,
  TICK_SCORE_MIN,
  TICK_SCORE_MAX,
  systemBotsEnabled,
  isSystemBotUserId,
  systemBotProfile,
  ensureSystemBots,
  resetSystemBots,
  tickSystemBots,
  loadSystemBotGameRows
};
