import { ArrowLeft, Check, Minus, Plus, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FREE_SHIPPING_THRESHOLD, findProduct, getCollection, productsByCollection } from '../data/products'
import { useCart } from '../store/CartContext'
import { formatPrice } from '../utils/currency'
import Button from '../components/Button'
import ProductCard from '../components/ProductCard'
import Footer from '../components/Footer'

export default function ProductDetail() {
  const { id } = useParams()
  const product = findProduct(id)
  const [qty, setQty] = useState(1)
  const { add } = useCart()

  // A jump between two products reuses this component, so the stepper resets.
  useEffect(() => setQty(1), [id])

  if (!product) return <main className="not-found"><h1>That treat wandered off.</h1><Button to="/shop">Back to shop</Button></main>

  const collection = getCollection(product.collection)
  const related = productsByCollection(product.collection).filter(item => item.id !== product.id).slice(0, 4)

  return <>
    <main className="detail-page">
      <nav className="back-link" aria-label="Breadcrumb">
        <Link to="/shop"><ArrowLeft aria-hidden="true"/> Shop</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/shop?category=${collection.slug}`}>{collection.title}</Link>
      </nav>

      <div className="detail-grid">
        <div className="detail-visual" style={{ '--accent': product.color }}>
          <img src={product.image} alt={product.name}/>
          <span>Small-batch · {product.size}</span>
        </div>
        <div className="detail-copy">
          <Link className="eyebrow detail-collection" to={`/shop?category=${collection.slug}`}>{collection.title}</Link>
          <h1>{product.name}</h1>
          {product.nameZh && <p className="detail-name-zh">{product.nameZh}</p>}
          <p className="detail-lead">{product.note}</p>
          <div className="detail-tags">{product.tags.map(tag => <span key={tag}><Check/> {tag}</span>)}</div>
          <div className="ingredient">
            <div><small>Made with</small><strong>{product.ingredients}</strong></div>
            <div><small>Size</small><strong>{product.size}</strong></div>
          </div>
          <div className="buy-row">
            <strong>{formatPrice(product.price)}</strong>
            <div className="quantity large">
              <button onClick={() => setQty(value => Math.max(1, value - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus/></button>
              <span aria-live="polite">{qty}</span>
              <button onClick={() => setQty(value => value + 1)} aria-label="Increase quantity"><Plus/></button>
            </div>
          </div>
          <Button className="full" onClick={() => add(product, qty)}>Add {qty} to bag · {formatPrice(product.price * qty)}</Button>
          <p className="safe-note"><ShieldCheck/> Free shipping over {formatPrice(FREE_SHIPPING_THRESHOLD)} · checkout is confirmed with us on WhatsApp.</p>
        </div>
      </div>

      {!!related.length && <section className="detail-related">
        <header>
          <div>
            <span className="eyebrow">MORE FROM THIS SHELF</span>
            <h2>{collection.title}</h2>
          </div>
          <Link className="shop-group-link" to={`/shop?category=${collection.slug}`}>
            <span>View the collection</span>
          </Link>
        </header>
        <div className="shop-grid">{related.map(item => <ProductCard product={item} key={item.id}/>)}</div>
      </section>}
    </main>
    <Footer/>
  </>
}
