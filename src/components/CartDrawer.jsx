import { Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useCart } from '../store/CartContext'
import Button from './Button'

export default function CartDrawer() {
  const { items, open, setOpen, update, remove, total } = useCart()
  return <><div className={`cart-scrim ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)}/><aside className={`cart-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
    <div className="cart-head"><div><span className="eyebrow">YOUR BAG</span><h2>Good picks.</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close cart"><X/></button></div>
    <div className="cart-items">
      {!items.length && <div className="empty-cart"><ShoppingBag/><p>Hachi is waiting for your first pick.</p><Button to="/shop" onClick={() => setOpen(false)}>Explore treats</Button></div>}
      {items.map(item => <article className="cart-item" key={item.id}><img src={item.image} alt=""/><div><strong>{item.name}</strong><small>RM {item.price.toFixed(2)}</small><div className="quantity"><button onClick={() => update(item.id, item.qty - 1)}><Minus size={14}/></button><span>{item.qty}</span><button onClick={() => update(item.id, item.qty + 1)}><Plus size={14}/></button></div></div><button className="remove" onClick={() => remove(item.id)}>Remove</button></article>)}
    </div>
    {!!items.length && <div className="cart-foot"><div><span>Subtotal</span><strong>RM {total.toFixed(2)}</strong></div><Button href="https://wa.me/60199123946" target="_blank">Checkout via WhatsApp</Button><small>Secure online checkout can be connected later.</small></div>}
  </aside></>
}
