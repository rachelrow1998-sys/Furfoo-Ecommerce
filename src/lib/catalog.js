/**
 * Merges what the POS knows with what the shop writes.
 *
 * The POS owns price, stock, photo, name and category. This file adds the
 * editorial copy on top and nothing else, so a price change in the POS is a
 * price change on the site with no deploy.
 */

import { productEditorial } from '../data/products'

export const FALLBACK_IMAGE = '/media/products/all-in-one.jpg'
const FALLBACK_ACCENT = '#c89b6a'

/** Swaps a photo the POS can no longer serve for the local placeholder. */
export function onImageError(event) {
  const image = event.currentTarget
  if (image.dataset.fallbackApplied) return
  image.dataset.fallbackApplied = 'true'
  image.src = FALLBACK_IMAGE
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function editorialIndex(entries) {
  const bySku = new Map()
  const byId = new Map()
  const byName = new Map()
  for (const entry of entries) {
    if (entry.sku) bySku.set(String(entry.sku).toUpperCase(), entry)
    byId.set(entry.id, entry)
    byName.set(slugify(entry.name), entry)
  }
  return { bySku, byId, byName }
}

function findEditorial(index, product) {
  return (
    index.bySku.get(String(product.sku || '').toUpperCase()) ||
    index.byId.get(product.slug) ||
    index.byName.get(slugify(product.name)) ||
    null
  )
}

/**
 * A live POS product plus its editorial entry, in the shape the cards render.
 *
 * `id` is what the product URL uses: the editorial id when there is one, so
 * existing links keep working, and the POS slug otherwise.
 */
export function mergeCatalog(liveProducts, entries = productEditorial) {
  const index = editorialIndex(entries)
  return liveProducts.map(product => {
    const copy = findEditorial(index, product)
    return {
      id: copy?.id || product.slug || slugify(product.sku),
      sku: product.sku,
      name: product.name,
      price: product.price,
      priceCents: product.priceCents,
      currency: product.currency,
      image: product.image || copy?.image || FALLBACK_IMAGE,
      // The POS owns the category, so one shelf per POS category whatever the
      // editorial entry calls it. The entry's own category is for fallback mode.
      category: product.categoryLabel || copy?.category || 'Furfoo',
      note: copy?.note || `${product.name}, made in small batches by Furfoo.`,
      tags: copy?.tags || [],
      ingredients: copy?.ingredients || '',
      color: copy?.color || FALLBACK_ACCENT,
      stockQty: product.stockQty,
      inStock: product.inStock,
      lowStock: product.lowStock,
      isBundle: product.isBundle,
      live: true,
    }
  })
}

/** Cart lines and catalogue rows are matched on SKU once the POS is connected. */
export function cartKeyFor(product) {
  return product?.sku || product?.id || ''
}

export function findProduct(products, wanted) {
  const needle = String(wanted || '').toLowerCase()
  if (!needle) return null
  return (
    products.find(product => product.id?.toLowerCase() === needle) ||
    products.find(product => String(product.sku || '').toLowerCase() === needle) ||
    null
  )
}

/**
 * Groups the catalogue into the home page's reels.
 *
 * Categories come from the POS, so a new category there becomes a shelf here
 * without a code change. Four is what the layout holds.
 */
export function buildShelves(products, limit = 4) {
  const groups = new Map()
  for (const product of products) {
    const category = product.category || 'Furfoo'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category).push(product)
  }
  return [...groups.entries()]
    .map(([category, items]) => ({ category, products: items }))
    .sort((left, right) => right.products.length - left.products.length || left.category.localeCompare(right.category))
    .slice(0, limit)
}

export function formatPrice(value, currency = 'MYR') {
  const amount = Number(value || 0).toFixed(2)
  return currency === 'MYR' ? `RM ${amount}` : `${currency} ${amount}`
}

export function centsToPrice(cents, currency = 'MYR') {
  return formatPrice(Number(cents || 0) / 100, currency)
}
