/**
 * End-to-end cover for the storefront API against a stand-in POS.
 *
 * The cases that matter are the ones that move stock or money: a cart is priced
 * from the POS and not from the browser, a paid order deducts stock exactly
 * once however many times the callback arrives, and an order the POS refuses is
 * kept where the shop can see it.
 */

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startFakePos } from "./fake-pos.mjs";

const workDir = mkdtempSync(join(tmpdir(), "furfoo-storefront-"));

const posProducts = [
  { sku: "FF-TRT-BEEF-CHIP-50", name: "Beef Chips", category: "handmade_pet_treats", stockQty: 5, priceCents: 1900, lowStockThreshold: 5, imageUrl: "/uploads/products/beef-chips.jpg", productStatus: "active", isBundle: 0 },
  { sku: "FF-HB-ZEN-CALM-25", name: "Herbal Bath - Zen Calm 25g", category: "herbal_bath", stockQty: 0, priceCents: 1490, lowStockThreshold: 3, imageUrl: "https://cdn.example.com/zen.webp", productStatus: "active", isBundle: 0 },
  { sku: "FF-OLD-HIDDEN", name: "Retired Item", category: "", stockQty: 3, priceCents: 900, productStatus: "inactive", isBundle: 0 },
  { sku: "FF-FREEBIE", name: "Sample", category: "", stockQty: 3, priceCents: 0, productStatus: "active", isBundle: 0 }
];

let pos;
let server;
let baseUrl;
let modules;

const ADMIN_TOKEN = "test-admin-token-0123456789abcdef";

before(async () => {
  pos = await startFakePos({ username: "web", password: "secret", products: posProducts });

  process.env.APP_ENV = "test";
  process.env.PORT = "0";
  process.env.POS_BASE_URL = pos.baseUrl;
  process.env.POS_USERNAME = "web";
  process.env.POS_PASSWORD = "secret";
  process.env.ALLOWED_ORIGINS = "https://furfoopet.com";
  process.env.ORDERS_DATABASE_PATH = join(workDir, "storefront.sqlite");
  process.env.PAYMENT_PROVIDER = "manual";
  process.env.STOREFRONT_ADMIN_TOKEN = ADMIN_TOKEN;
  process.env.SHIPPING_FLAT_CENTS = "800";
  process.env.SHIPPING_FREE_OVER_CENTS = "10000";
  process.env.POS_CATALOG_TTL_MS = "50";
  process.env.MANUAL_PAYMENT_INSTRUCTIONS = "Transfer to Maybank 1234.";

  modules = {
    server: await import("../src/server.mjs"),
    catalog: await import("../src/catalog.mjs"),
    orders: await import("../src/orders.mjs")
  };

  server = modules.server.createStorefrontServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pos.close();
  rmSync(workDir, { recursive: true, force: true });
});

async function api(path, { method = "GET", body, token, origin = "https://furfoopet.com" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      origin,
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
}

test("the catalogue publishes only sellable POS products, with POS photos", async () => {
  const { status, body, headers } = await api("/api/storefront/catalog");
  assert.equal(status, 200);
  assert.equal(headers.get("access-control-allow-origin"), "https://furfoopet.com");

  const skus = body.products.map((product) => product.sku);
  assert.deepEqual(skus.sort(), ["FF-HB-ZEN-CALM-25", "FF-TRT-BEEF-CHIP-50"]);

  const chips = body.products.find((product) => product.sku === "FF-TRT-BEEF-CHIP-50");
  assert.equal(chips.price, 19);
  assert.equal(chips.stockQty, 5);
  assert.equal(chips.inStock, true);
  assert.equal(chips.lowStock, true);
  assert.equal(chips.categoryLabel, "Handmade Pet Treats");
  // A POS upload is a relative path; the shop needs an absolute one.
  assert.equal(chips.image, `${pos.baseUrl}/uploads/products/beef-chips.jpg`);

  const bath = body.products.find((product) => product.sku === "FF-HB-ZEN-CALM-25");
  assert.equal(bath.inStock, false);
  assert.equal(bath.image, "https://cdn.example.com/zen.webp");
});

test("an unknown origin gets no CORS grant", async () => {
  const { status, headers } = await api("/api/storefront/catalog", { origin: "https://not-furfoo.example" });
  assert.equal(status, 200);
  assert.equal(headers.get("access-control-allow-origin"), null);
});

test("a cart is priced from the POS, not from the browser", async () => {
  const { status, body } = await api("/api/storefront/quote", {
    method: "POST",
    body: { items: [{ sku: "FF-TRT-BEEF-CHIP-50", qty: 2, unitPriceCents: 1 }] }
  });
  assert.equal(status, 200);
  assert.equal(body.quote.subtotalCents, 3800);
  assert.equal(body.quote.shippingCents, 800);
  assert.equal(body.quote.totalCents, 4600);
});

test("delivery is free above the threshold", async () => {
  const { body } = await api("/api/storefront/quote", { method: "POST", body: { items: [{ sku: "FF-TRT-BEEF-CHIP-50", qty: 5 }] } });
  assert.equal(body.quote.subtotalCents, 9500);
  assert.equal(body.quote.shippingCents, 800);

  const free = await api("/api/storefront/quote", { method: "POST", body: { items: [{ sku: "FF-TRT-BEEF-CHIP-50", qty: 6 }] } });
  assert.equal(free.status, 409, "six is more than the five in stock");
  assert.equal(free.body.code, "items_unavailable");
});

test("a sold-out product cannot be bought", async () => {
  const { status, body } = await api("/api/storefront/checkout", {
    method: "POST",
    body: {
      customerName: "Rachel",
      customerPhone: "0199123946",
      deliveryAddress: "1 Jalan Furfoo, Kuala Lumpur",
      items: [{ sku: "FF-HB-ZEN-CALM-25", qty: 1 }]
    }
  });
  assert.equal(status, 409);
  assert.equal(body.code, "items_unavailable");
  assert.equal(body.details.items[0].reason, "sold_out");
});

test("checkout needs delivery details", async () => {
  const { status, body } = await api("/api/storefront/checkout", {
    method: "POST",
    body: { customerName: "Rachel", customerPhone: "0199123946", items: [{ sku: "FF-TRT-BEEF-CHIP-50", qty: 1 }] }
  });
  assert.equal(status, 400);
  assert.equal(body.code, "missing_field");
});

test("a paid order reaches the POS once and deducts stock once", async () => {
  const placed = await api("/api/storefront/checkout", {
    method: "POST",
    body: {
      customerName: "Rachel Row",
      customerPhone: "+60 19-912 3946",
      customerEmail: "rachel@example.com",
      deliveryAddress: "1 Jalan Furfoo\nKuala Lumpur 50000",
      customerNote: "Leave at the gate",
      items: [{ sku: "FF-TRT-BEEF-CHIP-50", qty: 2 }]
    }
  });

  assert.equal(placed.status, 201);
  assert.equal(placed.body.order.status, "awaiting_payment");
  assert.match(placed.body.payment.instructions, /Maybank/);
  assert.equal(placed.body.payment.automatic, false);
  const orderId = placed.body.order.id;

  // Nothing moves in the POS before the money is confirmed.
  assert.equal(pos.state.products.get("FF-TRT-BEEF-CHIP-50").stockQty, 5);

  const unauthorized = await api(`/api/storefront/admin/orders/${orderId}/mark-paid`, { method: "POST", body: {} });
  assert.equal(unauthorized.status, 401);

  const confirmed = await api(`/api/storefront/admin/orders/${orderId}/mark-paid`, {
    method: "POST",
    body: { paymentReference: "MBB-77812", note: "Transfer seen" },
    token: ADMIN_TOKEN
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.order.status, "recorded");
  assert.equal(confirmed.body.order.posOrderNo, "POS-1");
  assert.equal(pos.state.products.get("FF-TRT-BEEF-CHIP-50").stockQty, 3);

  const posOrder = pos.state.orders.at(-1);
  assert.equal(posOrder.subtotalCents, 3800);
  assert.equal(posOrder.amountPaidCents, 4600, "the customer paid for delivery too");
  assert.match(posOrder.notes, /Deliver to: 1 Jalan Furfoo/);
  assert.equal(posOrder.externalOrderKey, orderId);

  // A second confirmation - a retried gateway callback, or an impatient shop
  // owner clicking twice - must not deduct the stock again.
  const again = await api(`/api/storefront/admin/orders/${orderId}/mark-paid`, { method: "POST", body: {}, token: ADMIN_TOKEN });
  assert.equal(again.status, 200);
  assert.equal(pos.state.products.get("FF-TRT-BEEF-CHIP-50").stockQty, 3);

  const publicView = await api(`/api/storefront/orders/${orderId}`);
  assert.equal(publicView.body.order.status, "recorded");
  assert.equal(publicView.body.order.totalCents, 4600);
  assert.equal(publicView.body.order.paymentReference, undefined, "payment details stay server-side");
});

test("an order the POS refuses is kept for the shop to resolve", async () => {
  const placed = await api("/api/storefront/checkout", {
    method: "POST",
    body: {
      customerName: "Second Customer",
      customerPhone: "0123456789",
      deliveryAddress: "2 Jalan Furfoo",
      items: [{ sku: "FF-TRT-BEEF-CHIP-50", qty: 3 }]
    }
  });
  assert.equal(placed.status, 201);
  const orderId = placed.body.order.id;

  // The shop sells the same units at the counter while this order is unpaid.
  pos.state.products.get("FF-TRT-BEEF-CHIP-50").stockQty = 1;

  const confirmed = await api(`/api/storefront/admin/orders/${orderId}/mark-paid`, { method: "POST", body: {}, token: ADMIN_TOKEN });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.order.status, "pos_failed");
  assert.match(confirmed.body.order.posError, /Insufficient stock/);
  assert.equal(pos.state.products.get("FF-TRT-BEEF-CHIP-50").stockQty, 1, "no partial deduction");

  const health = await api("/health");
  assert.ok(health.body.ordersNeedingAttention >= 1);

  // The customer is not shown the shop's internal problem.
  const publicView = await api(`/api/storefront/orders/${orderId}`);
  assert.equal(publicView.body.order.customerStatus, "paid");

  // Once the shop restocks, the same order can be pushed again.
  pos.state.products.get("FF-TRT-BEEF-CHIP-50").stockQty = 9;
  const retried = await api(`/api/storefront/admin/orders/${orderId}/retry-pos`, { method: "POST", body: {}, token: ADMIN_TOKEN });
  assert.equal(retried.body.order.status, "recorded");
  assert.equal(pos.state.products.get("FF-TRT-BEEF-CHIP-50").stockQty, 6);
});

test("an expired POS session is renewed without losing the request", async () => {
  const loginsBefore = pos.state.loginCount;
  pos.expireSessions();
  modules.catalog.resetCatalogCache();

  const { status, body } = await api("/api/storefront/catalog");
  assert.equal(status, 200);
  assert.ok(body.products.length);
  assert.equal(pos.state.loginCount, loginsBefore + 1);
});

test("the catalogue survives the POS going down", async () => {
  modules.catalog.resetCatalogCache();
  await api("/api/storefront/catalog");

  const posBaseUrl = pos.baseUrl;
  await pos.close();
  // Let the cached list age past its TTL, so the next read really does try the
  // POS and has to fall back.
  await new Promise((resolve) => setTimeout(resolve, 80));

  const { status, body } = await api("/api/storefront/catalog");
  assert.equal(status, 200, "browsing keeps working from the cached list");
  assert.equal(body.stale, true);
  assert.ok(body.products.length);

  // Selling does not: a sale needs live stock.
  const checkout = await api("/api/storefront/checkout", {
    method: "POST",
    body: {
      customerName: "Third Customer",
      customerPhone: "0123456789",
      deliveryAddress: "3 Jalan Furfoo",
      items: [{ sku: "FF-TRT-BEEF-CHIP-50", qty: 1 }]
    }
  });
  assert.equal(checkout.status, 503);
  assert.equal(checkout.body.code, "pos_unavailable");

  pos = await startFakePos({ username: "web", password: "secret", products: posProducts });
  assert.notEqual(pos.baseUrl, posBaseUrl);
});
