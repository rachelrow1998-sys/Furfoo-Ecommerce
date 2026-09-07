import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import SectionReveal from './SectionReveal'
import GlassSurface from './GlassSurface'

const categories = [
  { num: '01', title: 'Natural Treats', desc: 'Honest meat, fish, fruit and vegetables.', image: '/media/products/wholesome-chips.jpg' },
  { num: '02', title: 'Functional Treats', desc: 'Daily support for skin, coat and happy tummies.', image: '/media/products/duck-salmon-roll.jpg' },
  { num: '03', title: 'Herbal Care', desc: 'Gentle botanical soaks for calmer skin.', image: '/media/products/all-in-one.jpg' },
  { num: '04', title: 'Daily Essentials', desc: 'Thoughtful clean-up for everyday adventures.', image: '/media/products/greens-biscuits.jpg' },
]

export default function ProductCategories() {
  const [activeIndex, setActiveIndex] = useState(0)
  const panelsRef = useRef([])
  const tickingRef = useRef(false)
  const activeCategory = categories[activeIndex]

  useEffect(() => {
    const updateActiveCategory = () => {
      tickingRef.current = false
      const viewportCenter = window.innerHeight / 2
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      panelsRef.current.forEach((panel, index) => {
        if (!panel) return
        const rect = panel.getBoundingClientRect()
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = index
        }
      })

      setActiveIndex((current) => current === nearestIndex ? current : nearestIndex)
    }

    const onScroll = () => {
      if (tickingRef.current) return
      tickingRef.current = true
      requestAnimationFrame(updateActiveCategory)
    }

    updateActiveCategory()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section className="categories section" id="products">
      <div className="section-shell">
        <header className="section-head category-section-head">
          <div>
            <span className="eyebrow">PICK A GOOD DAY</span>
            <SectionReveal>Scroll through<br/>their favourites.</SectionReveal>
          </div>
          <div className="category-section-copy">
            <SectionReveal as="p">Four collections pass through one glass surface. Keep scrolling to explore every favourite.</SectionReveal>
            <a className="category-skip-link" href="#treat-shelf">
              <span>Skip to the treat shelf</span>
              <ArrowDown aria-hidden="true"/>
            </a>
          </div>
        </header>

        <div className="category-panel-story">
          <div className="category-lens-track">
            <div className="category-lens-sticky">
              <GlassSurface
                width="min(72%, 690px)"
                height="var(--category-lens-height)"
                borderRadius={88}
                borderWidth={0.14}
                brightness={72}
                opacity={0.86}
                blur={9}
                displace={3}
                backgroundOpacity={0.18}
                saturation={1.8}
                distortionScale={-210}
                redOffset={6}
                greenOffset={18}
                blueOffset={32}
                mixBlendMode="screen"
                className="category-glass-lens"
              >
                <Link to="/shop" className="category-glass-link" aria-label={`Explore ${activeCategory.title}`}>
                  <span className="category-glass-kicker">
                    <span>Explore {activeCategory.num} / 04</span>
                    <ArrowUpRight />
                  </span>
                  <strong key={activeCategory.title}>{activeCategory.title}</strong>
                  <small key={activeCategory.desc}>{activeCategory.desc}</small>
                </Link>
              </GlassSurface>
            </div>
          </div>

          <div className="category-panels">
            {categories.map((category, index) => (
              <article
                className="category-panel"
                key={category.title}
                ref={(element) => { panelsRef.current[index] = element }}
              >
                <img className="category-panel-image" src={category.image} alt="" />
                <div className="category-panel-shade" aria-hidden="true" />
                <span className="category-panel-number">{category.num} / 04</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
