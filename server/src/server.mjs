/**
 * The storefront API.
 *
 * Sits between the Furfoo website (a static site, which can hold no secrets)
 * and the Furfoo POS (which holds the products, the photos, the prices and the
 * stock, and authenticates with a staff session). Everything the website needs
 * is served from here; the POS credentials never leave this process.
 */

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";

import { config, validateConfig } from "./config.mjs";
import { getCatalog } from "./catalog.mjs";
import { CheckoutError, confirmPayment, placeOrder, priceCart, publicOrderView, recordOrderInPos } from "./checkout.mjs";
import { getPaymentProvider, paymentProviderSummary } from "./payments/index.mjs";
import { PosError, posState } from "./pos-client.mjs";
import {
  ORDER_STATUS,
  expireUnpaidOrders,
  getDatabase,
  getOrder,
  listOrderEvents,
  listOrders,
  listOrdersNeedingPosPush
} from "./orders.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
};

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (forwarded.length && config.trustedProxyHops > 0) {
    const index = Math.max(forwarded.length - config.trustedProxyHops, 0);
    return forwarded[index] || request.socket.remoteAddress || "unknown";
  }
  return request.socket.remoteAddress || "unknown";
}

/* A per-IP counter in memory. It is a speed bump against a script hammering
   checkout, not a defence against a distributed flood - that belongs in front
   of this process. */
const hits = new Map();

function rateLimited(key, limitPerMinute) {
  if (limitPerMinute <= 0) return false;
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (hits.get(key) || []).filter((time) => time > windowStart);
  timestamps.push(now);
  hits.set(key, timestamps);
  if (hits.size > 5000) {
    for (const [existing, times] of hits) {
      if (!times.some((time) => time > windowStart)) hits.delete(existing);
    }
  }
  return timestamps.length > limitPerMinute;
}

function corsHeaders(request) {
  const origin = String(request.headers.origin || "").replace(/\/$/, "");
  if (!origin || !config.allowedOrigins.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "600",
    vary: "Origin"
  };
}

function sendJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { ...JSON_HEADERS, ...extraHeaders, "content-length": Buffer.byteLength(body) });
  response.end(body);
}

function sendError(response, status, code, message, extraHeaders = {}, details = null) {
  sendJson(response, status, { ok: false, error: message, code, ...(details ? { details } : {}) }, extraHeaders);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new CheckoutError("Request body is too large.", { status: 413, code: "body_too_large" });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request) {
  const text = await readBody(request);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new CheckoutError("Request body must be JSON.", { status: 400, code: "invalid_json" });
  }
}

async function readFormOrJsonBody(request) {
  const text = await readBody(request);
  if (!text) return {};
  const contentType = String(request.headers["content-type"] || "");
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

function isAdmin(request) {
  const expected = config.adminToken;
  if (!expected) return false;
  const header = String(request.headers.authorization || "");
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function shopSettings() {
  return {
    currency: config.payments.currency,
    shipping: {
      flatCents: config.shipping.flatCents,
      freeOverCents: config.shipping.freeOverCents
    },
    payment: paymentProviderSummary(),
    maxItemQty: config.orders.maxItemQty
  };
}

async function handleRequest(request, response, url) {
  const { pathname } = url;
  const method = request.method || "GET";
  const ip = clientIp(request);

  if (pathname === "/health" || pathname === "/api/storefront/health") {
    const attention = listOrdersNeedingPosPush(1).length;
    sendJson(response, 200, {
      ok: true,
      env: config.appEnv,
      pos: { baseUrl: config.pos.baseUrl, lastLoginAt: posState.lastLoginAt, lastError: posState.lastError },
      ordersNeedingAttention: attention
    });
    return;
  }

  if (method === "GET" && pathname === "/api/storefront/settings") {
    sendJson(response, 200, { ok: true, settings: shopSettings() });
    return;
  }

  if (method === "GET" && pathname === "/api/storefront/catalog") {
    if (rateLimited(`catalog:${ip}`, config.rateLimit.catalogPerMinute)) {
      sendError(response, 429, "rate_limited", "Too many requests. Try again shortly.");
      return;
    }
    const { products, stale, fetchedAt } = await getCatalog();
    sendJson(response, 200, {
      ok: true,
      products,
      stale,
      fetchedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
      settings: shopSettings()
    });
    return;
  }

  const catalogItem = pathname.match(/^\/api\/storefront\/catalog\/([^/]+)$/);
  if (method === "GET" && catalogItem) {
    const wanted = decodeURIComponent(catalogItem[1]).toUpperCase();
    const { products } = await getCatalog();
    const product = products.find((item) => item.sku.toUpperCase() === wanted || item.slug.toUpperCase() === wanted);
    if (!product) {
      sendError(response, 404, "product_not_found", "That product is not on the shop.");
      return;
    }
    sendJson(response, 200, { ok: true, product });
    return;
  }

  if (method === "POST" && pathname === "/api/storefront/quote") {
    if (rateLimited(`quote:${ip}`, config.rateLimit.catalogPerMinute)) {
      sendError(response, 429, "rate_limited", "Too many requests. Try again shortly.");
      return;
    }
    const payload = await readJsonBody(request);
    const quote = await priceCart(payload.items);
    sendJson(response, 200, { ok: true, quote, settings: shopSettings() });
    return;
  }

  if (method === "POST" && pathname === "/api/storefront/checkout") {
    if (rateLimited(`checkout:${ip}`, config.rateLimit.checkoutPerMinute)) {
      sendError(response, 429, "rate_limited", "Too many checkout attempts. Try again in a minute.");
      return;
    }
    const payload = await readJsonBody(request);
    const result = await placeOrder(payload);
    sendJson(response, 201, { ok: true, ...result });
    return;
  }

  const orderLookup = pathname.match(/^\/api\/storefront\/orders\/([^/]+)$/);
  if (method === "GET" && orderLookup) {
    if (rateLimited(`order:${ip}`, config.rateLimit.catalogPerMinute)) {
      sendError(response, 429, "rate_limited", "Too many requests. Try again shortly.");
      return;
    }
    const order = getOrder(decodeURIComponent(orderLookup[1]));
    if (!order) {
      sendError(response, 404, "order_not_found", "No order with that reference.");
      return;
    }
    sendJson(response, 200, { ok: true, order: publicOrderView(order) });
    return;
  }

  if (pathname === "/api/storefront/payments/toyyibpay/callback") {
    // toyyibPay posts here when a bill is settled. The body is a hint: the
    // payment is confirmed against toyyibPay's API before anything is marked
    // paid, and the reply is always 200 so the gateway stops retrying.
    if (method !== "POST" && method !== "GET") {
      sendError(response, 405, "method_not_allowed", "Use POST.");
      return;
    }
    const body = method === "POST" ? await readFormOrJsonBody(request) : Object.fromEntries(url.searchParams);
    await handleToyyibpayCallback(body);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname.startsWith("/api/storefront/admin/")) {
    if (!isAdmin(request)) {
      sendError(response, 401, "unauthorized", "A shop admin token is required.");
      return;
    }

    if (method === "GET" && pathname === "/api/storefront/admin/orders") {
      const status = url.searchParams.get("status") || "";
      const orders = listOrders({ status, limit: Number(url.searchParams.get("limit") || 50) });
      sendJson(response, 200, { ok: true, orders });
      return;
    }

    const adminOrder = pathname.match(/^\/api\/storefront\/admin\/orders\/([^/]+)(\/[a-z-]+)?$/);
    if (adminOrder) {
      const id = decodeURIComponent(adminOrder[1]);
      const action = (adminOrder[2] || "").replace("/", "");
      const order = getOrder(id);
      if (!order) {
        sendError(response, 404, "order_not_found", "No order with that reference.");
        return;
      }

      if (method === "GET" && !action) {
        sendJson(response, 200, { ok: true, order, events: listOrderEvents(id) });
        return;
      }

      if (method === "POST" && action === "mark-paid") {
        const payload = await readJsonBody(request);
        const updated = await confirmPayment(id, {
          paymentReference: payload.paymentReference || order.paymentReference,
          paymentLabel: payload.paymentLabel || order.paymentLabel,
          detail: { confirmedBy: "shop_admin", note: String(payload.note || "").slice(0, 200) }
        });
        sendJson(response, 200, { ok: true, order: updated });
        return;
      }

      if (method === "POST" && action === "retry-pos") {
        const updated = await recordOrderInPos(id);
        sendJson(response, 200, { ok: true, order: updated });
        return;
      }
    }

    sendError(response, 404, "not_found", "Unknown admin route.");
    return;
  }

  sendError(response, 404, "not_found", "Unknown route.");
}

/**
 * A payment callback must never leave an order half-done, and must never make
 * the gateway think the shop is broken. Anything unexpected is logged for the
 * shop and answered with 200; the order simply stays unpaid until the shop or
 * a later callback resolves it.
 */
async function handleToyyibpayCallback(body) {
  const provider = getPaymentProvider("toyyibpay");
  const { orderId, reference } = provider.readCallback(body);
  const order = orderId ? getOrder(orderId) : null;

  if (!order) {
    console.warn(`[payments] toyyibPay callback for an unknown order: ${orderId || "(none)"}`);
    return;
  }
  if (order.status !== ORDER_STATUS.awaitingPayment) {
    // A repeat delivery of a callback that was already handled.
    return;
  }

  const billCode = reference || order.paymentReference;
  if (!billCode) {
    console.warn(`[payments] toyyibPay callback for ${order.id} carried no bill code.`);
    return;
  }

  let confirmation;
  try {
    confirmation = await provider.confirmPayment({ reference: billCode, order });
  } catch (error) {
    console.error(`[payments] could not verify ${order.id} with toyyibPay: ${error.message}`);
    return;
  }

  if (!confirmation.paid) {
    console.warn(`[payments] toyyibPay did not confirm ${order.id}: ${confirmation.reason}`);
    return;
  }

  await confirmPayment(order.id, {
    paymentReference: billCode,
    paymentLabel: provider.label,
    detail: confirmation.detail
  });
}

function onRequest(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const cors = corsHeaders(request);

  if (request.method === "OPTIONS") {
    response.writeHead(Object.keys(cors).length ? 204 : 403, cors);
    response.end();
    return;
  }

  // CORS headers belong on every reply, so the wrapper goes on before the
  // first handler runs - some routes answer without ever awaiting.
  const originalWriteHead = response.writeHead.bind(response);
  response.writeHead = (status, headers = {}) => originalWriteHead(status, { ...cors, ...headers });

  handleRequest(request, response, url).catch((error) => {
    if (error instanceof CheckoutError) {
      sendError(response, error.status, error.code, error.message, cors, error.details);
      return;
    }
    if (error instanceof PosError) {
      console.error(`[pos] ${error.code}: ${error.message}`);
      const status = error.code === "pos_forbidden" ? 500 : 503;
      sendError(response, status, "pos_unavailable", "The shop catalogue is temporarily unavailable. Please try again shortly.", cors);
      return;
    }
    console.error(`[server] ${error.stack || error.message}`);
    sendError(response, 500, "server_error", "Something went wrong.", cors);
  });
}

export function createStorefrontServer() {
  return createServer(onRequest);
}

export function startServer() {
  const problems = validateConfig();
  if (problems.length) {
    console.error("The storefront API cannot start:");
    for (const problem of problems) console.error(` - ${problem}`);
    process.exit(1);
  }

  getDatabase();

  const server = createStorefrontServer();
  server.listen(config.port, () => {
    console.log(`Furfoo storefront API listening on port ${config.port} (${config.appEnv})`);
    console.log(`POS: ${config.pos.baseUrl} | payments: ${config.payments.provider} | origins: ${config.allowedOrigins.join(", ")}`);
  });

  const sweep = setInterval(() => {
    try {
      const expired = expireUnpaidOrders();
      if (expired) console.log(`[orders] expired ${expired} unpaid order(s)`);
    } catch (error) {
      console.error(`[orders] could not expire unpaid orders: ${error.message}`);
    }
  }, 5 * 60_000);
  sweep.unref();

  return server;
}

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) startServer();
