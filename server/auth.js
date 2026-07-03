const crypto = require("crypto");

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INIT_DATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function sessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.ADMIN_SECRET ||
    ""
  );
}

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(String(initData));
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) return null;

  const authDate = Number(params.get("auth_date") || 0) * 1000;
  if (!authDate || Date.now() - authDate > INIT_DATA_MAX_AGE_MS) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw);
    if (!user || !user.id) return null;
    return {
      id: String(user.id),
      first_name: user.first_name || "Player",
      username: user.username || "",
      start_param: params.get("start_param") || ""
    };
  } catch {
    return null;
  }
}

function signToken(userId, expiresAt) {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET_MISSING");
  }

  const payload = `${String(userId)}.${Number(expiresAt)}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  const secret = sessionSecret();
  if (!secret || !token) return null;

  const parts = String(token).split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAt, signature] = parts;
  const payload = `${userId}.${expiresAt}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

  if (signature !== expected) return null;
  if (Number(expiresAt) < Date.now()) return null;

  return String(userId);
}

function createSessionToken(userId) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return {
    token: signToken(userId, expiresAt),
    expiresAt
  };
}

function bearerTokenFromRequest(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

function resolveTelegramUser(req) {
  const initData = String(req.body.initData || "");
  const verified = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN || "");
  if (verified) return verified;

  const allowDemo = String(process.env.ALLOW_DEMO_SESSION || "").toLowerCase() === "true";
  const demoUser = req.body.telegramUser;
  if (allowDemo && demoUser && String(demoUser.id) === "web_demo") {
    return {
      id: "web_demo",
      first_name: demoUser.first_name || "Web Demo",
      username: demoUser.username || "",
      start_param: ""
    };
  }

  return null;
}

module.exports = {
  SESSION_TTL_MS,
  bearerTokenFromRequest,
  createSessionToken,
  resolveTelegramUser,
  verifyToken
};
