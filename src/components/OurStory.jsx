import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import StoryHoverReveal from './StoryHoverReveal'
import { getSmoothScroll, onVirtualScroll } from '../utils/smoothScroll'
import './OurStory.css'

// A matched pair shot on the same set: same room, same framing, same 4:5 crop,
// only the animal differs. The cat is uncovered under the cursor, so the two
// have to line up exactly.
const STORY_IMAGE = '/media/brand/story-harness-dog.jpg'
const STORY_IMAGE_ALT = 'A Shiba Inu sitting on a living room floor in a black Furfoo harness.'
const STORY_REVEAL_IMAGE = '/media/brand/story-harness-cat.jpg'
const STORY_REVEAL_IMAGE_ALT = 'A tabby cat sitting in the same living room, in the same black Furfoo harness.'
// If the pair is missing, the slot keeps the older lifestyle photo rather than
// dropping to the placeholder. That photo is a different scene, so the reveal
// is switched off with it.
const STORY_IMAGE_FALLBACK = '/media/brand/story-family.jpg'
const STORY_IMAGE_FALLBACK_ALT = 'A Furfoo owner sitting on the floor at home with her dog and cat resting against her.'

// The brief's button links to a brand story page. The router has no such route
// yet (Our Story points back at this section), so the button is left out rather
// than pointed somewhere it does not belong.
const STORY_PAGE = null

export default function OurStory() {
  const storyRef = useRef(null)
  const [revealed, setRevealed] = useState(false)
  const [imageSrc, setImageSrc] = useState(STORY_IMAGE)
  const [imageFailed, setImageFailed] = useState(false)
  const [revealFailed, setRevealFailed] = useState(false)

  const isFallbackImage = imageSrc === STORY_IMAGE_FALLBACK

  const handleImageError = () => {
    if (isFallbackImage) setImageFailed(true)
    else setImageSrc(STORY_IMAGE_FALLBACK)
  }

  // Plays once: the observer disconnects on the first intersection.
  useEffect(() => {
    const story = storyRef.current
    if (!story) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true)
      return undefined
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setRevealed(true)
      observer.disconnect()
    }, { threshold: 0.2 })

    observer.observe(story)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const story = storyRef.current
    if (!story) return undefined

    const lenis = getSmoothScroll()
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
      target.closest('.hachi-panel, [data-no-page-snap], [data-lenis-prevent], input, textarea, select'),
    )

    const snapDuration = (distance) => gsap.utils.clamp(0.68, 1.05, distance / 1100)
    // power3.inOut, so the snap leaves and lands on the same curve as the rest
    // of the page glide instead of stopping dead.
    const snapEase = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    const snapTo = (targetY, getFinalTarget = () => targetY) => {
      isSnapping = true

      if (reduceMotion) {
        window.scrollTo(0, targetY)
        isSnapping = false
        return true
      }

      const releaseSnap = () => {
        window.setTimeout(() => { isSnapping = false }, 100)
      }

      if (lenis) {
        lenis.scrollTo(targetY, {
          duration: snapDuration(Math.abs(targetY - window.scrollY)),
          easing: snapEase,
          lock: true,
          force: true,
          onComplete: () => {
            lenis.scrollTo(getFinalTarget(), { immediate: true, force: true })
            releaseSnap()
          },
        })
        return true
      }

      const scrollPosition = { y: window.scrollY }

      snapTween = gsap.to(scrollPosition, {
        y: targetY,
        duration: snapDuration(Math.abs(targetY - window.scrollY)),
        ease: 'power3.inOut',
        overwrite: true,
        onUpdate: () => window.scrollTo(0, Math.round(scrollPosition.y)),
        onComplete: () => {
          window.scrollTo(0, getFinalTarget())
          releaseSnap()
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

    // With Lenis owning the wheel, the hero -> story snap has to claim the
    // impulse before it is eased into the page, not fight the page afterwards.
    if (lenis) {
      const unsubscribe = onVirtualScroll(({ deltaY, event }) => {
        if (shouldIgnoreScroll(event.target) || event.ctrlKey) return true
        if (isSnapping) return false

        const didSnap = deltaY > 0
          ? snapStoryIntoView()
          : deltaY < 0 && snapHeroIntoView()

        return !didSnap
      })

      return () => {
        unsubscribe()
        snapTween?.kill()
      }
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

  return <section
    className={`story story-intro${revealed ? ' is-visible' : ''}`}
    id="story"
    ref={storyRef}
    aria-labelledby="story-title"
  >
    <div className="story-intro__grid">
      <div className="story-intro__text">
        <p className="story-intro__eyebrow story-intro__reveal">Welcome to Furfoo</p>
        <h2 className="story-intro__title story-intro__reveal" id="story-title">A home built on love{' '}<br/>for every furkid.</h2>
        <p className="story-intro__lede story-intro__reveal">Pets are family, and our greatest fortune. From soothing herbal care to freshly handmade treats, everything we create is made with love to bring comfort and joy to their everyday lives.</p>
        <p className="story-intro__traits story-intro__reveal">Natural. Gentle. Lovingly handcrafted.</p>
        {STORY_PAGE && <Link className="story-intro__cta story-intro__reveal" to={STORY_PAGE}>
          Discover our story
          <span className="story-intro__cta-arrow" aria-hidden="true">&#8599;</span>
        </Link>}
      </div>

      <div className="story-intro__media">
        {imageSrc && !imageFailed
          ? <StoryHoverReveal
              baseSrc={imageSrc}
              baseAlt={isFallbackImage ? STORY_IMAGE_FALLBACK_ALT : STORY_IMAGE_ALT}
              revealSrc={isFallbackImage || revealFailed ? null : STORY_REVEAL_IMAGE}
              revealAlt={STORY_REVEAL_IMAGE_ALT}
              onBaseError={handleImageError}
              onRevealError={() => setRevealFailed(true)}
            />
          : <div className="story-intro__placeholder">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="3"/>
                <circle cx="9" cy="10" r="1.6"/>
                <path d="M3.5 17.5 9 12.5l4 3.5 3-2.5 4.5 4"/>
              </svg>
              <p>Brand photo goes here &mdash; pet and owner, natural light, 4:5.</p>
            </div>}
      </div>
    </div>
  </section>
}
