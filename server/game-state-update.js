const OPTIONAL_GAME_STATE_COLUMNS = new Set([
  "energy_regen_rate",
  "last_energy_updated_at",
  "tap_window_start",
  "tap_window_count",
  "tap_violations"
]);

function isMissingColumnError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("column") &&
    (msg.includes("does not exist") ||
      msg.includes("could not find") ||
      msg.includes("schema cache"))
  );
}

function stripOptionalColumns(patch, error) {
  const next = { ...patch };
  let removed = false;
  const msg = error ? String([
    error?.message,
    error?.details,
    error?.hint,
    error
  ].filter(Boolean).join(" ")).toLowerCase() : "";

  for (const key of Object.keys(next)) {
    if (OPTIONAL_GAME_STATE_COLUMNS.has(key)) {
      if (msg && !msg.includes(key)) continue;
      delete next[key];
      removed = true;
    }
  }

  return { patch: next, removed };
}

async function updateGameState(supabase, userId, patch, options = {}) {
  let current = { ...patch };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    let query = supabase
      .from("game_states")
      .update(current)
      .eq("user_id", String(userId));

    if (options.select) {
      query = query.select(options.select).single();
    }

    const { data, error } = await query;
    if (!error) return data;

    if (!isMissingColumnError(error)) throw error;

    const stripped = stripOptionalColumns(current, error);
    if (!stripped.removed) throw error;
    current = stripped.patch;
  }

  throw new Error("GAME_STATE_UPDATE_FAILED");
}

async function insertGameState(supabase, row, options = {}) {
  let current = { ...row };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    let query = supabase.from("game_states").insert(current);

    if (options.select) {
      query = query.select(options.select).single();
    }

    const { data, error } = await query;
    if (!error) return data;

    if (!isMissingColumnError(error)) throw error;

    const stripped = stripOptionalColumns(current, error);
    if (!stripped.removed) throw error;
    current = stripped.patch;
  }

  throw new Error("GAME_STATE_INSERT_FAILED");
}

module.exports = {
  OPTIONAL_GAME_STATE_COLUMNS,
  insertGameState,
  isMissingColumnError,
  stripOptionalColumns,
  updateGameState
};
