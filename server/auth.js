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

function diagnoseTelegramAuth(initData, botToken) {
  if (!botToken) {
    return { ok: false, reason: "BOT_TOKEN_MISSING" };
  }

  if (!initData) {
    return { ok: false, reason: "INIT_DATA_MISSING" };
  }

  const params = new URLSearchParams(String(initData));
  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, reason: "INIT_DATA_INVALID" };
  }

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

  if (calculatedHash !== hash) {
    return { ok: false, reason: "INIT_DATA_HASH_MISMATCH" };
  }

  const authDate = Number(params.get("auth_date") || 0) * 1000;
  if (!authDate || Date.now() - authDate > INIT_DATA_MAX_AGE_MS) {
    return { ok: false, reason: "INIT_DATA_EXPIRED" };
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    return { ok: false, reason: "INIT_DATA_NO_USER" };
  }

  try {
    const user = JSON.parse(userRaw);
    if (!user || !user.id) {
      return { ok: false, reason: "INIT_DATA_NO_USER" };
    }

    return {
      ok: true,
      user: {
        id: String(user.id),
        first_name: user.first_name || "Player",
        username: user.username || "",
        is_bot: Boolean(user.is_bot),
        start_param: params.get("start_param") || ""
      }
    };
  } catch {
    return { ok: false, reason: "INIT_DATA_INVALID" };
  }
}

function verifyTelegramInitData(initData, botToken) {
  const diagnosis = diagnoseTelegramAuth(initData, botToken);
  return diagnosis.ok ? diagnosis.user : null;
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
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const diagnosis = diagnoseTelegramAuth(initData, botToken);
  if (diagnosis.ok) return diagnosis.user;

  const allowDemo = String(process.env.ALLOW_DEMO_SESSION || "").toLowerCase() === "true";
  const demoUser = req.body.telegramUser;
  if (allowDemo && demoUser && String(demoUser.id) === "web_demo") {
    return {
      id: "web_demo",
      first_name: demoUser.first_name || "Web Demo",
      username: demoUser.username || "",
      is_bot: false,
      start_param: ""
    };
  }

  return null;
}

function authFailureReason(req) {
  const initData = String(req.body.initData || "");
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const diagnosis = diagnoseTelegramAuth(initData, botToken);
  return diagnosis.ok ? null : diagnosis.reason;
}

function requireVerifiedTelegramPlayer(req, res, next) {
  const userId = verifyToken(bearerTokenFromRequest(req));
  if (!userId) {
    res.status(401).json({ error: "SESSION_EXPIRED" });
    return;
  }

  const initData = String(req.body.initData || "");
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const diagnosis = diagnoseTelegramAuth(initData, botToken);

  if (!diagnosis.ok) {
    res.status(403).json({
      error: "TELEGRAM_AUTH_FAILED",
      reason: diagnosis.reason || "INIT_DATA_INVALID"
    });
    return;
  }

  if (String(diagnosis.user.id) !== String(userId)) {
    res.status(403).json({ error: "TELEGRAM_USER_MISMATCH" });
    return;
  }

  if (Boolean(diagnosis.user.is_bot)) {
    res.status(403).json({ error: "BOTS_NOT_ALLOWED" });
    return;
  }

  req.playerId = userId;
  req.telegramUser = diagnosis.user;
  next();
}

module.exports = {
  SESSION_TTL_MS,
  authFailureReason,
  bearerTokenFromRequest,
  createSessionToken,
  diagnoseTelegramAuth,
  requireVerifiedTelegramPlayer,
  resolveTelegramUser,
  verifyToken
};
