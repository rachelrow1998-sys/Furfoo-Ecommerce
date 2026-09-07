import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const createEdgeShapes = flatEdge => {
  return {
    down: `polygon(0% 0%, 100% 0%, 100% ${flatEdge}%, 50% 100%, 0% ${flatEdge}%)`,
    flat: `polygon(0% 0%, 100% 0%, 100% ${flatEdge}%, 50% ${flatEdge}%, 0% ${flatEdge}%)`,
    up: `polygon(0% 0%, 100% 0%, 100% 100%, 50% ${flatEdge}%, 0% 100%)`,
  }
}

export default function ReviewsAdoptionTransition() {
  const transitionRef = useRef(null)

  useGSAP(() => {
    const element = transitionRef.current
    const reviewsSection = element?.closest('.reviews')
    if (!element || !reviewsSection) return undefined

    const media = gsap.matchMedia()

    media.add({
      isMobile: '(max-width: 820px)',
      isDesktop: '(min-width: 821px)',
      reduceMotion: '(prefers-reduced-motion: reduce)',
    }, context => {
      const mobileDepth = 96
      const desktopDepth = 160
      const extensionDepth = context.conditions.isMobile ? mobileDepth : desktopDepth
      const flattenDistance = context.conditions.isMobile ? 40 : 56
      const elementHeight = 250 + extensionDepth
      const animationDistance = flattenDistance + extensionDepth
      const flatEdge = (250 / elementHeight) * 100
      const shapes = createEdgeShapes(flatEdge)

      if (context.conditions.reduceMotion) {
        gsap.set(element, { clipPath: shapes.up })
        return undefined
      }

      gsap.set(element, { clipPath: shapes.down })

      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: reviewsSection,
          start: 'bottom bottom',
          end: `bottom+=${animationDistance}px bottom`,
          scrub: 0.35,
          invalidateOnRefresh: true,
        },
      })

      timeline
        .to(element, { clipPath: shapes.flat, duration: flattenDistance / animationDistance })
        .to(element, { clipPath: shapes.up, duration: extensionDepth / animationDistance })

      return () => {
        timeline.scrollTrigger?.kill()
        timeline.kill()
      }
    })

    return () => media.revert()
  }, { scope: transitionRef })

  return <div className="reviews-adoption-transition" ref={transitionRef} aria-hidden="true" />
}
