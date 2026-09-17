/**
 * Where the shop reads its products and sends its orders.
 *
 * The site is a static build, so it holds no POS credentials and talks to no
 * POS directly. VITE_STOREFRONT_API points at the storefront service in
 * `server/`, which is the only thing that signs in to the POS.
 *
 * Left unset, the site still builds and runs: it falls back to the catalogue
 * written into src/data/products.js and keeps the WhatsApp handoff.
 */

const configured = String(import.meta.env.VITE_STOREFRONT_API || '').trim().replace(/\/$/, '')

export const STOREFRONT_API = configured
export const isStorefrontApiConfigured = Boolean(configured)

/** Shown while the API has not answered yet, and in fallback mode. */
export const DEFAULT_SHOP_SETTINGS = {
  currency: 'MYR',
  shipping: { flatCents: 800, freeOverCents: 10000 },
  payment: { id: 'whatsapp', label: 'WhatsApp', automatic: false },
  maxItemQty: 20,
}

export const WHATSAPP_NUMBER = '60199123946'
