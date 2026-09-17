/**
 * Checkout: what a cart costs, and what happens once it is paid.
 *
 * Prices and stock are always taken from the POS at the moment of checkout, not
 * from the cart the browser posts. The browser sends SKUs and quantities; every
 * ringgit is recomputed here.
 *
 * There is no stock reservation, because the POS has no reservation concept:
 * stock moves when an order is recorded. So two customers can both be allowed
 * to pay for the last unit within the same payment window. The POS refuses the
 * second order (its checkout transaction re-checks stock inside BEGIN
 * IMMEDIATE), that order lands in pos_failed, and the shop sees it in the
 * attention list. That is the honest trade-off of this design: the alternative
 * is holding stock in the POS for a customer who may never pay.
 */

import { config } from "./config.mjs";
import { getLiveProductMap } from "./catalog.mjs";
import { getPaymentProvider } from "./payments/index.mjs";
import { pushPaidOrderToPos, PosError } from "./pos-client.mjs";
import {
  ORDER_STATUS,
  createOrder,
  getOrder,
  markPaid,
  markPosFailed,
  markRecorded,
  newOrderId,
  recordEvent,
  setPaymentReference
} from "./orders.mjs";

export class CheckoutError extends Error {
  constructor(message, { status = 400, code = "checkout_error", details = null } = {}) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function cleanText(value, { field, max, required = false }) {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!clean) {
    if (required) throw new CheckoutError(`${field} is required.`, { code: "missing_field", details: { field } });
    return "";
  }
  if (clean.length > max) throw new CheckoutError(`${field} is too long.`, { code: "field_too_long", details: { field } });
  return clean;
}

function cleanMultiline(value, { field, max, required = false }) {
  const clean = String(value ?? "").trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  if (!clean) {
    if (required) throw new CheckoutError(`${field} is required.`, { code: "missing_field", details: { field } });
    return "";
  }
  if (clean.length > max) throw new CheckoutError(`${field} is too long.`, { code: "field_too_long", details: { field } });
  return clean;
}

function cleanPhone(value) {
  const clean = String(value ?? "").trim();
  const digits = clean.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new CheckoutError("Enter a valid phone number.", { code: "invalid_phone", details: { field: "phone" } });
  }
  return clean.slice(0, 32);
}

function cleanEmail(value) {
  const clean = String(value ?? "").trim().toLowerCase();
  if (!clean) return "";
  if (clean.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new CheckoutError("Enter a valid email address.", { code: "invalid_email", details: { field: "email" } });
  }
  return clean;
}

function normalizeRequestedItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new CheckoutError("Your bag is empty.", { code: "empty_cart" });
  }
  if (items.length > config.orders.maxLineItems) {
    throw new CheckoutError("Too many different products in one order.", { code: "too_many_items" });
  }

  const merged = new Map();
  for (const item of items) {
    const sku = String(item?.sku ?? "").trim().toUpperCase();
    const qty = Number(item?.qty);
    if (!sku) throw new CheckoutError("An item is missing its product code.", { code: "missing_sku" });
    if (!Number.isInteger(qty) || qty < 1) {
      throw new CheckoutError(`Invalid quantity for ${sku}.`, { code: "invalid_qty", details: { sku } });
    }
    merged.set(sku, (merged.get(sku) || 0) + qty);
  }

  for (const [sku, qty] of merged) {
    if (qty > config.orders.maxItemQty) {
      throw new CheckoutError(
        `The website sells at most ${config.orders.maxItemQty} of one product per order. Message the shop for a larger order.`,
        { code: "qty_above_limit", details: { sku, maxQty: config.orders.maxItemQty } }
      );
    }
  }

  return [...merged].map(([sku, qty]) => ({ sku, qty }));
}

export function shippingCentsFor(subtotalCents) {
  if (config.shipping.freeOverCents > 0 && subtotalCents >= config.shipping.freeOverCents) return 0;
  return Math.max(config.shipping.flatCents, 0);
}

/**
 * Prices a cart against live POS stock.
 *
 * Every rejection names the products involved so the shop page can mark those
 * lines instead of showing one unhelpful error.
 */
export async function priceCart(rawItems) {
  const requested = normalizeRequestedItems(rawItems);
  const catalogue = await getLiveProductMap();

  const lines = [];
  const unavailable = [];

  for (const { sku, qty } of requested) {
    const product = catalogue.get(sku);
    if (!product) {
      unavailable.push({ sku, reason: "not_sold", available: 0 });
      continue;
    }
    if (product.stockQty < qty) {
      unavailable.push({ sku, name: product.name, reason: product.stockQty > 0 ? "not_enough_stock" : "sold_out", available: product.stockQty });
      continue;
    }
    lines.push({
      sku: product.sku,
      name: product.name,
      unitPriceCents: product.priceCents,
      qty,
      lineTotalCents: product.priceCents * qty,
      image: product.image
    });
  }

  if (unavailable.length) {
    throw new CheckoutError("Some items are no longer available.", {
      status: 409,
      code: "items_unavailable",
      details: { items: unavailable }
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const shippingCents = shippingCentsFor(subtotalCents);
  return {
    items: lines,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: config.payments.currency
  };
}

function posNotesFor(order) {
  const lines = [`Website order ${order.id}`];
  if (order.shippingCents > 0) lines.push(`Delivery ${(order.shippingCents / 100).toFixed(2)} included`);
  if (order.deliveryAddress) lines.push(`Deliver to: ${order.deliveryAddress}`);
  if (order.customerEmail) lines.push(`Email: ${order.customerEmail}`);
  if (order.customerNote) lines.push(`Note: ${order.customerNote}`);
  return lines.join(" | ").slice(0, 500);
}

/**
 * Hands a paid order to the POS, which deducts its stock.
 *
 * Safe to call more than once for the same order: the POS deduplicates on the
 * order reference, and an order already recorded here returns immediately.
 */
export async function recordOrderInPos(orderId) {
  const order = getOrder(orderId);
  if (!order) throw new CheckoutError("Order not found.", { status: 404, code: "order_not_found" });
  if (order.status === ORDER_STATUS.recorded) return order;
  if (order.status !== ORDER_STATUS.paid && order.status !== ORDER_STATUS.posFailed) {
    throw new CheckoutError(`Order ${orderId} is ${order.status}, not paid.`, { status: 409, code: "order_not_paid" });
  }

  try {
    const result = await pushPaidOrderToPos({ ...order, posNotes: posNotesFor(order) });
    markRecorded(order.id, { posReference: result.reference, posOrderNo: result.orderNo });
    if (result.duplicate) recordEvent(order.id, "pos_duplicate_ignored", result.reference);
    return getOrder(order.id);
  } catch (error) {
    // The money is already taken, so a failure here is the shop's to resolve:
    // usually the last unit went to a walk-in customer first.
    const message = error instanceof PosError ? error.message : `Could not record the order in the POS: ${error.message}`;
    markPosFailed(order.id, message);
    console.error(`[checkout] POS push failed for ${order.id}: ${message}`);
    return getOrder(order.id);
  }
}

/** Marks an order paid and records it in the POS. Idempotent. */
export async function confirmPayment(orderId, { paymentReference = null, paymentLabel = null, detail = null } = {}) {
  const order = getOrder(orderId);
  if (!order) throw new CheckoutError("Order not found.", { status: 404, code: "order_not_found" });

  if (order.status === ORDER_STATUS.awaitingPayment) {
    markPaid(order.id, { paymentReference, paymentLabel, detail });
  } else if (order.status === ORDER_STATUS.recorded) {
    return order;
  }

  return recordOrderInPos(order.id);
}

export async function placeOrder(payload) {
  const customerName = cleanText(payload?.customerName, { field: "Name", max: 80, required: true });
  const customerPhone = cleanPhone(payload?.customerPhone);
  const customerEmail = cleanEmail(payload?.customerEmail);
  const deliveryAddress = cleanMultiline(payload?.deliveryAddress, { field: "Delivery address", max: 400, required: true });
  const customerNote = cleanMultiline(payload?.customerNote, { field: "Note", max: 300 });

  const priced = await priceCart(payload?.items);
  const provider = getPaymentProvider();

  const order = createOrder({
    id: newOrderId(),
    status: ORDER_STATUS.awaitingPayment,
    currency: priced.currency,
    items: priced.items,
    subtotalCents: priced.subtotalCents,
    shippingCents: priced.shippingCents,
    totalCents: priced.totalCents,
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    customerNote,
    paymentProvider: provider.id,
    paymentLabel: provider.label
  });

  let payment;
  try {
    payment = await provider.startPayment(order);
  } catch (error) {
    recordEvent(order.id, "payment_start_failed", error.message);
    console.error(`[checkout] ${provider.id} could not start payment for ${order.id}: ${error.message}`);
    throw new CheckoutError("Payment could not be started. Please try again in a moment.", {
      status: 502,
      code: "payment_start_failed"
    });
  }

  setPaymentReference(order.id, payment.reference, payment.detail);
  recordEvent(order.id, "payment_started", `${provider.id}:${payment.reference}`);

  return {
    order: publicOrderView(getOrder(order.id)),
    payment: {
      provider: provider.id,
      label: provider.label,
      automatic: Boolean(provider.automatic),
      redirectUrl: payment.redirectUrl || null,
      instructions: payment.instructions || null,
      whatsappNumber: payment.whatsappNumber || null
    }
  };
}

/** What the customer's browser may see: no payment detail, no POS internals. */
export function publicOrderView(order) {
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    currency: order.currency,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      image: item.image || null
    })),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    customerName: order.customerName,
    paymentLabel: order.paymentLabel,
    // pos_failed is a shop-side problem; the customer is told their order is
    // paid and being prepared, which is true, and the shop gets the alert.
    customerStatus: order.status === ORDER_STATUS.posFailed ? ORDER_STATUS.paid : order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt
  };
}
