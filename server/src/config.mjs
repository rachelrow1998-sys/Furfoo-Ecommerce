/**
 * Configuration for the storefront API.
 *
 * Everything is read from the environment once, at startup, so a missing
 * setting fails immediately instead of at the first customer's checkout.
 * Secrets (the POS password, the payment key, the admin token) are read here
 * and never written to a log line or sent to the browser.
 */

const env = process.env;

function text(key, fallback = "") {
  const value = env[key];
  return value === undefined || value === null ? fallback : String(value).trim();
}

function integer(key, fallback) {
  const raw = text(key);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a whole number.`);
  return value;
}

function bool(key, fallback = false) {
  const raw = text(key).toLowerCase();
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

function list(key) {
  return text(key)
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const appEnv = text("APP_ENV", "development").toLowerCase();
const isHosted = appEnv === "production" || appEnv === "staging";

export const config = {
  appEnv,
  isHosted,
  port: integer("PORT", 4321),
  /** Where the browser reaches this service. Used for payment callback URLs. */
  publicApiUrl: text("PUBLIC_API_URL").replace(/\/$/, ""),
  /** Where the shop lives, for payment return links: https://furfoopet.com */
  publicSiteUrl: text("PUBLIC_SITE_URL").replace(/\/$/, ""),

  /** Browser origins allowed to call this API. Exact matches, no wildcards. */
  allowedOrigins: list("ALLOWED_ORIGINS"),

  pos: {
    baseUrl: text("POS_BASE_URL").replace(/\/$/, ""),
    username: text("POS_USERNAME"),
    password: text("POS_PASSWORD"),
    /** Catalogue cache window. Stock is re-read from the POS on every checkout. */
    catalogTtlMs: integer("POS_CATALOG_TTL_MS", 60_000),
    requestTimeoutMs: integer("POS_REQUEST_TIMEOUT_MS", 10_000)
  },

  catalog: {
    /** Product statuses the shop may display. Everything else stays hidden. */
    publishedStatuses: new Set(
      (text("CATALOG_PUBLISHED_STATUSES", "active").toLowerCase().split(",").map((item) => item.trim()).filter(Boolean))
    ),
    /** SKU prefixes to publish, e.g. "FF-TRT-,FF-HB-". Empty publishes all. */
    skuPrefixes: list("CATALOG_SKU_PREFIXES").map((item) => item.toUpperCase()),
    /** SKUs never published, whatever their status. */
    skuBlocklist: new Set(list("CATALOG_SKU_BLOCKLIST").map((item) => item.toUpperCase())),
    /** A product with no price is a data-entry gap, not a free product. */
    hideZeroPrice: bool("CATALOG_HIDE_ZERO_PRICE", true)
  },

  shipping: {
    flatCents: integer("SHIPPING_FLAT_CENTS", 800),
    freeOverCents: integer("SHIPPING_FREE_OVER_CENTS", 10_000)
  },

  orders: {
    /** SQLite file for website orders. Keep it outside the deployed directory. */
    databasePath: text("ORDERS_DATABASE_PATH", "./data/storefront.sqlite"),
    /** Longest an unpaid order stays open before the shop stops waiting for it. */
    unpaidExpiryMinutes: integer("ORDER_UNPAID_EXPIRY_MINUTES", 60),
    maxItemQty: integer("ORDER_MAX_ITEM_QTY", 20),
    maxLineItems: integer("ORDER_MAX_LINE_ITEMS", 30)
  },

  payments: {
    /** manual = bank transfer / WhatsApp, confirmed by the shop. */
    provider: text("PAYMENT_PROVIDER", "manual").toLowerCase(),
    currency: text("CURRENCY", "MYR").toUpperCase(),
    manual: {
      instructions: text("MANUAL_PAYMENT_INSTRUCTIONS"),
      whatsappNumber: text("MANUAL_PAYMENT_WHATSAPP")
    },
    toyyibpay: {
      baseUrl: text("TOYYIBPAY_BASE_URL", "https://toyyibpay.com").replace(/\/$/, ""),
      secretKey: text("TOYYIBPAY_SECRET_KEY"),
      categoryCode: text("TOYYIBPAY_CATEGORY_CODE")
    }
  },

  /** Bearer token for the shop-owner endpoints (order list, mark paid, retry). */
  adminToken: text("STOREFRONT_ADMIN_TOKEN"),

  rateLimit: {
    checkoutPerMinute: integer("CHECKOUT_RATE_LIMIT_PER_MINUTE", 10),
    catalogPerMinute: integer("CATALOG_RATE_LIMIT_PER_MINUTE", 120)
  },

  /** Hops of trusted reverse proxy in front of this service (Hostinger: 1). */
  trustedProxyHops: integer("TRUSTED_PROXY_HOPS", 1)
};

/**
 * Configuration problems that must stop startup.
 *
 * A storefront that starts without POS credentials looks healthy and sells
 * nothing; one that starts without an admin token in production exposes the
 * order list. Both are worth a failed boot instead of a silent degradation.
 */
export function validateConfig(current = config) {
  const problems = [];

  if (!current.pos.baseUrl) problems.push("POS_BASE_URL is required.");
  else if (!/^https?:\/\//.test(current.pos.baseUrl)) problems.push("POS_BASE_URL must start with http:// or https://");
  if (!current.pos.username) problems.push("POS_USERNAME is required.");
  if (!current.pos.password) problems.push("POS_PASSWORD is required.");

  if (!current.allowedOrigins.length) problems.push("ALLOWED_ORIGINS is required (the shop's origin, e.g. https://furfoopet.com).");

  if (current.payments.provider === "toyyibpay") {
    if (!current.payments.toyyibpay.secretKey) problems.push("TOYYIBPAY_SECRET_KEY is required when PAYMENT_PROVIDER=toyyibpay.");
    if (!current.payments.toyyibpay.categoryCode) problems.push("TOYYIBPAY_CATEGORY_CODE is required when PAYMENT_PROVIDER=toyyibpay.");
    if (!current.publicApiUrl) problems.push("PUBLIC_API_URL is required when a payment gateway calls back.");
  } else if (current.payments.provider !== "manual") {
    problems.push(`Unknown PAYMENT_PROVIDER "${current.payments.provider}". Use manual or toyyibpay.`);
  }

  if (current.isHosted) {
    if (!current.adminToken) problems.push("STOREFRONT_ADMIN_TOKEN is required in a hosted environment.");
    else if (current.adminToken.length < 24) problems.push("STOREFRONT_ADMIN_TOKEN must be at least 24 characters.");
    if (!current.pos.baseUrl.startsWith("https://")) problems.push("POS_BASE_URL must use https in a hosted environment.");
    if (!current.publicSiteUrl) problems.push("PUBLIC_SITE_URL is required in a hosted environment.");
  }

  return problems;
}
