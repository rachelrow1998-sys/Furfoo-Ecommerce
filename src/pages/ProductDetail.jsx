import { ArrowLeft, Check, Minus, Plus, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { products } from '../data/products'
import { useCart } from '../store/CartContext'
import Button from '../components/Button'
import Footer from '../components/Footer'

export default function ProductDetail() {
  const { id } = useParams(); const product = products.find(p => p.id === id); const [qty, setQty] = useState(1); const { add } = useCart()
  if (!product) return <main className="not-found"><h1>That treat wandered off.</h1><Button to="/shop">Back to shop</Button></main>
  return <><main className="detail-page"><Link to="/shop" className="back-link"><ArrowLeft/> Back to shop</Link><div className="detail-grid"><div className="detail-visual" style={{ '--accent': product.color }}><img src={product.image} alt={product.name}/><span>Small-batch · 50g</span></div><div className="detail-copy"><span className="eyebrow">{product.category}</span><h1>{product.name}</h1><p className="detail-lead">{product.note}</p><div className="detail-tags">{product.tags.map(t => <span key={t}><Check/> {t}</span>)}</div><div className="ingredient"><small>Made with</small><strong>{product.ingredients}</strong></div><div className="buy-row"><strong>RM {product.price.toFixed(2)}</strong><div className="quantity large"><button onClick={() => setQty(q => Math.max(1, q - 1))}><Minus/></button><span>{qty}</span><button onClick={() => setQty(q => q + 1)}><Plus/></button></div></div><Button className="full" onClick={() => add(product, qty)}>Add {qty} to cart</Button><p className="safe-note"><ShieldCheck/> Secure checkout can be connected to your preferred payment provider.</p></div></div></main><Footer/></>
}
