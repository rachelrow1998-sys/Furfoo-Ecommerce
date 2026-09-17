/**
 * Website orders, kept in this service's own SQLite file.
 *
 * The POS is the system of record for stock and for completed sales. This store
 * holds the step before that: an order the customer has placed but not yet paid
 * for, and the delivery details the POS has no field for. Once payment is
 * confirmed the order is pushed into the POS, which is where the stock is
 * deducted, and this row keeps the POS reference so the two can be matched.
 *
 * It is deliberately a separate database from the POS: the POS guarantees no
 * oversell by running exactly one process against its file, and a second writer
 * would break that.
 */

import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { config } from "./config.mjs";

export const ORDER_STATUS = {
  awaitingPayment: "awaiting_payment",
  paid: "paid",
  recorded: "recorded",
  posFailed: "pos_failed",
  expired: "expired",
  cancelled: "cancelled"
};

let db = null;

function configureConnection(connection) {
  // Per-connection settings; they are not stored in the file.
  connection.exec("PRAGMA foreign_keys = ON");
  connection.exec("PRAGMA busy_timeout = 5000");
  return connection;
}

export function openOrderDatabase(path = config.orders.databasePath) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const connection = configureConnection(new DatabaseSync(absolute));
  connection.exec(`
    CREATE TABLE IF NOT EXISTS storefront_orders (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      currency TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      shipping_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      delivery_address TEXT,
      customer_note TEXT,
      payment_provider TEXT NOT NULL,
      payment_label TEXT,
      payment_reference TEXT,
      payment_detail_json TEXT,
      pos_reference TEXT,
      pos_order_no TEXT,
      pos_error TEXT,
      pos_attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at TEXT,
      recorded_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_storefront_orders_status_created
      ON storefront_orders (status, created_at);

    CREATE TABLE IF NOT EXISTS storefront_order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES storefront_orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_storefront_order_events_order
      ON storefront_order_events (order_id, id);
  `);
  return connection;
}

export function getDatabase() {
  if (!db) db = openOrderDatabase();
  return db;
}

export function useDatabase(connection) {
  db = connection;
}

/**
 * A reference a customer can read aloud on WhatsApp and an outsider cannot
 * guess. The random half is what protects the order-status URL, which needs no
 * password: 8 characters of a 32-letter alphabet is 2^40 combinations, and the
 * status route is rate limited.
 */
export function newOrderId(now = new Date()) {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, "");
  const bytes = randomBytes(8);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `WEB-${stamp}-${suffix}`;
}

function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    currency: row.currency,
    items: JSON.parse(row.items_json),
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    deliveryAddress: row.delivery_address,
    customerNote: row.customer_note,
    paymentProvider: row.payment_provider,
    paymentLabel: row.payment_label,
    paymentReference: row.payment_reference,
    paymentDetail: row.payment_detail_json ? JSON.parse(row.payment_detail_json) : null,
    posReference: row.pos_reference,
    posOrderNo: row.pos_order_no,
    posError: row.pos_error,
    posAttempts: row.pos_attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    recordedAt: row.recorded_at
  };
}

export function recordEvent(orderId, event, detail = null) {
  getDatabase()
    .prepare("INSERT INTO storefront_order_events (order_id, event, detail) VALUES (?, ?, ?)")
    .run(orderId, event, detail === null ? null : String(detail).slice(0, 500));
}

export function createOrder(order) {
  const connection = getDatabase();
  connection
    .prepare(`
      INSERT INTO storefront_orders (
        id, status, currency, items_json, subtotal_cents, shipping_cents, total_cents,
        customer_name, customer_phone, customer_email, delivery_address, customer_note,
        payment_provider, payment_label, payment_reference, payment_detail_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      order.id,
      order.status,
      order.currency,
      JSON.stringify(order.items),
      order.subtotalCents,
      order.shippingCents,
      order.totalCents,
      order.customerName,
      order.customerPhone,
      order.customerEmail || null,
      order.deliveryAddress || null,
      order.customerNote || null,
      order.paymentProvider,
      order.paymentLabel || null,
      order.paymentReference || null,
      order.paymentDetail ? JSON.stringify(order.paymentDetail) : null
    );
  recordEvent(order.id, "created", `${order.items.length} line(s), ${order.totalCents} cents`);
  return getOrder(order.id);
}

export function getOrder(id) {
  return rowToOrder(getDatabase().prepare("SELECT * FROM storefront_orders WHERE id = ?").get(String(id || "")));
}

/** Looks an order up by what the payment gateway calls it. */
export function getOrderByPaymentReference(reference) {
  const clean = String(reference || "").trim();
  if (!clean) return null;
  return rowToOrder(
    getDatabase().prepare("SELECT * FROM storefront_orders WHERE payment_reference = ? ORDER BY created_at DESC").get(clean)
  );
}

export function listOrders({ status = "", limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = status
    ? getDatabase().prepare("SELECT * FROM storefront_orders WHERE status = ? ORDER BY created_at DESC LIMIT ?").all(status, capped)
    : getDatabase().prepare("SELECT * FROM storefront_orders ORDER BY created_at DESC LIMIT ?").all(capped);
  return rows.map(rowToOrder);
}

export function listOrderEvents(orderId) {
  return getDatabase()
    .prepare("SELECT event, detail, created_at AS createdAt FROM storefront_order_events WHERE order_id = ? ORDER BY id")
    .all(String(orderId || ""));
}

export function setPaymentReference(id, reference, detail = null) {
  getDatabase()
    .prepare("UPDATE storefront_orders SET payment_reference = ?, payment_detail_json = ?, updated_at = datetime('now') WHERE id = ?")
    .run(reference || null, detail ? JSON.stringify(detail) : null, id);
}

/**
 * Marks an order paid, once.
 *
 * A payment gateway retries its callback until it gets a 200, so this is the
 * gate that keeps the second and third delivery from re-running everything the
 * first one did. It returns false when the order was already past
 * awaiting_payment, and the caller stops there.
 */
export function markPaid(id, { paymentReference = null, paymentLabel = null, detail = null } = {}) {
  const result = getDatabase()
    .prepare(`
      UPDATE storefront_orders
      SET status = ?, paid_at = datetime('now'), updated_at = datetime('now'),
          payment_reference = COALESCE(?, payment_reference),
          payment_label = COALESCE(?, payment_label),
          payment_detail_json = COALESCE(?, payment_detail_json)
      WHERE id = ? AND status = ?
    `)
    .run(ORDER_STATUS.paid, paymentReference, paymentLabel, detail ? JSON.stringify(detail) : null, id, ORDER_STATUS.awaitingPayment);

  const changed = Number(result.changes) > 0;
  if (changed) recordEvent(id, "paid", paymentReference);
  return changed;
}

export function markRecorded(id, { posReference, posOrderNo }) {
  getDatabase()
    .prepare(`
      UPDATE storefront_orders
      SET status = ?, pos_reference = ?, pos_order_no = ?, pos_error = NULL,
          recorded_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `)
    .run(ORDER_STATUS.recorded, posReference || null, posOrderNo || null, id);
  recordEvent(id, "recorded_in_pos", posOrderNo || posReference);
}

export function markPosFailed(id, message) {
  getDatabase()
    .prepare(`
      UPDATE storefront_orders
      SET status = ?, pos_error = ?, pos_attempts = pos_attempts + 1, updated_at = datetime('now')
      WHERE id = ?
    `)
    .run(ORDER_STATUS.posFailed, String(message || "").slice(0, 500), id);
  recordEvent(id, "pos_push_failed", message);
}

export function cancelOrder(id, reason = "") {
  const result = getDatabase()
    .prepare("UPDATE storefront_orders SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?")
    .run(ORDER_STATUS.cancelled, id, ORDER_STATUS.awaitingPayment);
  if (Number(result.changes) > 0) recordEvent(id, "cancelled", reason);
  return Number(result.changes) > 0;
}

/**
 * Closes orders nobody paid for.
 *
 * Nothing is reserved while an order waits for payment, so an abandoned one
 * holds no stock; expiring it only keeps the shop's order list honest.
 */
export function expireUnpaidOrders(minutes = config.orders.unpaidExpiryMinutes) {
  const result = getDatabase()
    .prepare(`
      UPDATE storefront_orders
      SET status = ?, updated_at = datetime('now')
      WHERE status = ? AND created_at < datetime('now', ?)
    `)
    .run(ORDER_STATUS.expired, ORDER_STATUS.awaitingPayment, `-${Math.max(Number(minutes) || 60, 1)} minutes`);
  return Number(result.changes);
}

/** Paid orders the POS has not accepted yet, oldest first. */
export function listOrdersNeedingPosPush(limit = 20) {
  return getDatabase()
    .prepare(`
      SELECT * FROM storefront_orders
      WHERE status IN (?, ?)
      ORDER BY paid_at
      LIMIT ?
    `)
    .all(ORDER_STATUS.paid, ORDER_STATUS.posFailed, Math.min(Math.max(Number(limit) || 20, 1), 100))
    .map(rowToOrder);
}
