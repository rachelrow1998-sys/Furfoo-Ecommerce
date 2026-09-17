/**
 * Bank transfer / WhatsApp payment.
 *
 * The order is placed, the customer is told how to pay, and the shop confirms
 * the transfer. Confirming is an explicit action - POST /api/storefront/admin/
 * orders/:id/mark-paid, or the Orders screen in the shop's own tooling - and
 * that confirmation is what pushes the order into the POS and deducts stock.
 *
 * This is the default provider so the shop can sell before a payment gateway
 * account exists. Nothing about the rest of the flow changes when one does.
 */

import { config } from "./../config.mjs";

export const manualProvider = {
  id: "manual",
  label: "Bank transfer",
  /** The shop confirms this payment by hand; no gateway calls back. */
  automatic: false,

  async startPayment(order) {
    const lines = [];
    if (config.payments.manual.instructions) lines.push(config.payments.manual.instructions);
    lines.push(`Payment reference: ${order.id}`);
    if (config.payments.manual.whatsappNumber) {
      lines.push(`Send your transfer receipt on WhatsApp to ${config.payments.manual.whatsappNumber}.`);
    }

    return {
      reference: order.id,
      redirectUrl: null,
      instructions: lines.join("\n"),
      whatsappNumber: config.payments.manual.whatsappNumber || null,
      detail: { provider: "manual" }
    };
  }
};
