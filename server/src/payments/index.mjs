/**
 * Payment providers.
 *
 * A provider turns an order into something the customer can pay - a redirect,
 * or bank details - and, if it is automatic, confirms the payment afterwards
 * from its own API. Everything downstream of "this order is paid" is the same
 * whichever provider is configured, which is what lets the shop start on bank
 * transfers and move to a gateway without touching the checkout flow.
 */

import { config } from "./../config.mjs";
import { manualProvider } from "./manual.mjs";
import { toyyibpayProvider } from "./toyyibpay.mjs";

const providers = new Map([
  [manualProvider.id, manualProvider],
  [toyyibpayProvider.id, toyyibpayProvider]
]);

export function getPaymentProvider(id = config.payments.provider) {
  const provider = providers.get(String(id || "").toLowerCase());
  if (!provider) throw new Error(`Unknown payment provider "${id}".`);
  return provider;
}

export function paymentProviderSummary() {
  const provider = getPaymentProvider();
  return { id: provider.id, label: provider.label, automatic: Boolean(provider.automatic) };
}
