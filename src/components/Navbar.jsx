import { Menu, ShoppingBag, UserRound, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { useCart } from '../store/CartContext'
import GlassSurface from './GlassSurface'
import PillNav from './PillNav'

const links = [
  { label: 'Home', href: '/#home' },
  { label: 'Our Story', href: '/#story' },
  { label: 'Products', href: '/#products' },
  { label: 'Reviews', href: '/#reviews' },
  { label: 'Adoption', href: '/#adoption' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Shop', href: '/shop' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobile, setMobile] = useState(false)
  const navActionRefs = useRef([])
  const { count, open, setOpen } = useCart()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMobile(false), [location])

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      navActionRefs.current.forEach((button) => {
        if (!button) return

        button._pillTimeline = null
        if (button.classList.contains('is-active')) return

        const circle = button.querySelector('.pill-nav__circle')
        const icon = button.querySelector('.nav-action-icon')
        const hoverIcon = button.querySelector('.nav-action-icon--hover')

        gsap.set(circle, { scale: 0, xPercent: -50, transformOrigin: '50% 100%' })
        gsap.set(hoverIcon, { y: 52, opacity: 0 })

        button._pillTimeline = gsap.timeline({ paused: true })
          .to(circle, { scale: 1.35, duration: .42, ease: 'power3.out' }, 0)
          .to(icon, { y: -52, duration: .34, ease: 'power3.out' }, 0)
          .to(hoverIcon, { y: 0, opacity: 1, duration: .34, ease: 'power3.out' }, 0)
      })
    })

    return () => context.revert()
  }, [location.pathname, open])

  const animateNavAction = (index, progress) => {
    const timeline = navActionRefs.current[index]?._pillTimeline
    if (!timeline) return
    gsap.killTweensOf(timeline)
    gsap.to(timeline, { progress, duration: progress ? .28 : .2, ease: 'power2.out', overwrite: true })
  }

  const activeHref = location.pathname.startsWith('/products')
    ? '/shop'
    : location.pathname === '/shop'
      ? '/shop'
      : location.pathname === '/'
        ? `/${location.hash || '#home'}`
        : location.pathname

  const handleNavigate = (item, event) => {
    setMobile(false)
    if (!item.href.startsWith('/#')) return

    event.preventDefault()
    const hash = item.href.slice(1)
    navigate(item.href)

    // Explicit scrolling also handles clicks on the already-active section.
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, location.pathname === '/' ? 0 : 50)
    })
  }

  return <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}${mobile ? ' navbar--menu-open' : ''}`}>
    <GlassSurface
      width="100%"
      height="100%"
      borderRadius={999}
      borderWidth={0.12}
      brightness={78}
      opacity={0.84}
      blur={14}
      displace={1.1}
      backgroundOpacity={0.18}
      saturation={1.8}
      distortionScale={-190}
      redOffset={5}
      greenOffset={16}
      blueOffset={28}
      mixBlendMode="screen"
      className="navbar-glass-layer"
    />
    <Link className="wordmark" to="/" aria-label="Furfoo home">
      <img src="/media/brand/homee-toggle-logo.png" alt="Furfoo — Where fur meets fortune" />
    </Link>
    <PillNav items={links} activeHref={activeHref} mobileOpen={mobile} onNavigate={handleNavigate} />
    <div className="nav-actions">
      <Link
        className={`icon-button nav-action-button member-login-button${location.pathname === '/members' ? ' is-active' : ''}`}
        to="/members"
        aria-label="Members login"
        title="Members login"
        ref={element => { navActionRefs.current[0] = element }}
        onMouseEnter={() => animateNavAction(0, 1)}
        onMouseLeave={() => animateNavAction(0, 0)}
        onFocus={() => animateNavAction(0, 1)}
        onBlur={() => animateNavAction(0, 0)}
      >
        <span className="pill-nav__circle" aria-hidden="true" />
        <span className="nav-action-icon-stack" aria-hidden="true">
          <UserRound className="nav-action-icon" size={20}/>
          <UserRound className="nav-action-icon nav-action-icon--hover" size={20}/>
        </span>
      </Link>
      <button
        className={`icon-button nav-action-button cart-button${open ? ' is-active' : ''}`}
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Close cart' : `Open cart with ${count} items`}
        aria-pressed={open}
        ref={element => { navActionRefs.current[1] = element }}
        onMouseEnter={() => animateNavAction(1, 1)}
        onMouseLeave={() => animateNavAction(1, 0)}
        onFocus={() => animateNavAction(1, 1)}
        onBlur={() => animateNavAction(1, 0)}
      >
        <span className="pill-nav__circle" aria-hidden="true" />
        <span className="nav-action-icon-stack" aria-hidden="true">
          {open ? <X className="nav-action-icon" size={20}/> : <ShoppingBag className="nav-action-icon" size={20}/>} 
          {open ? <X className="nav-action-icon nav-action-icon--hover" size={20}/> : <ShoppingBag className="nav-action-icon nav-action-icon--hover" size={20}/>} 
        </span>
        {count > 0 && <span className="cart-button__count">{count}</span>}
      </button>
      <button className="icon-button menu-button" onClick={() => setMobile(value => !value)} aria-label="Toggle menu" aria-expanded={mobile} aria-controls="mobile-navigation">{mobile ? <X/> : <Menu/>}</button>
    </div>
  </header>
}
