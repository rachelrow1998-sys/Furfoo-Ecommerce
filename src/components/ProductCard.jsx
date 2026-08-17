import { ArrowUpRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '../store/CartContext'

export default function ProductCard({ product }) {
  const { add } = useCart()
  return <article className="product-card" style={{ '--accent': product.color }}>
    <Link className="product-visual" to={`/products/${product.id}`}><img src={product.image} alt={product.name} loading="lazy"/><span>{product.category}</span></Link>
    <div className="product-copy"><div><h3>{product.name}</h3><p>{product.note}</p></div><div className="tag-row">{product.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="product-bottom"><strong>RM {product.price.toFixed(2)}</strong><div><Link className="circle-link" to={`/products/${product.id}`} aria-label={`View ${product.name}`}><ArrowUpRight/></Link><button className="circle-link add" onClick={() => add(product)} aria-label={`Add ${product.name} to cart`}><Plus/></button></div></div></div>
  </article>
}
