import http from "node:http";

const port = process.env.PORT || 3000;

const users = {};

const defaultGame = {
  coins: 0,
  energy: 100,
  taps: 0,
  cityValue: 0,
  buildings: {
    shop: 1,
    bank: 0,
    factory: 0
  }
};

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true, app: "Wealthia API" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/session") {
    const body = await readBody(req);
    const tg = body.telegramUser || {};
    const userId = String(tg.id || "demo_user");

    if (!users[userId]) {
      users[userId] = {
        userId,
        name: tg.first_name || "Player",
        username: tg.username || "",
        game: structuredClone(defaultGame),
        createdAt: Date.now()
      };
    }

    users[userId].lastSeenAt = Date.now();
    send(res, 200, users[userId]);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tap") {
    const body = await readBody(req);
    const user = users[String(body.userId)];

    if (!user) {
      send(res, 404, { error: "USER_NOT_FOUND" });
      return;
    }

    if (user.game.energy <= 0) {
      send(res, 400, { error: "NO_ENERGY", user });
      return;
    }

    const amount = user.game.buildings.shop;

    user.game.energy -= 1;
    user.game.coins += amount;
    user.game.cityValue += amount;
    user.game.taps += 1;
    user.lastSeenAt = Date.now();

    send(res, 200, { amount, user });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/summary") {
    const list = Object.values(users);

    send(res, 200, {
      users: list.length,
      totalCoins: list.reduce((sum, user) => sum + user.game.coins, 0),
      totalTaps: list.reduce((sum, user) => sum + user.game.taps, 0),
      topPlayers: list
        .sort((a, b) => b.game.cityValue - a.game.cityValue)
        .slice(0, 10)
    });
    return;
  }

  send(res, 404, { error: "NOT_FOUND" });
});

server.listen(port, () => {
  console.log(`Wealthia backend running on http://localhost:${port}`);
});

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
