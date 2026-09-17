import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../store/CartContext'
import { useCatalog } from '../store/CatalogContext'
import { centsToPrice, onImageError } from '../lib/catalog'
import { WHATSAPP_NUMBER, isStorefrontApiConfigured } from '../config/storefront'
import Button from './Button'

export default function CartDrawer() {
  const { items, open, setOpen, update, remove, totalCents, notice, dismissNotice } = useCart()
  const { settings } = useCatalog()
  const navigate = useNavigate()

  const currency = settings.currency
  const freeOverCents = settings.shipping?.freeOverCents || 0
  const shortOfFreeShipping = freeOverCents > 0 && totalCents > 0 && totalCents < freeOverCents

  const whatsappMessage = encodeURIComponent(
    `Hi Furfoo, I would like to order:\n${items.map(item => `${item.qty} x ${item.name}`).join('\n')}`
  )

  const startCheckout = () => {
    setOpen(false)
    navigate('/checkout')
  }

  return <><div className={`cart-scrim ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)}/><aside className={`cart-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
    <div className="cart-head">
      <div><span className="eyebrow">YOUR BAG</span><h2>Good picks.</h2></div>
      <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close cart"><X/></button>
    </div>

    {notice && <p className="cart-notice" role="status">{notice} <button type="button" onClick={dismissNotice} aria-label="Dismiss">×</button></p>}

    <div className="cart-items" data-lenis-prevent>
      {!items.length && <div className="empty-cart"><ShoppingBag/><p>Hachi is waiting for your first pick.</p><Button to="/shop" onClick={() => setOpen(false)}>Explore treats</Button></div>}
      {items.map(item => {
        const atStockLimit = typeof item.stockQty === 'number' && item.qty >= item.stockQty
        return <article className="cart-item" key={item.key}>
          <img src={item.image} alt="" onError={onImageError}/>
          <div>
            <strong>{item.name}</strong>
            <small>{centsToPrice(item.priceCents, currency)}</small>
            <div className="quantity">
              <button onClick={() => update(item.key, item.qty - 1)} disabled={item.qty <= 1} aria-label={`One fewer ${item.name}`}><Minus size={14}/></button>
              <span>{item.qty}</span>
              <button onClick={() => update(item.key, item.qty + 1)} disabled={atStockLimit} aria-label={`One more ${item.name}`}><Plus size={14}/></button>
            </div>
            {atStockLimit && <small className="cart-stock-note">All {item.stockQty} in stock</small>}
          </div>
          <button className="remove" onClick={() => remove(item.key)}>Remove</button>
        </article>
      })}
    </div>

    {!!items.length && <div className="cart-foot">
      <div><span>Subtotal</span><strong>{centsToPrice(totalCents, currency)}</strong></div>
      {shortOfFreeShipping && <small className="cart-shipping-note">
        {centsToPrice(freeOverCents - totalCents, currency)} more for free delivery.
      </small>}
      {isStorefrontApiConfigured
        ? <Button onClick={startCheckout}>Checkout</Button>
        : <Button href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`} target="_blank" rel="noreferrer">Checkout via WhatsApp</Button>}
      <small>{isStorefrontApiConfigured ? 'Delivery is added at checkout.' : 'Online payment is not connected yet.'}</small>
    </div>}
  </aside></>
}
