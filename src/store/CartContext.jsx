import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { FREE_SHIPPING_THRESHOLD, findProduct } from '../data/products'

const CartContext = createContext(null)
const STORAGE_KEY = 'furfoo-cart-v1'
const MAX_QTY = 99

/**
 * The bag survives a refresh, but only as `{ id, qty }` pairs: prices, names and
 * photos are always re-read from the catalogue, so an edit to products.js can
 * never be overridden by a stale copy sitting in someone's browser.
 */
function readStoredCart() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return stored
      .map(({ id, qty }) => {
        const product = findProduct(id)
        return product ? { ...product, qty: Math.min(MAX_QTY, Math.max(1, Math.round(Number(qty) || 1))) } : null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(({ id, qty }) => ({ id, qty }))))
    } catch {
      // A private window with storage blocked still gets a working session cart.
    }
  }, [items])

  const add = useCallback((product, qty = 1) => {
    setItems(current => {
      const found = current.find(item => item.id === product.id)
      return found
        ? current.map(item => item.id === product.id ? { ...item, qty: Math.min(MAX_QTY, item.qty + qty) } : item)
        : [...current, { ...product, qty: Math.min(MAX_QTY, qty) }]
    })
    setOpen(true)
  }, [])

  const update = useCallback((id, qty) => setItems(current => current.map(item =>
    item.id === id ? { ...item, qty: Math.min(MAX_QTY, Math.max(1, qty)) } : item,
  )), [])

  const remove = useCallback(id => setItems(current => current.filter(item => item.id !== id)), [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0)
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    return {
      items,
      open,
      setOpen,
      add,
      update,
      remove,
      clear,
      count,
      total,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      hasFreeShipping: total >= FREE_SHIPPING_THRESHOLD,
      amountToFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - total),
    }
  }, [items, open, add, update, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
