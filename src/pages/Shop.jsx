import { useCatalog } from '../store/CatalogContext'
import ProductCard from '../components/ProductCard'
import Footer from '../components/Footer'

export default function Shop() {
  const { products, status, stale, isLive } = useCatalog()
  const loading = status === 'loading'

  return <><main className="shop-page">
    <header className="shop-hero">
      <span className="eyebrow">THE GOOD STUFF</span>
      <h1>Hachi’s<br/><em>treat shelf.</em></h1>
      <p>Small-batch favourites made with recognisable ingredients and plenty of tail-wagging intention.</p>
    </header>
    <section className="section-shell">
      <div className="shop-filter">
        <span>All products</span>
        <span>{loading ? 'Loading…' : `${products.length} picks`}</span>
      </div>
      {stale && isLive && <p className="catalog-note">Showing the last known stock — the shop counter is not answering right now.</p>}
      {loading
        ? <div className="product-grid product-grid--loading" aria-busy="true">{[0, 1, 2, 3].map(slot => <div className="product-skeleton" key={slot}/>)}</div>
        : <div className="product-grid">{products.map(product => <ProductCard product={product} key={product.sku || product.id}/>)}</div>}
      {!loading && !products.length && <p className="catalog-note">The shelf is being restocked. Please check back soon.</p>}
    </section>
  </main><Footer/></>
}
