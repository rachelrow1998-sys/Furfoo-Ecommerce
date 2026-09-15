import { useMemo, useState } from 'react'
import { ArrowRight, MessageCircle, PackageCheck, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  FREE_SHIPPING_THRESHOLD,
  WHATSAPP_NUMBER,
  collections,
  getCollection,
  products,
  productsByCollection,
} from '../data/products'
import ProductCard from '../components/ProductCard'
import Button from '../components/Button'
import Footer from '../components/Footer'
import { formatPrice } from '../utils/currency'
import { scrollToTarget } from '../utils/smoothScroll'

const sorters = {
  featured: null,
  'price-low': (a, b) => a.price - b.price,
  'price-high': (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
}

const sortOptions = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A–Z' },
]

const sortProducts = (list, sort) => (sorters[sort] ? [...list].sort(sorters[sort]) : list)

/** Chips and collection cards both land here, so the URL stays the single source of truth. */
const scrollToCatalogue = () => {
  window.requestAnimationFrame(() => {
    const target = document.getElementById('shop-catalogue')
    if (target) scrollToTarget(target)
  })
}

export default function Shop() {
  const [searchParams] = useSearchParams()
  const [sort, setSort] = useState('featured')

  const requested = searchParams.get('category')
  const active = collections.some(collection => collection.slug === requested) ? requested : 'all'
  const activeCollection = active === 'all' ? null : getCollection(active)

  const groups = useMemo(() => {
    const shown = active === 'all' ? collections : [getCollection(active)]
    return shown.map(collection => ({
      collection,
      items: sortProducts(productsByCollection(collection.slug), sort),
    }))
  }, [active, sort])

  const shownCount = groups.reduce((sum, group) => sum + group.items.length, 0)

  return <>
    <main className="shop-page">
      <header className="shop-hero">
        <span className="eyebrow">THE FURFOO SHOP</span>
        <h1>Everything on<br/><em>Hachi’s shelf.</em></h1>
        <div className="shop-hero-aside">
          <p>Treats, baths, botanical care and wellness sachets — all small-batch, all handcrafted, all sorted into four tidy shelves so you can find the right one fast.</p>
          <ul className="shop-hero-facts">
            <li><strong>{products.length}</strong><span>products</span></li>
            <li><strong>{collections.length}</strong><span>collections</span></li>
            <li><strong>Free</strong><span>shipping over {formatPrice(FREE_SHIPPING_THRESHOLD)}</span></li>
          </ul>
        </div>
      </header>

      <nav className="shop-collection-rail" aria-label="Shop by collection">
        {collections.map(collection => {
          const count = productsByCollection(collection.slug).length
          const isActive = collection.slug === active
          return <Link
            className={`shop-collection-card${isActive ? ' is-active' : ''}`}
            key={collection.slug}
            to={`/shop?category=${collection.slug}`}
            replace
            onClick={scrollToCatalogue}
            style={{ '--accent': collection.accent }}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className="shop-collection-photo"><img src={collection.image} alt="" loading="lazy"/></span>
            <span className="shop-collection-copy">
              <small>{collection.num} / {String(collections.length).padStart(2, '0')}</small>
              <strong>{collection.title}</strong>
              <em>{collection.desc}</em>
              <i>{count} product{count > 1 ? 's' : ''} <ArrowRight aria-hidden="true"/></i>
            </span>
          </Link>
        })}
      </nav>

      <div className="shop-catalogue" id="shop-catalogue">
        <div className="shop-toolbar">
          <div className="shop-chips">
            <Link className={`shop-chip${active === 'all' ? ' is-active' : ''}`} to="/shop" replace onClick={scrollToCatalogue}>
              All products <i>{products.length}</i>
            </Link>
            {collections.map(collection => <Link
              className={`shop-chip${collection.slug === active ? ' is-active' : ''}`}
              key={collection.slug}
              to={`/shop?category=${collection.slug}`}
              replace
              onClick={scrollToCatalogue}
            >
              {collection.title} <i>{productsByCollection(collection.slug).length}</i>
            </Link>)}
          </div>
          <label className="shop-sort">
            <span>Sort</span>
            <select value={sort} onChange={event => setSort(event.target.value)}>
              {sortOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <p className="shop-result-line" aria-live="polite">
          Showing <strong>{shownCount}</strong> {shownCount === 1 ? 'product' : 'products'}
          {activeCollection ? <> in <strong>{activeCollection.title}</strong> — <Link to="/shop" replace>clear filter</Link></> : ' across every collection'}
        </p>

        {activeCollection && <section className="shop-collection-intro" style={{ '--accent': activeCollection.accent }}>
          <img src={activeCollection.image} alt="" loading="lazy"/>
          <div>
            <span className="eyebrow">COLLECTION {activeCollection.num}</span>
            <h2>{activeCollection.title}</h2>
            <p>{activeCollection.blurb}</p>
          </div>
        </section>}

        {groups.map(({ collection, items }) => <section className="shop-group" key={collection.slug} id={`collection-${collection.slug}`}>
          {!activeCollection && <header className="shop-group-head">
            <div>
              <span className="shop-group-num">{collection.num}</span>
              <h2>{collection.title}</h2>
              <p>{collection.blurb}</p>
            </div>
            <Link className="shop-group-link" to={`/shop?category=${collection.slug}`} replace onClick={scrollToCatalogue}>
              <span>Only {collection.title.toLowerCase()}</span>
              <ArrowRight aria-hidden="true"/>
            </Link>
          </header>}

          {items.length
            ? <div className="shop-grid">{items.map(product => <ProductCard product={product} key={product.id}/>)}</div>
            : <p className="shop-empty">This shelf is being restocked. <Link to="/shop" replace>Browse everything</Link> in the meantime.</p>}
        </section>)}
      </div>

      <section className="shop-assurances">
        <article><PackageCheck aria-hidden="true"/><div><strong>Small-batch, always fresh</strong><p>Made in small runs with no additives, preservatives or artificial flavours.</p></div></article>
        <article><Sparkles aria-hidden="true"/><div><strong>Free shipping over {formatPrice(FREE_SHIPPING_THRESHOLD)}</strong><p>Mix and match across collections — the bag counts everything together.</p></div></article>
        <article><MessageCircle aria-hidden="true"/><div><strong>Not sure what to pick?</strong><p>Tell us about your pet on WhatsApp and we will put a shelf together for you.</p></div></article>
      </section>

      <section className="shop-cta">
        <div>
          <span className="eyebrow">STILL DECIDING?</span>
          <h2>Ask Hachi’s humans.</h2>
          <p>Send us a photo of your furry one and we will suggest the treats, baths and care they will love.</p>
        </div>
        <Button href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</Button>
      </section>
    </main>
    <Footer/>
  </>
}
