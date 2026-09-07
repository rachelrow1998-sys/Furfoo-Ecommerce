import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import './PillNav.css'

export default function PillNav({ items, activeHref, mobileOpen, onNavigate }) {
  const pillsRef = useRef([])

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      pillsRef.current.forEach((pill) => {
        if (!pill) return

        pill._pillTimeline = null
        if (pill.classList.contains('is-active')) return

        const circle = pill.querySelector('.pill-nav__circle')
        const label = pill.querySelector('.pill-nav__label')
        const hoverLabel = pill.querySelector('.pill-nav__label--hover')

        gsap.set(circle, { scale: 0, xPercent: -50, transformOrigin: '50% 100%' })
        gsap.set(hoverLabel, { y: 52, opacity: 0 })

        pill._pillTimeline = gsap.timeline({ paused: true })
          .to(circle, { scale: 1.35, duration: .42, ease: 'power3.out' }, 0)
          .to(label, { y: -52, duration: .34, ease: 'power3.out' }, 0)
          .to(hoverLabel, { y: 0, opacity: 1, duration: .34, ease: 'power3.out' }, 0)
      })
    })

    return () => context.revert()
  }, [items, activeHref])

  const animateTo = (index, progress) => {
    const timeline = pillsRef.current[index]?._pillTimeline
    if (!timeline) return

    if (progress) {
      pillsRef.current.forEach((pill, pillIndex) => {
        const otherTimeline = pill?._pillTimeline
        if (!otherTimeline || pillIndex === index) return
        gsap.killTweensOf(otherTimeline)
        otherTimeline.progress(0)
      })
    }

    gsap.killTweensOf(timeline)
    gsap.to(timeline, {
      progress,
      duration: progress ? .28 : .2,
      ease: 'power2.out',
      overwrite: true,
    })
  }

  const renderItem = (item, index, mobile = false) => {
    const active = activeHref === item.href
    const className = mobile
      ? `pill-nav__mobile-link${active ? ' is-active' : ''}`
      : `pill-nav__pill${active ? ' is-active' : ''}`
    const content = mobile ? item.label : <>
      <span className="pill-nav__circle" aria-hidden="true" />
      <span className="pill-nav__label-stack">
        <span className="pill-nav__label">{item.label}</span>
        <span className="pill-nav__label pill-nav__label--hover" aria-hidden="true">{item.label}</span>
      </span>
    </>
    const shared = {
      className,
      'aria-current': active ? 'page' : undefined,
      onClick: (event) => onNavigate?.(item, event),
      ...(mobile && { tabIndex: mobileOpen ? 0 : -1 }),
      ...(!mobile && {
        ref: (element) => { pillsRef.current[index] = element },
        onMouseEnter: () => animateTo(index, 1),
        onMouseLeave: () => animateTo(index, 0),
        onFocus: () => animateTo(index, 1),
        onBlur: () => animateTo(index, 0),
      }),
    }

    return item.href.startsWith('/#')
      ? <a href={item.href} {...shared}>{content}</a>
      : <Link to={item.href} {...shared}>{content}</Link>
  }

  return <>
    <nav className="pill-nav" aria-label="Main navigation">
      <ul className="pill-nav__list">
        {items.map((item, index) => <li key={item.href}>{renderItem(item, index)}</li>)}
      </ul>
    </nav>
    <nav id="mobile-navigation" className={`pill-nav-mobile${mobileOpen ? ' is-open' : ''}`} aria-label="Mobile navigation" aria-hidden={!mobileOpen}>
      <ul>
        {items.map((item, index) => <li key={item.href}>{renderItem(item, index, true)}</li>)}
      </ul>
    </nav>
  </>
}
