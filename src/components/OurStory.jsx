import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import ScrollReveal from './ScrollReveal'

const revealAnimation = {
  baseOpacity: 0.28,
  enableBlur: false,
  baseRotation: 1.5,
  rotationEnd: 'center center',
  wordAnimationEnd: 'center center',
}

export default function OurStory() {
  const storyRef = useRef(null)

  useEffect(() => {
    const story = storyRef.current
    if (!story) return undefined

    let snapTween
    let touchStartY = null
    let isSnapping = false
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const getStoryTop = () => window.scrollY + story.getBoundingClientRect().top
    const getHeroTop = () => {
      const hero = document.querySelector('.furfoo-scroll-hero')
      return hero ? window.scrollY + hero.getBoundingClientRect().top : 0
    }
    const shouldIgnoreScroll = (target) => target instanceof Element && Boolean(
      target.closest('.hachi-panel, [data-no-page-snap], input, textarea, select'),
    )

    const snapTo = (targetY, getFinalTarget = () => targetY) => {
      isSnapping = true

      if (reduceMotion) {
        window.scrollTo(0, targetY)
        isSnapping = false
        return true
      }

      const scrollPosition = { y: window.scrollY }
      const distance = Math.abs(targetY - window.scrollY)

      snapTween = gsap.to(scrollPosition, {
        y: targetY,
        duration: gsap.utils.clamp(0.68, 1.05, distance / 1100),
        ease: 'power3.inOut',
        overwrite: true,
        onUpdate: () => window.scrollTo(0, Math.round(scrollPosition.y)),
        onComplete: () => {
          window.scrollTo(0, getFinalTarget())
          window.setTimeout(() => { isSnapping = false }, 100)
        },
      })

      return true
    }

    const snapStoryIntoView = () => {
      const storyTop = getStoryTop()
      if (isSnapping || storyTop <= window.scrollY + 2) return false
      return snapTo(storyTop, getStoryTop)
    }

    const snapHeroIntoView = () => {
      const storyTop = getStoryTop()
      const heroTop = getHeroTop()
      const entryTolerance = Math.max(28, window.innerHeight * 0.04)

      if (
        isSnapping ||
        window.scrollY <= heroTop + 2 ||
        window.scrollY > storyTop + entryTolerance
      ) return false

      return snapTo(heroTop, getHeroTop)
    }

    const handleWheel = (event) => {
      if (shouldIgnoreScroll(event.target) || event.ctrlKey) return

      if (isSnapping) {
        event.preventDefault()
        return
      }

      const didSnap = event.deltaY > 0
        ? snapStoryIntoView()
        : event.deltaY < 0 && snapHeroIntoView()

      if (didSnap) event.preventDefault()
    }

    const handleTouchStart = (event) => {
      touchStartY = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event) => {
      if (shouldIgnoreScroll(event.target) || touchStartY === null) return

      if (isSnapping) {
        event.preventDefault()
        return
      }

      const currentY = event.touches[0]?.clientY
      if (currentY === undefined) return

      const touchDistance = touchStartY - currentY
      const didSnap = touchDistance > 14
        ? snapStoryIntoView()
        : touchDistance < -14 && snapHeroIntoView()

      if (!didSnap) return

      event.preventDefault()
      touchStartY = currentY
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      snapTween?.kill()
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return <section className="story section" id="story" ref={storyRef}>
    <div className="section-shell story-grid">
      <div className="story-text">
        <ScrollReveal {...revealAnimation} containerClassName="story-scroll-reveal story-heading">Welcome to FURFOO</ScrollReveal>
        <ScrollReveal {...revealAnimation} as="p" containerClassName="story-scroll-reveal story-tagline">A home built with love for every furkid.</ScrollReveal>
        <ScrollReveal {...revealAnimation} as="p" containerClassName="story-scroll-reveal story-body">At FURFOO, pets are more than companions — they are family, and our greatest fortune. Every product we create is natural, gentle, and lovingly handcrafted to bring comfort, care, and joy to the ones who give us theirs every day.</ScrollReveal>
        <ScrollReveal {...revealAnimation} as="p" containerClassName="story-scroll-reveal story-body story-body--closing">From soothing herbal care to fresh handmade treats, this is where fur meets fortune — and where love always feels at home.</ScrollReveal>
      </div>
    </div>
  </section>
}
