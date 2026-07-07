const STARS_PRODUCTION_MODE = process.env.STARS_TEST_MODE !== "true";
const paymentSecurity = require("./payment-security");

function buildStarsInvoiceBody({ title, description, payload, stars, priceLabel }) {
  const safeTitle = String(title || "Wealthia").trim().slice(0, 32);
  const safeDescription = String(description || "Premium purchase").trim().slice(0, 255);
  const productionPayload = String(payload || "").startsWith("prod|")
    ? String(payload)
    : `prod|${String(payload || "")}`;
  const starAmount = Math.max(1, Math.round(Number(stars) || 0));
  const label = String(priceLabel || safeTitle).trim().slice(0, 32);

  return {
    title: safeTitle,
    description: safeDescription,
    payload: productionPayload.slice(0, 128),
    provider_token: "",
    currency: "XTR",
    prices: [{ label, amount: starAmount }]
  };
}

function normalizeInvoicePayload(payload) {
  const raw = String(payload || "");
  if (raw.startsWith("prod|")) {
    return raw.slice(5);
  }
  if (raw.startsWith("test|")) {
    return "";
  }
  return raw;
}

function isValidStarCheckout(query, starProducts, parseStarPayload) {
  if (!STARS_PRODUCTION_MODE) return false;

  const invoicePayload = normalizeInvoicePayload(query?.invoice_payload);
  const parsed = parseStarPayload(invoicePayload);
  const telegramId = String(query?.from?.id || "");
  const product = parsed ? starProducts[parsed.productId] : null;
  const expectedStars = product ? Number(product.stars) : 0;

  return Boolean(
    parsed &&
    product &&
    telegramId &&
    String(parsed.userId) === String(telegramId) &&
    query.currency === "XTR" &&
    Number(query.total_amount) === expectedStars
  );
}

async function answerPreCheckoutQuery(telegramApiSafe, query, options = {}) {
  const { starProducts, parseStarPayload, logFraud } = options;
  const queryId = String(query?.id || "");

  if (!queryId) {
    return { ok: false, error: "MISSING_QUERY_ID" };
  }

  try {
    const approved = isValidStarCheckout(query, starProducts, parseStarPayload);
    if (!approved) {
      const invoicePayload = normalizeInvoicePayload(query?.invoice_payload);
      const parsed = parseStarPayload(invoicePayload);
      const product = parsed ? starProducts[parsed.productId] : null;
      const fraudDetail = {
        productId: parsed?.productId || "",
        payloadUserId: parsed?.userId || "",
        telegramId: String(query?.from?.id || ""),
        currency: query?.currency || "",
        totalAmount: Number(query?.total_amount || 0),
        expectedStars: product ? Number(product.stars) : 0
      };
      console.warn("PRE_CHECKOUT_REJECTED:", fraudDetail);
      if (typeof logFraud === "function") {
        await logFraud({
          userId: String(query?.from?.id || parsed?.userId || ""),
          eventType: "FRAUD_ATTEMPT",
          detail: `pre_checkout_rejected ${JSON.stringify(fraudDetail)}`
        });
      }
    }
    const response = await telegramApiSafe("answerPreCheckoutQuery", approved
      ? {
        pre_checkout_query_id: queryId,
        ok: true
      }
      : {
        pre_checkout_query_id: queryId,
        ok: false,
        error_message: "Payment verification failed. Please restart the bot and try again."
      });

    if (!response.ok) {
      console.error("ANSWER_PRE_CHECKOUT_FAILED:", response.error);
    }

    return {
      ok: response.ok,
      approved,
      error: response.error || ""
    };
  } catch (error) {
    console.error("ANSWER_PRE_CHECKOUT_EXCEPTION:", error.message);
    try {
      await telegramApiSafe("answerPreCheckoutQuery", {
        pre_checkout_query_id: queryId,
        ok: false,
        error_message: "Payment could not be verified. Please try again."
      });
    } catch (answerError) {
      console.error("ANSWER_PRE_CHECKOUT_FALLBACK_FAILED:", answerError.message);
    }
    return { ok: false, error: error.message || "PRE_CHECKOUT_EXCEPTION" };
  }
}

async function verifyStarCharge(telegramApiSafe, chargeId, expectedStars) {
  if (!chargeId) return false;

  const lookup = await telegramApiSafe("getStarTransactions", { limit: 100 });
  if (!lookup.ok || !lookup.result?.transactions) {
    return false;
  }

  return lookup.result.transactions.some((entry) => {
    const source = entry?.source || {};
    const amount = Math.abs(Number(source.amount || entry?.amount || 0));
    const txId = String(
      source.telegram_payment_charge_id ||
      source.provider_payment_charge_id ||
      source.transaction_id ||
      entry?.id ||
      ""
    );

    return txId === chargeId && amount === Number(expectedStars);
  });
}

async function handleSuccessfulPayment(message, options = {}) {
  const {
    telegramApiSafe,
    starProducts,
    parseStarPayload,
    fulfillPayment,
    sendBotMessage,
    logFraud
  } = options;

  try {
    const payment = message?.successful_payment;
    if (!payment) return { ok: false, error: "NO_PAYMENT" };

    const invoicePayload = normalizeInvoicePayload(payment.invoice_payload);
    const parsed = parseStarPayload(invoicePayload);
    const telegramId = String(message?.from?.id || "");
    const chatId = message?.chat?.id;
    const product = parsed ? starProducts[parsed.productId] : null;
    const expectedStars = product ? Number(product.stars) : 0;

    if (!STARS_PRODUCTION_MODE) {
      return { ok: false, error: "STARS_TEST_MODE_DISABLED" };
    }

    if (!parsed || !product || parsed.userId !== telegramId) {
      if (typeof logFraud === "function") {
        await logFraud({
          userId: telegramId || parsed?.userId || "",
          eventType: "FRAUD_ATTEMPT",
          detail: `invalid_success_payload product=${parsed?.productId || ""} telegram=${telegramId}`
        });
      }
      if (chatId && sendBotMessage) {
        await sendBotMessage(chatId, "Payment received, but the product could not be activated. Contact support.");
      }
      return { ok: false, error: "INVALID_PAYLOAD" };
    }

    if (payment.currency !== "XTR" || Number(payment.total_amount) !== expectedStars) {
      if (typeof logFraud === "function") {
        await logFraud({
          userId: parsed.userId,
          eventType: "FRAUD_ATTEMPT",
          detail: `amount_mismatch product=${parsed.productId} paid=${Number(payment.total_amount || 0)} expected=${expectedStars}`
        });
      }
      if (chatId && sendBotMessage) {
        await sendBotMessage(chatId, "Payment amount mismatch. Contact support for a refund.");
      }
      return { ok: false, error: "INVALID_AMOUNT" };
    }

    const chargeId = paymentSecurity.extractPaymentChargeId(payment);
    if (!chargeId || chargeId.length < 8) {
      if (chatId && sendBotMessage) {
        await sendBotMessage(chatId, "Payment received, but charge verification failed. Contact support.");
      }
      return { ok: false, error: "INVALID_CHARGE_ID" };
    }

    const result = await fulfillPayment({
      userId: parsed.userId,
      productId: parsed.productId,
      chargeId,
      stars: expectedStars,
      invoicePayload: payment.invoice_payload,
      telegramSettled: true
    });

    if (result?.duplicate) {
      return {
        ok: true,
        duplicate: true,
        replay: true,
        chargeId,
        productId: parsed.productId,
        userId: parsed.userId
      };
    }

    const verified = await verifyStarCharge(telegramApiSafe, chargeId, expectedStars);
    if (!verified) {
      console.warn("STAR_CHARGE_NOT_FOUND_IN_LEDGER:", chargeId);
    }

    if (chatId && sendBotMessage) {
      await sendBotMessage(
        chatId,
        `${product.successMessage || "Premium purchase activated!"}\n\nReturn to the game and keep building.`
      );
    }

    return {
      ok: true,
      chargeId,
      productId: parsed.productId,
      userId: parsed.userId,
      telegramVerified: verified,
      duplicate: false
    };
  } catch (error) {
    console.error("STAR_FULFILLMENT_ERROR:", error.message);
    const chatId = message?.chat?.id;
    const { sendBotMessage } = options;
    if (chatId && sendBotMessage) {
      try {
        await sendBotMessage(
          chatId,
          "Payment received. Activation is processing — reopen the game in a few seconds."
        );
      } catch (notifyError) {
        console.error("STAR_FULFILLMENT_NOTIFY_ERROR:", notifyError.message);
      }
    }
    return { ok: false, error: error.message || "FULFILLMENT_FAILED" };
  }
}

async function processTelegramUpdate(update, options = {}) {
  if (update?.pre_checkout_query) {
    return answerPreCheckoutQuery(options.telegramApiSafe, update.pre_checkout_query, options);
  }

  if (update?.message?.successful_payment) {
    return handleSuccessfulPayment(update.message, options);
  }

  if (update?.message && typeof options.handleBotMessage === "function") {
    try {
      const handled = await options.handleBotMessage(update.message, {
        telegramApiSafe: options.telegramApiSafe
      });
      if (handled) return { ok: true, handled: true };
    } catch (error) {
      console.error("BOT_MESSAGE_HANDLER_ERROR:", error.message);
    }
  }

  return null;
}

async function registerTelegramWebhook(telegramApiSafe, options = {}) {
  const secret = String(options.secret || "").trim();
  const baseUrl = String(options.baseUrl || "").trim().replace(/\/$/, "");

  if (!secret || !baseUrl) {
    return { ok: false, error: "WEBHOOK_NOT_CONFIGURED" };
  }

  const url = `${baseUrl}/api/telegram/webhook/${secret}`;
  const response = await telegramApiSafe("setWebhook", {
    url,
    allowed_updates: ["message", "pre_checkout_query"],
    drop_pending_updates: false,
    secret_token: secret
  });

  if (!response.ok) {
    console.error("TELEGRAM_WEBHOOK_SETUP_FAILED:", response.error);
  } else {
    console.log("Telegram webhook registered:", url);
  }

  return response;
}

async function getBotStarBalance(telegramApiSafe) {
  const response = await telegramApiSafe("getMyStarBalance");
  if (!response.ok) {
    return { ok: false, amount: 0, error: response.error || "BALANCE_LOOKUP_FAILED" };
  }

  return {
    ok: true,
    amount: Number(response.result?.amount || 0),
    error: ""
  };
}

function startPaymentPolling(telegramApiSafe, options = {}) {
  let offset = 0;
  let running = true;

  const loop = async () => {
    if (!running) return;

    try {
      const response = await telegramApiSafe("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["pre_checkout_query", "message"]
      });

      if (response.ok && Array.isArray(response.result)) {
        for (const update of response.result) {
          offset = update.update_id + 1;
          try {
            await processTelegramUpdate(update, {
              telegramApiSafe,
              ...options
            });
          } catch (error) {
            console.error("STARS_PAYMENT_UPDATE_ERROR:", error.message);
          }
        }
      } else if (!response.ok) {
        console.warn("STARS_PAYMENT_POLL_FAILED:", response.error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error("STARS_PAYMENT_POLL_EXCEPTION:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    setImmediate(loop);
  };

  loop();

  return () => {
    running = false;
  };
}

async function startStarsPaymentListener(telegramApiSafe, options = {}) {
  const preferPolling = process.env.STARS_USE_POLLING !== "false";

  if (preferPolling) {
    await telegramApiSafe("deleteWebhook", { drop_pending_updates: false });
    const stop = startPaymentPolling(telegramApiSafe, options);
    console.log("Stars payment listener: polling mode (Render-safe)");
    return { mode: "polling", stop };
  }

  const webhook = await registerTelegramWebhook(telegramApiSafe, options);
  if (webhook.ok) {
    return { mode: "webhook", stop: () => {} };
  }

  console.warn("Stars webhook unavailable, using payment polling fallback.");
  const stop = startPaymentPolling(telegramApiSafe, options);
  return { mode: "polling", stop };
}

module.exports = {
  STARS_PRODUCTION_MODE,
  buildStarsInvoiceBody,
  normalizeInvoicePayload,
  answerPreCheckoutQuery,
  handleSuccessfulPayment,
  processTelegramUpdate,
  registerTelegramWebhook,
  getBotStarBalance,
  verifyStarCharge,
  startStarsPaymentListener,
  startPaymentPolling
};
