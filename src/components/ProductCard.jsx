import { ArrowUpRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '../store/CartContext'
import { formatPrice, onImageError } from '../lib/catalog'

/**
 * Stock comes from the POS, so a card can say three things: on the shelf, only
 * a few left, or sold out. A sold-out card still links to the product page -
 * people ask when it is back - but cannot be added to the bag.
 */
function stockLabel(product) {
  if (typeof product.stockQty !== 'number') return null
  if (!product.inStock) return { text: 'Sold out', tone: 'out' }
  if (product.lowStock) return { text: `Only ${product.stockQty} left`, tone: 'low' }
  return { text: 'In stock', tone: 'in' }
}

export default function ProductCard({ product }) {
  const { add } = useCart()
  const stock = stockLabel(product)
  const soldOut = stock?.tone === 'out'

  return <article className={`product-card${soldOut ? ' is-sold-out' : ''}`} style={{ '--accent': product.color }}>
    <Link className="product-visual" to={`/products/${product.id}`}>
      <img src={product.image} alt={product.name} loading="lazy" onError={onImageError}/>
      <span>{product.category}</span>
      {stock && <em className={`stock-pill stock-pill--${stock.tone}`}>{stock.text}</em>}
    </Link>
    <div className="product-copy">
      <div><h3>{product.name}</h3><p>{product.note}</p></div>
      <div className="tag-row">{(product.tags || []).map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="product-bottom">
        <strong>{formatPrice(product.price, product.currency)}</strong>
        <div>
          <Link className="circle-link" to={`/products/${product.id}`} aria-label={`View ${product.name}`}><ArrowUpRight/></Link>
          <button
            className="circle-link add"
            onClick={() => add(product)}
            disabled={soldOut}
            aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
          ><Plus/></button>
        </div>
      </div>
    </div>
  </article>
}
