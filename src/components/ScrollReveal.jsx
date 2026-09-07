import { Children, cloneElement, isValidElement, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import './ScrollReveal.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

function splitIntoWords(node, path = 'text') {
  if (typeof node === 'string') {
    return node.split(/(\s+)/).map((part, index) => {
      if (/^\s+$/.test(part)) return part
      return <span className="word" key={`${path}-${index}`}>{part}</span>
    })
  }

  if (!isValidElement(node)) return node
  if (node.type === 'br') return node

  return cloneElement(node, {
    children: Children.map(node.props.children, (child, index) =>
      splitIntoWords(child, `${path}-${index}`)),
  })
}

export default function ScrollReveal({
  children,
  as: Element = 'h2',
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom bottom',
  wordScrub = true,
  disabled = false,
}) {
  const containerRef = useRef(null)

  const splitText = useMemo(() => {
    return Children.map(children, (child, index) => splitIntoWords(child, `child-${index}`))
  }, [children])

  useGSAP(
    () => {
      const element = containerRef.current
      if (!element) return undefined

      const words = element.querySelectorAll('.word')
      const customScroller = scrollContainerRef?.current
      const scrollSettings = customScroller ? { scroller: customScroller } : {}

      if (disabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(element, { rotate: 0 })
        gsap.set(words, { opacity: 1, filter: 'blur(0px)' })
        return undefined
      }

      gsap.fromTo(
        element,
        { transformOrigin: '0% 50%', rotate: baseRotation },
        {
          rotate: 0,
          ease: 'none',
          scrollTrigger: {
            ...scrollSettings,
            trigger: element,
            start: 'top bottom',
            end: rotationEnd,
            scrub: true,
          },
        },
      )

      const wordFrom = {
        opacity: baseOpacity,
        willChange: enableBlur ? 'opacity, filter' : 'opacity',
      }
      const wordTo = {
        opacity: 1,
        ease: 'none',
        stagger: 0.025,
        scrollTrigger: {
          ...scrollSettings,
          trigger: element,
          start: 'top bottom-=10%',
          end: wordAnimationEnd,
          scrub: wordScrub,
        },
      }

      if (enableBlur) {
        wordFrom.filter = `blur(${blurStrength}px)`
        wordTo.filter = 'blur(0px)'
      }

      gsap.fromTo(words, wordFrom, wordTo)

      return () => {
        gsap.set(words, { clearProps: 'willChange' })
      }
    },
    {
      scope: containerRef,
      dependencies: [
        scrollContainerRef,
        enableBlur,
        baseOpacity,
        baseRotation,
        blurStrength,
        rotationEnd,
        wordAnimationEnd,
        wordScrub,
        disabled,
      ],
      revertOnUpdate: true,
    },
  )

  return (
    <Element ref={containerRef} className={`scroll-reveal ${containerClassName}`.trim()}>
      <span className={`scroll-reveal-text ${textClassName}`.trim()}>{splitText}</span>
    </Element>
  )
}
