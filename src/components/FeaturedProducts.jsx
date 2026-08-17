import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, CircleArrowDown } from 'lucide-react'
import gsap from 'gsap'
import { products } from '../data/products'
import ProductCard from './ProductCard'
import Button from './Button'
import SectionReveal from './SectionReveal'
import ScrollVelocity from './ScrollVelocity'
import { playSiteSound, stopSiteSound, subscribeSiteSound } from '../utils/siteSound'

const AUTO_DELAY = 7500
const MANUAL_RESUME_DELAY = 10000
const PULL_DURATION = 560

function restartAudio(audio) {
  playSiteSound(audio)
}

function primeAudio(audio) {
  if (!audio) return
  audio.muted = true
  audio.play().then(() => {
    audio.pause()
    audio.currentTime = 0
    audio.muted = false
  }).catch(() => { audio.muted = false })
}

const shelves = [
  { category: 'Natural Treats', products: products.filter(product => product.category === 'Natural Treats') },
  { category: 'Functional Treats', products: products.filter(product => product.category === 'Functional Treats') },
  { category: 'Dental Care', products: products.filter(product => product.tags.includes('Dental care')) },
  { category: 'Daily Rewards', products: products.filter(product => product.tags.some(tag => ['Daily energy', 'Training'].includes(tag))) },
]

const ProductReel = forwardRef(function ProductReel({ category, products: reelProducts, isSpinning, onManualInteraction }, ref) {
  const viewportRef = useRef(null)
  const railRef = useRef(null)
  const currentRef = useRef(0)
  const busyRef = useRef(false)
  const reducedMotionRef = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const slides = useMemo(() => {
    if (!reelProducts.length) return []
    return [reelProducts.at(-1), ...reelProducts, reelProducts[0]]
  }, [reelProducts])

  const setRailPosition = useCallback((position) => {
    const height = viewportRef.current?.clientHeight || 0
    if (railRef.current && height) gsap.set(railRef.current, { y: -position * height })
  }, [])

  const move = useCallback((direction, options = {}) => new Promise(resolve => {
    const { duration = 0.62, ease = 'power3.inOut', force = false } = options
    if (!railRef.current || !viewportRef.current || reelProducts.length < 2 || (busyRef.current && !force)) {
      resolve(false)
      return
    }

    busyRef.current = true
    setIsAnimating(true)
    const length = reelProducts.length
    const height = viewportRef.current.clientHeight
    const nextIndex = (currentRef.current + direction + length) % length
    const targetPosition = direction > 0 ? currentRef.current + 2 : currentRef.current

    gsap.killTweensOf(railRef.current)
    gsap.to(railRef.current, {
      y: -targetPosition * height,
      duration: reducedMotionRef.current ? 0 : duration,
      ease,
      overwrite: true,
      onComplete: () => {
        currentRef.current = nextIndex
        setCurrentIndex(nextIndex)
        setRailPosition(nextIndex + 1)
        busyRef.current = false
        setIsAnimating(false)
        resolve(true)
      },
    })
  }), [reelProducts.length, setRailPosition])

  const handleManual = useCallback(direction => {
    if (isSpinning || busyRef.current) return
    onManualInteraction()
    move(direction)
  }, [isSpinning, move, onManualInteraction])

  useImperativeHandle(ref, () => ({
    advance: () => move(1),
    spinTo: async (targetIndex, reelNumber, reducedMotion) => {
      if (reducedMotion) {
        const rail = railRef.current
        if (!rail) return
        gsap.killTweensOf(rail)
        await new Promise(resolve => gsap.to(rail, {
          opacity: 0,
          duration: 0.12,
          onComplete: () => {
            currentRef.current = targetIndex
            setCurrentIndex(targetIndex)
            setRailPosition(targetIndex + 1)
            gsap.to(rail, { opacity: 1, duration: 0.16, onComplete: resolve })
          },
        }))
        return
      }

      const length = reelProducts.length
      const minimumSteps = 18 + reelNumber * 2
      const landingOffset = (targetIndex - currentRef.current + length) % length
      const steps = minimumSteps + ((landingOffset - minimumSteps) % length + length) % length

      for (let step = 0; step < steps; step += 1) {
        const isLast = step === steps - 1
        await move(1, {
          duration: isLast ? 0.5 : 0.115 + reelNumber * 0.006,
          ease: isLast ? 'back.out(1.25)' : 'none',
          force: true,
        })
      }
    },
  }), [move, reelProducts.length, setRailPosition])

  useLayoutEffect(() => {
    setRailPosition(currentRef.current + 1)
    const onResize = () => setRailPosition(currentRef.current + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setRailPosition])

  useEffect(() => () => gsap.killTweensOf(railRef.current), [])

  const controlsDisabled = isSpinning || isAnimating

  return <article className="product-reel" aria-label={`${category} product reel`}>
    <header className="product-reel-head"><div><span>Category</span><h3>{category}</h3></div></header>
    <div className="product-reel-control-row product-reel-control-row--top">
      <button className="direction-button direction-button--up" type="button" onClick={() => handleManual(-1)} disabled={controlsDisabled} aria-label={`Previous ${category} product`}><ChevronUp aria-hidden="true"/></button>
    </div>
    <div className="product-reel-viewport" ref={viewportRef}>
      <div className="product-reel-rail" ref={railRef} aria-atomic="false">
        {slides.map((product, index) => <div className="product-reel-slide" key={`${category}-${product.id}-${index}`} aria-hidden={index !== currentIndex + 1} inert={index !== currentIndex + 1}>
          <ProductCard product={product}/>
        </div>)}
      </div>
    </div>
    <div className="product-reel-control-row product-reel-control-row--bottom">
      <button className="direction-button direction-button--down" type="button" onClick={() => handleManual(1)} disabled={controlsDisabled} aria-label={`Next ${category} product`}><ChevronDown aria-hidden="true"/></button>
    </div>
  </article>
})

function SpinButton({ onClick, disabled, isPulling }) {
  const label = isPulling ? 'Pulling…' : disabled ? 'Finding your fortune…' : 'Pick My Fortune'
  return <button className={`spin-button${isPulling ? ' is-pulling' : ''}`} type="button" onClick={onClick} disabled={disabled}>
    <CircleArrowDown aria-hidden="true"/><span>{label}</span>
  </button>
}

export default function FeaturedProducts() {
  const reelRefs = useRef([])
  const autoTimerRef = useRef(null)
  const resumeTimerRef = useRef(null)
  const wheelAudioRef = useRef(null)
  const winAudioRef = useRef(null)
  const isSpinningRef = useRef(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isManualPaused, setIsManualPaused] = useState(false)

  const clearAutoTimer = useCallback(() => window.clearInterval(autoTimerRef.current), [])

  const pauseAutoForManualControl = useCallback(() => {
    window.clearTimeout(resumeTimerRef.current)
    clearAutoTimer()
    setIsManualPaused(true)
    resumeTimerRef.current = window.setTimeout(() => {
      setIsManualPaused(false)
      if (!isSpinningRef.current) reelRefs.current.forEach(reel => reel?.advance())
    }, MANUAL_RESUME_DELAY)
  }, [clearAutoTimer])

  useEffect(() => {
    const wheelAudio = new Audio('/sounds/slot-machine-wheel.wav')
    const winAudio = new Audio('/sounds/slot-machine-win.wav')
    wheelAudio.preload = 'auto'
    winAudio.preload = 'auto'
    wheelAudio.volume = 0.22
    winAudio.volume = 0.18
    wheelAudioRef.current = wheelAudio
    winAudioRef.current = winAudio
    const unsubscribeSound = subscribeSiteSound(enabled => {
      if (enabled) return
      stopSiteSound(wheelAudio)
      stopSiteSound(winAudio)
    })
    return () => {
      unsubscribeSound()
      stopSiteSound(wheelAudio)
      stopSiteSound(winAudio)
    }
  }, [])

  useEffect(() => {
    clearAutoTimer()
    if (isSpinning || isManualPaused) return
    autoTimerRef.current = window.setInterval(() => {
      reelRefs.current.forEach(reel => reel?.advance())
    }, AUTO_DELAY)
    return clearAutoTimer
  }, [clearAutoTimer, isManualPaused, isSpinning])

  useEffect(() => () => {
    clearAutoTimer()
    window.clearTimeout(resumeTimerRef.current)
  }, [clearAutoTimer])

  const spin = async () => {
    if (isSpinning) return
    clearAutoTimer()
    isSpinningRef.current = true
    setIsSpinning(true)
    restartAudio(wheelAudioRef.current)
    primeAudio(winAudioRef.current)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducedMotion) {
      setIsPulling(true)
      await new Promise(resolve => window.setTimeout(resolve, PULL_DURATION))
      setIsPulling(false)
    }
    const targets = shelves.map(shelf => Math.floor(Math.random() * shelf.products.length))

    await Promise.all(reelRefs.current.map((reel, index) => reel?.spinTo(targets[index], index, reducedMotion)))
    stopSiteSound(wheelAudioRef.current)
    restartAudio(winAudioRef.current)
    isSpinningRef.current = false
    setIsSpinning(false)
  }

  return <div className="featured-region">
    <div className="featured-promo">
      <p className="featured-promo-accessible">买满 RM100 免运费。新鲜小批次制作，毛孩吃得开心。</p>
      <div aria-hidden="true">
        <ScrollVelocity
          texts={['买满 RM100 免运费 ✦ 新鲜小批次制作 ✦ 毛孩吃得开心 ✦ ']}
          velocity={42}
          numCopies={5}
          className="featured-promo-text"
          parallaxClassName="promo-parallax"
          scrollerClassName="promo-scroller"
        />
      </div>
    </div>
    <section className="featured section" id="treat-shelf">
      <div className="section-shell">
        <header className="featured-head">
          <span className="eyebrow">HACHI'S FAVOURITES</span>
          <SectionReveal>The treat shelf.</SectionReveal>
          <div className="featured-actions"><Button to="/shop" variant="outline">View all products</Button></div>
        </header>
        <div className="product-grid" aria-busy={isSpinning}>
          {shelves.map((shelf, index) => <ProductReel
            key={shelf.category}
            ref={node => { reelRefs.current[index] = node }}
            category={shelf.category}
            products={shelf.products}
            isSpinning={isSpinning}
            onManualInteraction={pauseAutoForManualControl}
          />)}
        </div>
        <div className="shelf-spin-zone"><SpinButton onClick={spin} disabled={isSpinning} isPulling={isPulling}/></div>
      </div>
    </section>
  </div>
}
