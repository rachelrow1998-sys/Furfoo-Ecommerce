import { ArrowLeft, Check, Minus, Plus, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useCatalog } from '../store/CatalogContext'
import { useCart } from '../store/CartContext'
import { findProduct, formatPrice, onImageError } from '../lib/catalog'
import Button from '../components/Button'
import Footer from '../components/Footer'

export default function ProductDetail() {
  const { id } = useParams()
  const { products, status } = useCatalog()
  const product = findProduct(products, id)
  const [qty, setQty] = useState(1)
  const { add } = useCart()

  const available = typeof product?.stockQty === 'number' ? product.stockQty : Infinity

  // Stock can drop between page loads; never leave a quantity the shop cannot fill.
  useEffect(() => {
    setQty(current => Math.max(1, Math.min(current, available === Infinity ? current : available)))
  }, [available])

  if (status === 'loading') return <main className="detail-page detail-page--loading" aria-busy="true"><p>Fetching the shelf…</p></main>
  if (!product) return <main className="not-found"><h1>That treat wandered off.</h1><Button to="/shop">Back to shop</Button></main>

  const soldOut = product.inStock === false

  return <><main className="detail-page">
    <Link to="/shop" className="back-link"><ArrowLeft/> Back to shop</Link>
    <div className="detail-grid">
      <div className="detail-visual" style={{ '--accent': product.color }}>
        <img src={product.image} alt={product.name} onError={onImageError}/>
        <span>{product.category}</span>
      </div>
      <div className="detail-copy">
        <span className="eyebrow">{product.category}</span>
        <h1>{product.name}</h1>
        <p className="detail-lead">{product.note}</p>
        {!!product.tags.length && <div className="detail-tags">{product.tags.map(tag => <span key={tag}><Check/> {tag}</span>)}</div>}
        {product.ingredients && <div className="ingredient"><small>Made with</small><strong>{product.ingredients}</strong></div>}
        <div className="buy-row">
          <strong>{formatPrice(product.price, product.currency)}</strong>
          <div className="quantity large">
            <button onClick={() => setQty(value => Math.max(1, value - 1))} disabled={soldOut} aria-label="One fewer"><Minus/></button>
            <span>{qty}</span>
            <button onClick={() => setQty(value => Math.min(available, value + 1))} disabled={soldOut || qty >= available} aria-label="One more"><Plus/></button>
          </div>
        </div>
        {typeof product.stockQty === 'number' && <p className={`stock-line stock-line--${soldOut ? 'out' : product.lowStock ? 'low' : 'in'}`}>
          {soldOut ? 'Sold out right now — Hachi can tell you when it is back.' : product.lowStock ? `Only ${product.stockQty} left in the shop.` : 'In stock and ready to post.'}
        </p>}
        <Button className="full" onClick={() => add(product, qty)} disabled={soldOut}>
          {soldOut ? 'Sold out' : `Add ${qty} to cart`}
        </Button>
        <p className="safe-note"><ShieldCheck/> Stock and prices come straight from the Furfoo counter.</p>
      </div>
    </div>
  </main><Footer/></>
}
