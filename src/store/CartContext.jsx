import { createContext, useContext, useMemo, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const add = (product, qty = 1) => {
    setItems(current => {
      const found = current.find(item => item.id === product.id)
      return found
        ? current.map(item => item.id === product.id ? { ...item, qty: item.qty + qty } : item)
        : [...current, { ...product, qty }]
    })
    setOpen(true)
  }
  const update = (id, qty) => setItems(current => current.map(item => item.id === id ? { ...item, qty: Math.max(1, qty) } : item))
  const remove = id => setItems(current => current.filter(item => item.id !== id))
  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const value = useMemo(() => ({ items, open, setOpen, add, update, remove, count, total }), [items, open, count, total])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
