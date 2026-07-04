const STARS_PRODUCTION_MODE = process.env.STARS_TEST_MODE !== "true";

function buildStarsInvoiceBody({ title, description, payload, stars }) {
  const body = {
    title: String(title || "Wealthia"),
    description: String(description || "Premium purchase"),
    payload: String(payload || ""),
    currency: "XTR",
    prices: [{ label: String(title || "Wealthia"), amount: Number(stars) }]
  };

  // Telegram Stars: provider_token must be omitted (not even an empty string).
  return body;
}

function isValidStarCheckout(query, starProducts, parseStarPayload) {
  const parsed = parseStarPayload(query?.invoice_payload);
  const telegramId = String(query?.from?.id || "");
  const product = parsed ? starProducts[parsed.productId] : null;
  const expectedStars = product ? Number(product.stars) : 0;

  return Boolean(
    STARS_PRODUCTION_MODE &&
    parsed &&
    product &&
    telegramId &&
    parsed.userId === telegramId &&
    query.currency === "XTR" &&
    Number(query.total_amount) === expectedStars
  );
}

async function answerPreCheckoutQuery(telegramApiSafe, query, options = {}) {
  const { starProducts, parseStarPayload } = options;
  const queryId = String(query?.id || "");

  if (!queryId) {
    return { ok: false, error: "MISSING_QUERY_ID" };
  }

  const approved = isValidStarCheckout(query, starProducts, parseStarPayload);

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
}

async function verifyStarCharge(telegramApiSafe, chargeId, expectedStars) {
  if (!chargeId) return false;

  const lookup = await telegramApiSafe("getStarTransactions", { limit: 100 });
  if (!lookup.ok || !lookup.result?.transactions) {
    console.warn("STAR_TRANSACTION_LOOKUP_FAILED:", lookup.error || "unknown");
    return true;
  }

  return lookup.result.transactions.some((entry) => {
    const source = entry?.source || {};
    const amount = Number(source.amount || entry?.amount || 0);
    const txId = String(
      source.telegram_payment_charge_id ||
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
    sendBotMessage
  } = options;

  const payment = message?.successful_payment;
  if (!payment) return { ok: false, error: "NO_PAYMENT" };

  const parsed = parseStarPayload(payment.invoice_payload);
  const telegramId = String(message?.from?.id || "");
  const chatId = message?.chat?.id;
  const product = parsed ? starProducts[parsed.productId] : null;
  const expectedStars = product ? Number(product.stars) : 0;

  if (!parsed || !product || parsed.userId !== telegramId) {
    if (chatId && sendBotMessage) {
      await sendBotMessage(chatId, "Payment received, but the product could not be activated. Contact support.");
    }
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  if (payment.currency !== "XTR" || Number(payment.total_amount) !== expectedStars) {
    if (chatId && sendBotMessage) {
      await sendBotMessage(chatId, "Payment amount mismatch. Contact support for a refund.");
    }
    return { ok: false, error: "INVALID_AMOUNT" };
  }

  const chargeId = String(payment.telegram_payment_charge_id || "").trim();
  if (!chargeId || chargeId.length < 8) {
    if (chatId && sendBotMessage) {
      await sendBotMessage(chatId, "Payment received, but charge verification failed. Contact support.");
    }
    return { ok: false, error: "INVALID_CHARGE_ID" };
  }

  const verified = await verifyStarCharge(telegramApiSafe, chargeId, expectedStars);
  if (!verified) {
    console.warn("STAR_CHARGE_NOT_FOUND_IN_LEDGER:", chargeId);
  }

  try {
    await fulfillPayment({
      userId: parsed.userId,
      productId: parsed.productId,
      chargeId,
      stars: expectedStars,
      invoicePayload: payment.invoice_payload
    });

    if (chatId && sendBotMessage) {
      await sendBotMessage(
        chatId,
        `${product.successMessage || "Premium purchase activated!"}\n\nReturn to the game and keep building.`
      );
    }

    return { ok: true, chargeId, productId: parsed.productId, userId: parsed.userId };
  } catch (error) {
    console.error("STAR_FULFILLMENT_ERROR:", error.message);
    if (chatId && sendBotMessage) {
      await sendBotMessage(
        chatId,
        "Payment received. Activation is processing — reopen the game in a few seconds."
      );
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
    drop_pending_updates: false
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

module.exports = {
  STARS_PRODUCTION_MODE,
  buildStarsInvoiceBody,
  answerPreCheckoutQuery,
  handleSuccessfulPayment,
  processTelegramUpdate,
  registerTelegramWebhook,
  getBotStarBalance,
  verifyStarCharge
};
