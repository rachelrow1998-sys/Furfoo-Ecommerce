import { products } from '../data/products'
import ProductCard from '../components/ProductCard'
import Footer from '../components/Footer'

export default function Shop() {
  return <><main className="shop-page"><header className="shop-hero"><span className="eyebrow">THE GOOD STUFF</span><h1>Hachi’s<br/><em>treat shelf.</em></h1><p>Small-batch favourites made with recognisable ingredients and plenty of tail-wagging intention.</p></header><section className="section-shell"><div className="shop-filter"><span>All products</span><span>{products.length} picks</span></div><div className="product-grid">{products.map(p => <ProductCard product={p} key={p.id}/>)}</div></section></main><Footer/></>
}
