/**
 * toyyibPay (FPX / card, Malaysia).
 *
 * Checkout creates a bill and sends the customer to toyyibPay's page. When the
 * payment finishes, toyyibPay POSTs a callback to this service - and that
 * callback is treated as a hint, not as proof. Anyone can post to a public URL,
 * so the amount and status are always re-read from toyyibPay's own API with the
 * shop's secret key before an order is marked paid.
 *
 * Before taking live payments, run one sandbox bill end to end (dev.toyyibpay.
 * com) and check the callback reaches this service: the field names below are
 * toyyibPay's and are worth confirming against their current documentation.
 */

import { config } from "./../config.mjs";

const SUCCESS = "1";

function form(fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    body.set(key, String(value));
  }
  return body;
}

async function toyyibRequest(path, fields) {
  const response = await fetch(`${config.payments.toyyibpay.baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form(fields),
    signal: AbortSignal.timeout(15_000)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`toyyibPay answered ${response.status} for ${path}.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`toyyibPay returned an unreadable reply for ${path}: ${text.slice(0, 120)}`);
  }
}

export const toyyibpayProvider = {
  id: "toyyibpay",
  label: "toyyibPay",
  /** The gateway calls back, so payment is confirmed without the shop acting. */
  automatic: true,

  async startPayment(order) {
    const payload = await toyyibRequest("/index.php/api/createBill", {
      userSecretKey: config.payments.toyyibpay.secretKey,
      categoryCode: config.payments.toyyibpay.categoryCode,
      billName: `Furfoo ${order.id}`.slice(0, 30),
      billDescription: `Furfoo website order ${order.id}`.slice(0, 100),
      billPriceSetting: 1,
      billPayorInfo: 1,
      // Cents, which is what billPriceSetting=1 expects.
      billAmount: order.totalCents,
      billReturnUrl: `${config.publicSiteUrl}/order/${order.id}`,
      billCallbackUrl: `${config.publicApiUrl}/api/storefront/payments/toyyibpay/callback`,
      billExternalReferenceNo: order.id,
      billTo: order.customerName,
      billEmail: order.customerEmail || "",
      billPhone: order.customerPhone,
      billSplitPayment: 0,
      billPaymentChannel: 2,
      billChargeToCustomer: 1
    });

    const billCode = Array.isArray(payload) ? payload[0]?.BillCode : payload?.BillCode;
    if (!billCode) {
      throw new Error(`toyyibPay did not return a bill code: ${JSON.stringify(payload).slice(0, 160)}`);
    }

    return {
      reference: String(billCode),
      redirectUrl: `${config.payments.toyyibpay.baseUrl}/${billCode}`,
      instructions: null,
      detail: { provider: "toyyibpay", billCode: String(billCode) }
    };
  },

  /**
   * Reads a callback body and says which order it is about. It deliberately
   * does not decide whether the order was paid - `confirmPayment` does that
   * against toyyibPay's API.
   */
  readCallback(body) {
    return {
      orderId: String(body.order_id || body.billExternalReferenceNo || "").trim(),
      reference: String(body.billcode || body.billCode || "").trim(),
      claimedStatus: String(body.status || body.status_id || "").trim()
    };
  },

  /**
   * The authoritative check: ask toyyibPay what happened to this bill.
   *
   * Returns paid only when toyyibPay itself reports a successful payment for at
   * least the amount the order is for.
   */
  async confirmPayment({ reference, order }) {
    const payload = await toyyibRequest("/index.php/api/getBillTransactions", {
      userSecretKey: config.payments.toyyibpay.secretKey,
      billCode: reference
    });

    const transactions = Array.isArray(payload) ? payload : [];
    const successful = transactions.find((item) => String(item.billpaymentStatus) === SUCCESS);
    if (!successful) {
      return { paid: false, reason: "toyyibPay has no successful transaction for this bill.", detail: { transactions } };
    }

    // toyyibPay reports the paid amount in ringgit, e.g. "38.80".
    const paidCents = Math.round(Number(successful.billpaymentAmount || 0) * 100);
    if (paidCents < order.totalCents) {
      return {
        paid: false,
        reason: `toyyibPay reports ${paidCents} cents paid for an order of ${order.totalCents} cents.`,
        detail: { transactions }
      };
    }

    return {
      paid: true,
      reference,
      detail: {
        provider: "toyyibpay",
        billCode: reference,
        transactionId: successful.billpaymentInvoiceNo || successful.billpaymentTransactionId || null,
        paidCents
      }
    };
  }
};
