import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { useCart } from '../store/CartContext'
import { useCatalog } from '../store/CatalogContext'
import { centsToPrice, onImageError } from '../lib/catalog'
import { createCheckout, fetchQuote } from '../lib/storefrontApi'
import { isStorefrontApiConfigured } from '../config/storefront'
import Button from '../components/Button'
import Footer from '../components/Footer'

/**
 * Checkout.
 *
 * The totals shown here are the server's, not the browser's: the bag is priced
 * against live POS stock when the page opens and again when the order is
 * placed. That is also where a product that sold out at the counter while the
 * customer was typing gets caught.
 */

const EMPTY_FORM = { customerName: '', customerPhone: '', customerEmail: '', deliveryAddress: '', customerNote: '' }

export default function Checkout() {
  const { items, totalCents, clear } = useCart()
  const { settings, refresh: refreshCatalog } = useCatalog()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY_FORM)
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const cartLines = useMemo(() => items.map(item => ({ sku: item.sku || item.id, qty: item.qty })), [items])

  const loadQuote = useCallback(async signal => {
    if (!items.length || !isStorefrontApiConfigured) return
    try {
      const payload = await fetchQuote(cartLines, { signal })
      setQuote(payload.quote)
      setQuoteError(null)
    } catch (failure) {
      if (failure.name === 'AbortError') return
      setQuote(null)
      setQuoteError(failure)
    }
  }, [cartLines, items.length])

  useEffect(() => {
    const controller = new AbortController()
    loadQuote(controller.signal)
    return () => controller.abort()
  }, [loadQuote])

  const onChange = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async event => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const result = await createCheckout({ ...form, items: cartLines })
      clear()
      if (result.payment.redirectUrl) {
        window.location.assign(result.payment.redirectUrl)
        return
      }
      navigate(`/order/${result.order.id}`, { state: { payment: result.payment } })
    } catch (failure) {
      setError(failure)
      // A rejected cart is usually a stock change; pull the fresh numbers in so
      // the bag and the shelf agree before the customer tries again.
      if (failure.code === 'items_unavailable') {
        refreshCatalog?.()
      }
      setSubmitting(false)
    }
  }

  if (!items.length) {
    return <><main className="checkout-page">
      <Link to="/shop" className="back-link"><ArrowLeft/> Back to shop</Link>
      <div className="checkout-empty"><h1>Your bag is empty.</h1><Button to="/shop">Find a treat</Button></div>
    </main><Footer/></>
  }

  const shippingCents = quote ? quote.shippingCents : null
  const grandTotalCents = quote ? quote.totalCents : totalCents
  const currency = settings.currency
  const unavailable = error?.code === 'items_unavailable' ? error.details?.items || [] : []

  return <><main className="checkout-page">
    <Link to="/shop" className="back-link"><ArrowLeft/> Back to shop</Link>
    <header className="checkout-head">
      <span className="eyebrow">CHECKOUT</span>
      <h1>Where should Hachi send it?</h1>
    </header>

    <div className="checkout-grid">
      <form className="checkout-form" onSubmit={submit}>
        <label>
          <span>Name</span>
          <input name="customerName" value={form.customerName} onChange={onChange} required maxLength={80} autoComplete="name"/>
        </label>
        <label>
          <span>Phone (WhatsApp)</span>
          <input name="customerPhone" value={form.customerPhone} onChange={onChange} required maxLength={32} inputMode="tel" autoComplete="tel"/>
        </label>
        <label>
          <span>Email <em>optional</em></span>
          <input name="customerEmail" type="email" value={form.customerEmail} onChange={onChange} maxLength={120} autoComplete="email"/>
        </label>
        <label>
          <span>Delivery address</span>
          <textarea name="deliveryAddress" value={form.deliveryAddress} onChange={onChange} required rows={4} maxLength={400} autoComplete="street-address"/>
        </label>
        <label>
          <span>Note for the shop <em>optional</em></span>
          <textarea name="customerNote" value={form.customerNote} onChange={onChange} rows={2} maxLength={300}/>
        </label>

        {error && <div className="checkout-error" role="alert">
          <strong>{error.message}</strong>
          {!!unavailable.length && <ul>{unavailable.map(item => <li key={item.sku}>
            {item.name || item.sku}: {item.reason === 'sold_out' ? 'sold out' : item.reason === 'not_sold' ? 'no longer on the shop' : `only ${item.available} left`}
          </li>)}</ul>}
        </div>}

        <Button className="full" type="submit" disabled={submitting || Boolean(quoteError)}>
          {submitting ? <><Loader2 className="spin"/> Placing your order…</> : `Place order · ${centsToPrice(grandTotalCents, currency)}`}
        </Button>
        <p className="safe-note"><ShieldCheck/> {settings.payment?.automatic
          ? 'You will be taken to the payment page. Stock is deducted at the shop once payment clears.'
          : 'The shop confirms your transfer, then packs the order and deducts it from the counter stock.'}</p>
      </form>

      <aside className="checkout-summary">
        <h2>Your bag</h2>
        {items.map(item => <div className="checkout-line" key={item.key}>
          <img src={item.image} alt="" onError={onImageError}/>
          <div><strong>{item.name}</strong><small>{item.qty} × {centsToPrice(item.priceCents, currency)}</small></div>
          <span>{centsToPrice(item.priceCents * item.qty, currency)}</span>
        </div>)}

        <dl className="checkout-totals">
          <div><dt>Subtotal</dt><dd>{centsToPrice(quote ? quote.subtotalCents : totalCents, currency)}</dd></div>
          <div><dt>Delivery</dt><dd>{shippingCents === null ? '—' : shippingCents === 0 ? 'Free' : centsToPrice(shippingCents, currency)}</dd></div>
          <div className="checkout-grand"><dt>Total</dt><dd>{centsToPrice(grandTotalCents, currency)}</dd></div>
        </dl>

        {quoteError && <p className="checkout-error" role="alert">
          {quoteError.code === 'items_unavailable'
            ? 'Something in your bag just sold out. Open the bag to adjust it.'
            : 'The shop counter is not answering right now, so the total cannot be confirmed. Please try again shortly.'}
        </p>}
      </aside>
    </div>
  </main><Footer/></>
}
