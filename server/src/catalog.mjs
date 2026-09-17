/**
 * The POS product list, shaped for the shop.
 *
 * The POS holds one row per SKU with price, stock, status and photo. The shop
 * needs the same rows minus anything a customer should not see: hidden or
 * inactive products, internal SKUs, and (already stripped by the POS for a
 * non-admin role) cost and wholesale prices.
 *
 * Reads are cached for POS_CATALOG_TTL_MS so browsing the shop does not hit the
 * POS once per page view. Checkout never uses the cache: it re-reads stock from
 * the POS before taking any money.
 */

import { config } from "./config.mjs";
import { fetchPosProducts, PosError } from "./pos-client.mjs";

let cache = { products: null, fetchedAt: 0 };

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function categoryLabel(category) {
  const clean = String(category || "").trim();
  if (!clean) return "";
  return clean
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * The POS stores an uploaded photo as `/uploads/products/<file>`, which it
 * serves publicly, and a marketplace photo as an absolute URL. Both become
 * something the browser can load directly, so product images never pass
 * through this service.
 */
function imageUrl(value) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean;
  if (clean.startsWith("/")) return `${config.pos.baseUrl}${clean}`;
  return null;
}

function isPublished(product) {
  const sku = String(product.sku || "").toUpperCase();
  if (!sku) return false;
  if (config.catalog.skuBlocklist.has(sku)) return false;
  if (config.catalog.skuPrefixes.length && !config.catalog.skuPrefixes.some((prefix) => sku.startsWith(prefix))) return false;

  const status = String(product.productStatus || "active").toLowerCase();
  if (config.catalog.publishedStatuses.size && !config.catalog.publishedStatuses.has(status)) return false;

  if (config.catalog.hideZeroPrice && Number(product.priceCents || 0) <= 0) return false;
  return true;
}

function toStorefrontProduct(product) {
  const priceCents = Number(product.priceCents || 0);
  const stockQty = Math.max(Number(product.stockQty || 0), 0);
  const lowStockThreshold = Number(product.lowStockThreshold || 0);
  return {
    sku: String(product.sku),
    slug: slugify(product.name) || slugify(product.sku),
    name: String(product.name || product.sku),
    category: String(product.category || ""),
    categoryLabel: categoryLabel(product.category),
    priceCents,
    price: Number((priceCents / 100).toFixed(2)),
    currency: config.payments.currency,
    image: imageUrl(product.imageUrl),
    thumbnail: imageUrl(product.thumbnailUrl) || imageUrl(product.imageUrl),
    stockQty,
    inStock: stockQty > 0,
    lowStock: stockQty > 0 && lowStockThreshold > 0 && stockQty <= lowStockThreshold,
    isBundle: Boolean(Number(product.isBundle || 0)),
    notes: String(product.notes || "")
  };
}

/** Fresh from the POS, filtered and mapped. Bypasses the cache entirely. */
export async function loadCatalog() {
  const posProducts = await fetchPosProducts();
  const products = posProducts.filter(isPublished).map(toStorefrontProduct);
  products.sort((left, right) => left.name.localeCompare(right.name));
  cache = { products, fetchedAt: Date.now() };
  return products;
}

/**
 * The catalogue for a page view.
 *
 * If the POS is unreachable and a previous list is in memory, that list is
 * served and marked stale rather than showing an empty shop. Stock in a stale
 * list may be out of date, which is acceptable for browsing and never used for
 * a sale.
 */
export async function getCatalog({ force = false } = {}) {
  const age = Date.now() - cache.fetchedAt;
  if (!force && cache.products && age < config.pos.catalogTtlMs) {
    return { products: cache.products, stale: false, fetchedAt: cache.fetchedAt };
  }

  try {
    const products = await loadCatalog();
    return { products, stale: false, fetchedAt: cache.fetchedAt };
  } catch (error) {
    if (cache.products) {
      console.warn(`[catalog] serving a cached catalogue: ${error.message}`);
      return { products: cache.products, stale: true, fetchedAt: cache.fetchedAt, error: error.message };
    }
    throw error instanceof PosError ? error : new PosError(error.message, { code: "catalog_unavailable" });
  }
}

/** SKU → product, read fresh from the POS. Used to price and stock-check a cart. */
export async function getLiveProductMap() {
  const products = await loadCatalog();
  return new Map(products.map((product) => [product.sku, product]));
}

export function resetCatalogCache() {
  cache = { products: null, fetchedAt: 0 };
}
