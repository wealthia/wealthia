import http from "node:http";

const port = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const defaultGame = {
  coins: 0,
  energy: 100,
  taps: 0,
  spent: 0,
  city_value: 0,
  shop_level: 1,
  bank_level: 0,
  factory_level: 0
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, {
        ok: true,
        app: "Wealthia API",
        database: Boolean(supabaseUrl && supabaseKey)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/session") {
      const body = await readBody(req);
      const tg = body.telegramUser || {};
      const userId = String(tg.id || "demo_user");

      await upsertUser({
        id: userId,
        telegram_id: userId,
        first_name: tg.first_name || "Player",
        username: tg.username || ""
      });

      let game = await getGame(userId);

      if (!game) {
        game = await createGame(userId);
      }

      send(res, 200, toClientUser(userId, tg.first_name || "Player", tg.username || "", game));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tap") {
      const body = await readBody(req);
      const userId = String(body.userId || "");
      const game = await getGame(userId);

      if (!game) {
        send(res, 404, { error: "USER_NOT_FOUND" });
        return;
      }

      if (Number(game.energy) <= 0) {
        send(res, 400, { error: "NO_ENERGY", user: toClientUser(userId, "Player", "", game) });
        return;
      }

      const amount = Number(game.shop_level || 1);
      const nextGame = {
        ...game,
        energy: Number(game.energy) - 1,
        coins: Number(game.coins) + amount,
        city_value: Number(game.city_value) + amount,
        taps: Number(game.taps) + 1,
        updated_at: new Date().toISOString()
      };

      await updateGame(userId, nextGame);

      send(res, 200, {
        amount,
        user: toClientUser(userId, "Player", "", nextGame)
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/summary") {
      const games = await select("game_states?select=*");

      send(res, 200, {
        users: games.length,
        totalCoins: games.reduce((sum, game) => sum + Number(game.coins || 0), 0),
        totalTaps: games.reduce((sum, game) => sum + Number(game.taps || 0), 0),
        topPlayers: games
          .sort((a, b) => Number(b.city_value || 0) - Number(a.city_value || 0))
          .slice(0, 10)
      });
      return;
    }

    send(res, 404, { error: "NOT_FOUND" });
  } catch (error) {
    send(res, 500, {
      error: "SERVER_ERROR",
      message: error.message
    });
  }
});

server.listen(port, () => {
  console.log(`Wealthia backend running on port ${port}`);
});

async function upsertUser(user) {
  const existing = await select(`users?id=eq.${encodeURIComponent(user.id)}&select=id`);

  if (existing.length > 0) {
    await patch(`users?id=eq.${encodeURIComponent(user.id)}`, {
      first_name: user.first_name,
      username: user.username,
      last_seen_at: new Date().toISOString()
    });
    return;
  }

  await insert("users", {
    ...user,
    last_seen_at: new Date().toISOString()
  });
}

async function getGame(userId) {
  const rows = await select(`game_states?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows[0] || null;
}

async function createGame(userId) {
  const game = {
    user_id: userId,
    ...defaultGame,
    updated_at: new Date().toISOString()
  };

  const rows = await insert("game_states", game);
  return rows[0];
}

async function updateGame(userId, game) {
  await patch(`game_states?user_id=eq.${encodeURIComponent(userId)}`, {
    coins: game.coins,
    energy: game.energy,
    taps: game.taps,
    spent: game.spent,
    city_value: game.city_value,
    shop_level: game.shop_level,
    bank_level: game.bank_level,
    factory_level: game.factory_level,
    updated_at: new Date().toISOString()
  });
}

function toClientUser(userId, name, username, game) {
  return {
    userId,
    name,
    username,
    game: {
      coins: Number(game.coins || 0),
      energy: Number(game.energy || 0),
      taps: Number(game.taps || 0),
      spent: Number(game.spent || 0),
      cityValue: Number(game.city_value || 0),
      buildings: {
        shop: Number(game.shop_level || 1),
        bank: Number(game.bank_level || 0),
        factory: Number(game.factory_level || 0)
      }
    }
  };
}

async function select(path) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: supabaseHeaders()
  });

  return handleSupabaseResponse(response);
}

async function insert(table, data) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation"
    },
    body: JSON.stringify(data)
  });

  return handleSupabaseResponse(response);
}

async function patch(path, data) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation"
    },
    body: JSON.stringify(data)
  });

  return handleSupabaseResponse(response);
}

async function handleSupabaseResponse(response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Supabase error ${response.status}`);
  }

  return text ? JSON.parse(text) : [];
}

function supabaseHeaders() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json"
  };
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
