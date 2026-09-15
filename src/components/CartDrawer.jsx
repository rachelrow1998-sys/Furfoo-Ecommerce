import { Minus, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../store/CartContext'
import { WHATSAPP_NUMBER } from '../data/products'
import { formatPrice } from '../utils/currency'
import { pausePageScroll, resumePageScroll } from '../utils/smoothScroll'
import Button from './Button'

/** The order lands in WhatsApp already itemised, so nothing is retyped by hand. */
function checkoutLink(items, total) {
  const lines = items.map(item => `• ${item.qty} × ${item.name} (${item.size}) — ${formatPrice(item.price * item.qty)}`)
  const message = [
    'Hi FURFOO! I would like to order:',
    '',
    ...lines,
    '',
    `Subtotal: ${formatPrice(total)}`,
  ].join('\n')
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export default function CartDrawer() {
  const { items, open, setOpen, update, remove, clear, count, total, freeShippingThreshold, hasFreeShipping, amountToFreeShipping } = useCart()
  const closeRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previousFocus.current = document.activeElement
    const onKeyDown = event => { if (event.key === 'Escape') setOpen(false) }
    document.body.style.overflow = 'hidden'
    pausePageScroll()
    window.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = ''
      resumePageScroll()
      window.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus?.()
    }
  }, [open, setOpen])

  const progress = Math.min(100, Math.round((total / freeShippingThreshold) * 100))

  return <>
    <div className={`cart-scrim ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)}/>
    <aside className={`cart-drawer ${open ? 'is-open' : ''}`} aria-label="Shopping bag" aria-hidden={!open} inert={!open}>
      <div className="cart-head">
        <div>
          <span className="eyebrow">YOUR BAG</span>
          <h2>Good picks.</h2>
          <small>{count ? `${count} item${count > 1 ? 's' : ''} ready to go` : 'Nothing in here yet'}</small>
        </div>
        <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close cart" ref={closeRef}><X/></button>
      </div>

      {!!items.length && <div className="cart-shipping">
        <p>
          <Truck aria-hidden="true"/>
          {hasFreeShipping
            ? <span><strong>Free shipping unlocked.</strong> Nice one.</span>
            : <span>Add <strong>{formatPrice(amountToFreeShipping)}</strong> more for free shipping.</span>}
        </p>
        <span className="cart-shipping-track"><span className="cart-shipping-fill" style={{ width: `${progress}%` }}/></span>
      </div>}

      <div className="cart-items" data-lenis-prevent>
        {!items.length && <div className="empty-cart">
          <ShoppingBag/>
          <p>Hachi is waiting for your first pick.</p>
          <Button to="/shop" onClick={() => setOpen(false)}>Explore the shop</Button>
        </div>}

        {items.map(item => <article className="cart-item" key={item.id}>
          <Link to={`/products/${item.id}`} onClick={() => setOpen(false)}><img src={item.image} alt={item.name} loading="lazy"/></Link>
          <div>
            <Link to={`/products/${item.id}`} onClick={() => setOpen(false)}><strong>{item.name}</strong></Link>
            <small>{item.category} · {item.size}</small>
            <div className="cart-item-row">
              <div className="quantity">
                <button onClick={() => update(item.id, item.qty - 1)} disabled={item.qty <= 1} aria-label={`Decrease ${item.name} quantity`}><Minus size={14}/></button>
                <span aria-label={`${item.name} quantity`}>{item.qty}</span>
                <button onClick={() => update(item.id, item.qty + 1)} aria-label={`Increase ${item.name} quantity`}><Plus size={14}/></button>
              </div>
              <strong className="cart-item-total">{formatPrice(item.price * item.qty)}</strong>
            </div>
          </div>
          <button className="cart-item-remove" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={16}/></button>
        </article>)}

        {!!items.length && <button className="cart-clear" onClick={clear}>Clear the bag</button>}
      </div>

      {!!items.length && <div className="cart-foot">
        <div className="cart-line"><span>Subtotal</span><strong>{formatPrice(total)}</strong></div>
        <div className="cart-line cart-line--muted">
          <span>Shipping</span>
          <span>{hasFreeShipping ? 'Free' : 'Confirmed on checkout'}</span>
        </div>
        <Button href={checkoutLink(items, total)} target="_blank" rel="noopener noreferrer">Checkout via WhatsApp</Button>
        <button className="cart-continue" onClick={() => setOpen(false)}>Keep shopping</button>
        <small>Your picks are sent to us on WhatsApp — online payment can be connected later.</small>
      </div>}
    </aside>
  </>
}
