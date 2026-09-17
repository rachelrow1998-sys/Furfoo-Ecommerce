/**
 * The one place this service talks to the Furfoo POS.
 *
 * The POS has no machine tokens: it authenticates a browser session cookie
 * (`furfoo_session`, HttpOnly, SameSite=Lax) issued by POST /api/auth/login.
 * So this client signs in as a dedicated employee account, keeps the cookie in
 * memory, and signs in again when the POS answers 401. The cookie is never
 * written to disk and never leaves this process.
 *
 * The POS is the system of record for products, prices, photos and stock. This
 * service reads them and, when a website order is paid, posts the order back so
 * the POS deducts the stock in its own single-process transaction. Nothing here
 * writes to the POS database directly: the "one process per database" rule in
 * the POS repository is what stops two tills overselling the last unit, and a
 * second writer would break it.
 */

import { config } from "./config.mjs";

export class PosError extends Error {
  constructor(message, { status = 0, body = null, code = "pos_error" } = {}) {
    super(message);
    this.name = "PosError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

const SESSION_COOKIE = "furfoo_session";

let sessionCookie = null;
let loginInFlight = null;

/** Visible in /health so the shop can see whether the POS link is up. */
export const posState = {
  lastLoginAt: null,
  lastErrorAt: null,
  lastError: null
};

function posUrl(path) {
  return `${config.pos.baseUrl}${path}`;
}

function readSessionCookie(response) {
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  for (const cookie of cookies) {
    const [pair] = String(cookie).split(";");
    const [name, ...rest] = pair.split("=");
    if (name.trim() === SESSION_COOKIE) return `${SESSION_COOKIE}=${rest.join("=").trim()}`;
  }
  return null;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // The POS answers HTML for a few non-API paths; keep a short excerpt only.
    return { raw: text.slice(0, 200) };
  }
}

async function rawRequest(path, { method = "GET", body, cookie } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;

  let response;
  try {
    response = await fetch(posUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(config.pos.requestTimeoutMs)
    });
  } catch (error) {
    const reason = error?.name === "TimeoutError"
      ? `The POS did not answer within ${config.pos.requestTimeoutMs}ms.`
      : `Could not reach the POS: ${error.message}`;
    throw new PosError(reason, { code: "pos_unreachable" });
  }

  return { response, payload: await readBody(response) };
}

async function login() {
  // One sign-in at a time. Without this, a burst of requests arriving on a cold
  // start would each post a login and trip the POS login throttle.
  if (loginInFlight) return loginInFlight;

  loginInFlight = (async () => {
    const { response, payload } = await rawRequest("/api/auth/login", {
      method: "POST",
      body: { username: config.pos.username, password: config.pos.password }
    });

    if (response.status === 429) {
      const retryAfter = Number(payload?.retryAfterSeconds) || 60;
      throw new PosError(`The POS login is rate limited. Retry in ${retryAfter}s.`, {
        status: 429,
        code: "pos_login_throttled"
      });
    }
    if (!response.ok || payload?.ok === false) {
      // Never echo the POS reply here: it is about credentials.
      throw new PosError("The POS rejected the storefront sign-in. Check POS_USERNAME and POS_PASSWORD.", {
        status: response.status,
        code: "pos_login_failed"
      });
    }

    const cookie = readSessionCookie(response);
    if (!cookie) {
      throw new PosError("The POS sign-in returned no session cookie.", { code: "pos_login_no_cookie" });
    }

    sessionCookie = cookie;
    posState.lastLoginAt = new Date().toISOString();
    return cookie;
  })();

  try {
    return await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

/**
 * A POS API call with the storefront's session, signing in when needed.
 *
 * A 401 mid-flight means the session expired or the POS restarted, which is
 * ordinary. It is retried once with a fresh cookie. A 403 is not retried: it
 * means the account's role is missing a permission and retrying cannot fix it.
 */
export async function posRequest(path, options = {}) {
  if (!sessionCookie) await login();

  let attempt = await rawRequest(path, { ...options, cookie: sessionCookie });

  if (attempt.response.status === 401) {
    sessionCookie = null;
    await login();
    attempt = await rawRequest(path, { ...options, cookie: sessionCookie });
  }

  const { response, payload } = attempt;

  if (response.status === 403) {
    throw new PosError(
      `The POS account is not allowed to use ${path}. Give its role view_stock and import_online_orders.`,
      { status: 403, body: payload, code: "pos_forbidden" }
    );
  }

  if (!response.ok || payload?.ok === false) {
    const message = payload?.error || `The POS answered ${response.status} for ${path}.`;
    throw new PosError(message, { status: response.status, body: payload, code: "pos_request_failed" });
  }

  return payload;
}

/** Every product the POS holds, with live stock. Unfiltered; see catalog.mjs. */
export async function fetchPosProducts() {
  try {
    const payload = await posRequest("/api/inventory/products");
    const products = Array.isArray(payload?.products) ? payload.products : [];
    posState.lastError = null;
    return products;
  } catch (error) {
    posState.lastErrorAt = new Date().toISOString();
    posState.lastError = error.message;
    throw error;
  }
}

/**
 * Record a paid website order in the POS, which deducts its stock.
 *
 * `externalOrderKey` is the website's own order reference. The POS stores it in
 * `external_order_refs` and returns the first order again (`duplicate: true`)
 * if the same key arrives twice, so a payment gateway that retries its callback
 * cannot deduct the same stock a second time.
 */
export async function pushPaidOrderToPos(order) {
  const payload = await posRequest("/api/online/whatsapp-orders", {
    method: "POST",
    body: {
      // The POS derives the order total from amountPaidCents, so that field
      // carries what the customer actually paid, delivery included. The goods
      // subtotal stays separate and the delivery fee is spelled out in the
      // note, because the POS has no delivery-fee field for a manual order.
      externalOrderKey: order.id,
      reference: order.id,
      customerName: order.customerName,
      phone: order.customerPhone,
      paymentMethod: order.paymentLabel || "Website",
      fulfilmentStatus: "pending",
      notes: order.posNotes,
      subtotalCents: order.subtotalCents,
      discountCents: 0,
      amountPaidCents: order.totalCents,
      items: order.items.map((item) => ({
        sku: item.sku,
        qty: item.qty,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.unitPriceCents * item.qty
      }))
    }
  });

  const posOrder = payload?.order || {};
  return {
    reference: posOrder.reference || order.id,
    orderNo: posOrder.orderNo || null,
    duplicate: Boolean(posOrder.duplicate)
  };
}

/** Test seam: drops the cached session so the next call signs in again. */
export function resetPosSession() {
  sessionCookie = null;
}
