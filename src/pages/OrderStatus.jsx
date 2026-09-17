import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, Loader2, PackageCheck } from 'lucide-react'
import { fetchOrder } from '../lib/storefrontApi'
import { FALLBACK_IMAGE, centsToPrice, onImageError } from '../lib/catalog'
import { WHATSAPP_NUMBER } from '../config/storefront'
import Button from '../components/Button'
import Footer from '../components/Footer'

/**
 * The page a customer lands on after placing an order, and the page a payment
 * gateway returns them to.
 *
 * A gateway confirms payment through a server callback, not through the
 * customer's browser, so an order can still read "awaiting payment" for a few
 * seconds after a successful payment. The page polls for a short while rather
 * than claiming either outcome too early.
 */

const POLL_INTERVAL_MS = 4000
const POLL_ATTEMPTS = 15

const STATUS_COPY = {
  awaiting_payment: { icon: Clock, title: 'Waiting for payment', tone: 'pending' },
  paid: { icon: CheckCircle2, title: 'Payment received', tone: 'good' },
  recorded: { icon: PackageCheck, title: 'Order confirmed', tone: 'good' },
  expired: { icon: Clock, title: 'Order expired', tone: 'ended' },
  cancelled: { icon: Clock, title: 'Order cancelled', tone: 'ended' },
}

export default function OrderStatus() {
  const { id } = useParams()
  const location = useLocation()
  const payment = location.state?.payment || null

  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let attempts = 0
    let timer = null
    const controller = new AbortController()

    const poll = async () => {
      try {
        const payload = await fetchOrder(id, { signal: controller.signal })
        setOrder(payload.order)
        setError(null)
        attempts += 1
        // Only an unpaid order is worth watching; anything else is settled.
        if (payload.order.customerStatus === 'awaiting_payment' && attempts < POLL_ATTEMPTS) {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (failure) {
        if (failure.name === 'AbortError') return
        setError(failure)
      } finally {
        setLoading(false)
      }
    }

    poll()
    return () => {
      controller.abort()
      if (timer) window.clearTimeout(timer)
    }
  }, [id])

  if (loading) return <main className="order-page" aria-busy="true"><Loader2 className="spin"/><p>Looking up your order…</p></main>

  if (error || !order) {
    return <><main className="order-page">
      <h1>We could not find that order.</h1>
      <p>Reference <code>{id}</code>. If you have just paid, message the shop and we will check it for you.</p>
      <Button href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Furfoo, about order ${id}`)}`} target="_blank" rel="noreferrer">Message the shop</Button>
    </main><Footer/></>
  }

  const status = STATUS_COPY[order.customerStatus] || STATUS_COPY.awaiting_payment
  const StatusIcon = status.icon
  const awaiting = order.customerStatus === 'awaiting_payment'

  return <><main className="order-page">
    <div className={`order-status order-status--${status.tone}`}><StatusIcon/><h1>{status.title}</h1></div>
    <p className="order-reference">Order reference <strong>{order.id}</strong></p>

    {awaiting && payment?.instructions && <section className="order-instructions">
      <h2>How to pay</h2>
      <p>{payment.instructions}</p>
      {payment.whatsappNumber && <Button
        href={`https://wa.me/${payment.whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Hi Furfoo, here is my payment for ${order.id}`)}`}
        target="_blank"
        rel="noreferrer"
      >Send the receipt on WhatsApp</Button>}
    </section>}

    {awaiting && !payment?.instructions && <p className="order-note">
      If you have just paid, this page updates itself within a minute.
    </p>}

    {!awaiting && <p className="order-note">Thank you. The shop is packing your order and will message you on WhatsApp with the delivery details.</p>}

    <section className="order-lines">
      {order.items.map(item => <div className="order-line" key={item.sku}>
        <img src={item.image || FALLBACK_IMAGE} alt="" onError={onImageError}/>
        <div><strong>{item.name}</strong><small>{item.qty} × {centsToPrice(item.unitPriceCents, order.currency)}</small></div>
        <span>{centsToPrice(item.lineTotalCents, order.currency)}</span>
      </div>)}
      <dl className="checkout-totals">
        <div><dt>Subtotal</dt><dd>{centsToPrice(order.subtotalCents, order.currency)}</dd></div>
        <div><dt>Delivery</dt><dd>{order.shippingCents ? centsToPrice(order.shippingCents, order.currency) : 'Free'}</dd></div>
        <div className="checkout-grand"><dt>Total</dt><dd>{centsToPrice(order.totalCents, order.currency)}</dd></div>
      </dl>
    </section>

    <Link className="back-link" to="/shop">Keep shopping</Link>
  </main><Footer/></>
}
