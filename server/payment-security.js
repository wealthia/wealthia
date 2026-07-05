const premiumSpinSecurity = require("./premium-spin-security");

const TELEGRAM_WEBHOOK_CIDRS = [
  { network: "149.154.160.0", mask: 20 },
  { network: "91.108.4.0", mask: 22 }
];

const STARS_INVOICE_MIN_INTERVAL_MS = Number(process.env.STARS_INVOICE_MIN_INTERVAL_MS || 2000);
const starsInvoiceBuckets = new Map();

function nowMs() {
  return Date.now();
}

function ipv4ToInt(ip) {
  const parts = String(ip || "").trim().split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }

  return value >>> 0;
}

function isIpv4InCidr(ip, network, maskBits) {
  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  if (ipInt === null || networkInt === null) return false;

  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

function normalizeClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const raw = forwarded || req.ip || req.socket?.remoteAddress || "";
  const normalized = String(raw).trim();

  if (normalized.startsWith("::ffff:")) {
    return normalized.slice(7);
  }

  return normalized;
}

function isTelegramWebhookIp(ip) {
  const normalized = String(ip || "").trim();
  if (!normalized || normalized === "unknown") return false;

  return TELEGRAM_WEBHOOK_CIDRS.some((entry) =>
    isIpv4InCidr(normalized, entry.network, entry.mask)
  );
}

function extractPaymentChargeId(payment) {
  const telegramChargeId = String(payment?.telegram_payment_charge_id || "").trim();
  const providerChargeId = String(payment?.provider_payment_charge_id || "").trim();
  return telegramChargeId || providerChargeId;
}

function isUniqueViolation(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key");
}

async function logPaymentFraud(supabase, {
  userId = "",
  eventType = "FRAUD_ATTEMPT",
  detail = ""
}) {
  console.warn(eventType + ":", detail);
  await premiumSpinSecurity.logFraudEvent(supabase, {
    userId,
    eventType,
    detail
  });
}

function createTelegramWebhookGuard({
  webhookSecret = "",
  skipIpCheck = process.env.TELEGRAM_WEBHOOK_SKIP_IP_CHECK === "true"
} = {}) {
  return function telegramWebhookGuard(req, res, next) {
    try {
      if (!webhookSecret || req.params.secret !== webhookSecret) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }

      const headerToken = String(req.headers["x-telegram-bot-api-secret-token"] || "").trim();
      if (headerToken && headerToken !== webhookSecret) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
      }

      if (!skipIpCheck) {
        const clientIp = normalizeClientIp(req);
        if (!isTelegramWebhookIp(clientIp)) {
          console.warn("TELEGRAM_WEBHOOK_IP_REJECTED:", clientIp);
          res.status(403).json({ error: "FORBIDDEN" });
          return;
        }
      }

      next();
    } catch (error) {
      console.error("TELEGRAM_WEBHOOK_GUARD_ERROR:", error.message);
      res.status(500).json({ error: "WEBHOOK_GUARD_ERROR" });
    }
  };
}

function starsInvoiceRateLimit(req, res, next) {
  try {
    const userId = String(req.playerId || "");
    if (!userId) {
      res.status(401).json({ ok: false, error: "SESSION_EXPIRED" });
      return;
    }

    const now = nowMs();
    const last = starsInvoiceBuckets.get(userId) || 0;
    if (now - last < STARS_INVOICE_MIN_INTERVAL_MS) {
      res.status(429).json({
        ok: false,
        error: "INVOICE_RATE_LIMITED",
        message: "Please wait a moment before starting another payment."
      });
      return;
    }

    starsInvoiceBuckets.set(userId, now);
    next();
  } catch (error) {
    console.error("STARS_INVOICE_RATE_LIMIT_ERROR:", error.message);
    res.status(500).json({ ok: false, error: "RATE_LIMIT_ERROR" });
  }
}

module.exports = {
  TELEGRAM_WEBHOOK_CIDRS,
  STARS_INVOICE_MIN_INTERVAL_MS,
  extractPaymentChargeId,
  isTelegramWebhookIp,
  normalizeClientIp,
  isUniqueViolation,
  logPaymentFraud,
  createTelegramWebhookGuard,
  starsInvoiceRateLimit
};
