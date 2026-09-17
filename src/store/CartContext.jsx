import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { cartKeyFor, findProduct } from '../lib/catalog'
import { useCatalog } from './CatalogContext'

/**
 * The bag.
 *
 * Quantities are capped by the stock the POS reports, so a customer is not
 * invited to buy four of something the shop has one of. The cap is a courtesy,
 * not a guarantee: stock can sell at the counter while the bag sits open, which
 * is why the server prices and re-checks the whole cart at checkout.
 *
 * The bag survives a reload because paying through a gateway leaves the site
 * and comes back.
 */

const CartContext = createContext(null)
const STORAGE_KEY = 'furfoo.cart.v1'

function readStoredItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(item => item?.key && item?.qty > 0) : []
  } catch {
    return []
  }
}

function availableFor(product) {
  return typeof product?.stockQty === 'number' ? product.stockQty : Infinity
}

export function CartProvider({ children }) {
  const catalog = useCatalog()
  const [items, setItems] = useState(readStoredItems)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // A browser with storage blocked keeps a working, session-only bag.
    }
  }, [items])

  /* Every catalogue refresh is a chance to find the bag out of date: something
     sold out at the counter, or was taken off the shop. Fixing it here means
     the customer sees it in the bag rather than at checkout. */
  useEffect(() => {
    if (catalog.status !== 'ready' || !catalog.isLive || catalog.stale || !catalog.products.length) return
    setItems(current => {
      let changed = false
      const messages = []
      const next = []

      for (const item of current) {
        const product = findProduct(catalog.products, item.sku || item.id)
        if (!product) {
          changed = true
          messages.push(`${item.name} is no longer on the shop.`)
          continue
        }
        const available = availableFor(product)
        const qty = Math.min(item.qty, available)
        if (qty <= 0) {
          changed = true
          messages.push(`${product.name} just sold out.`)
          continue
        }
        if (qty !== item.qty || product.priceCents !== item.priceCents || product.name !== item.name) {
          changed = true
          if (qty !== item.qty) messages.push(`Only ${qty} × ${product.name} left, so your bag was adjusted.`)
        }
        next.push({
          ...item,
          id: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          priceCents: product.priceCents,
          image: product.image,
          stockQty: product.stockQty,
          qty,
        })
      }

      if (!changed) return current
      setNotice(messages.join(' '))
      return next
    })
  }, [catalog.products, catalog.status, catalog.isLive, catalog.stale])

  const add = useCallback((product, qty = 1) => {
    const key = cartKeyFor(product)
    if (!key) return
    const available = availableFor(product)

    setItems(current => {
      const found = current.find(item => item.key === key)
      const wanted = (found?.qty || 0) + qty
      const allowed = Math.max(Math.min(wanted, available), 0)

      if (allowed <= 0) {
        setNotice(`${product.name} is sold out.`)
        return current
      }
      setNotice(allowed < wanted ? `Only ${allowed} × ${product.name} in stock.` : '')

      const line = {
        key,
        id: product.id,
        sku: product.sku || '',
        name: product.name,
        price: product.price,
        priceCents: product.priceCents ?? Math.round(Number(product.price || 0) * 100),
        image: product.image,
        stockQty: product.stockQty ?? null,
        qty: allowed,
      }
      return found ? current.map(item => (item.key === key ? line : item)) : [...current, line]
    })
    setOpen(true)
  }, [])

  const update = useCallback((key, qty) => {
    setItems(current => current.map(item => {
      if (item.key !== key) return item
      const available = typeof item.stockQty === 'number' ? item.stockQty : Infinity
      const next = Math.max(1, Math.min(qty, available))
      if (qty > available) setNotice(`Only ${available} × ${item.name} in stock.`)
      return { ...item, qty: next }
    }))
  }, [])

  const remove = useCallback(key => setItems(current => current.filter(item => item.key !== key)), [])
  const clear = useCallback(() => setItems([]), [])

  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0)

  const value = useMemo(() => ({
    items,
    open,
    setOpen,
    add,
    update,
    remove,
    clear,
    count,
    totalCents,
    total: totalCents / 100,
    notice,
    dismissNotice: () => setNotice(''),
  }), [items, open, add, update, remove, clear, count, totalCents, notice])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
