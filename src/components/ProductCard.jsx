import { ArrowUpRight, Check, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../store/CartContext'
import { formatPrice } from '../utils/currency'

export default function ProductCard({ product }) {
  const { add } = useCart()
  const [justAdded, setJustAdded] = useState(false)
  const resetTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  const handleAdd = () => {
    add(product)
    setJustAdded(true)
    window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setJustAdded(false), 1600)
  }

  return <article className="product-card" style={{ '--accent': product.color }}>
    <Link className="product-visual" to={`/products/${product.id}`}><img src={product.image} alt={product.name} loading="lazy"/><span>{product.category}</span></Link>
    <div className="product-copy">
      <div><h3>{product.name}</h3><p>{product.note}</p></div>
      <div className="tag-row">{product.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="product-bottom">
        <strong>{formatPrice(product.price)} <small>{product.size}</small></strong>
        <div>
          <Link className="circle-link" to={`/products/${product.id}`} aria-label={`View ${product.name}`}><ArrowUpRight/></Link>
          <button className={`circle-link add${justAdded ? ' is-added' : ''}`} onClick={handleAdd} aria-label={`Add ${product.name} to cart`}>{justAdded ? <Check/> : <Plus/>}</button>
        </div>
      </div>
    </div>
  </article>
}
