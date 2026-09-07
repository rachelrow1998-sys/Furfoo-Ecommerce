import { useCallback, useLayoutEffect, useRef } from 'react'
import Lenis from 'lenis'
import './ScrollStack.css'

export function ScrollStackItem({ children, itemClassName = '' }) {
  return <div className={`scroll-stack-card ${itemClassName}`.trim()}>{children}</div>
}

export default function ScrollStack({
  children,
  className = '',
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = '20%',
  scaleEndPosition = '10%',
  baseScale = 0.85,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = false,
  onStackComplete,
}) {
  const scrollerRef = useRef(null)
  const stackCompletedRef = useRef(false)
  const animationFrameRef = useRef(null)
  const lenisRef = useRef(null)
  const cardsRef = useRef([])
  const elementOffsetsRef = useRef(new Map())
  const lastTransformsRef = useRef(new Map())
  const isUpdatingRef = useRef(false)

  const calculateProgress = useCallback((scrollTop, start, end) => {
    if (scrollTop < start) return 0
    if (scrollTop > end) return 1
    return (scrollTop - start) / (end - start)
  }, [])

  const parsePosition = useCallback((value, containerHeight) => {
    if (typeof value === 'string' && value.includes('%')) {
      return (parseFloat(value) / 100) * containerHeight
    }
    return parseFloat(value)
  }, [])

  const getScrollData = useCallback(() => {
    if (useWindowScroll) {
      return { scrollTop: window.scrollY, containerHeight: window.innerHeight }
    }

    const scroller = scrollerRef.current
    return { scrollTop: scroller.scrollTop, containerHeight: scroller.clientHeight }
  }, [useWindowScroll])

  const getElementOffset = useCallback((element) => {
    const cachedOffset = elementOffsetsRef.current.get(element)
    if (cachedOffset !== undefined) return cachedOffset
    if (useWindowScroll) return element.getBoundingClientRect().top + window.scrollY
    return element.offsetTop
  }, [useWindowScroll])

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current) return
    isUpdatingRef.current = true

    const { scrollTop, containerHeight } = getScrollData()
    const stackPositionPx = parsePosition(stackPosition, containerHeight)
    const scaleEndPositionPx = parsePosition(scaleEndPosition, containerHeight)
    const endElement = scrollerRef.current?.querySelector('.scroll-stack-end')
    const endElementTop = endElement ? getElementOffset(endElement) : 0

    let topCardIndex = 0
    if (blurAmount) {
      cardsRef.current.forEach((card, index) => {
        const trigger = getElementOffset(card) - stackPositionPx - itemStackDistance * index
        if (scrollTop >= trigger) topCardIndex = index
      })
    }

    cardsRef.current.forEach((card, index) => {
      const cardTop = getElementOffset(card)
      const triggerStart = cardTop - stackPositionPx - itemStackDistance * index
      const triggerEnd = cardTop - scaleEndPositionPx
      const pinEnd = endElementTop - containerHeight / 2
      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd)
      const scale = 1 - scaleProgress * (1 - (baseScale + index * itemScale))
      const rotation = index * rotationAmount * scaleProgress
      const blur = index < topCardIndex ? (topCardIndex - index) * blurAmount : 0

      let translateY = 0
      if (scrollTop >= triggerStart && scrollTop <= pinEnd) {
        translateY = scrollTop - cardTop + stackPositionPx + itemStackDistance * index
      } else if (scrollTop > pinEnd) {
        translateY = pinEnd - cardTop + stackPositionPx + itemStackDistance * index
      }

      const next = {
        translateY: Math.round(translateY * 100) / 100,
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
      }
      const previous = lastTransformsRef.current.get(index)
      const changed = !previous
        || Math.abs(previous.translateY - next.translateY) > 0.1
        || Math.abs(previous.scale - next.scale) > 0.001
        || Math.abs(previous.rotation - next.rotation) > 0.1
        || Math.abs(previous.blur - next.blur) > 0.1

      if (changed) {
        card.style.transform = `translate3d(0, ${next.translateY}px, 0) scale(${next.scale}) rotate(${next.rotation}deg)`
        card.style.filter = next.blur ? `blur(${next.blur}px)` : ''
        lastTransformsRef.current.set(index, next)
      }

      if (index === cardsRef.current.length - 1) {
        const isInView = scrollTop >= triggerStart && scrollTop <= pinEnd
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true
          onStackComplete?.()
        } else if (!isInView) {
          stackCompletedRef.current = false
        }
      }
    })

    isUpdatingRef.current = false
  }, [baseScale, blurAmount, calculateProgress, getElementOffset, getScrollData, itemScale, itemStackDistance, onStackComplete, parsePosition, rotationAmount, scaleEndPosition, stackPosition])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined

    const cards = Array.from(scroller.querySelectorAll('.scroll-stack-card'))
    cardsRef.current = cards
    cards.forEach((card, index) => {
      card.style.marginBottom = index < cards.length - 1 ? `${itemDistance}px` : '0px'
    })

    const endElement = scroller.querySelector('.scroll-stack-end')
    ;[...cards, endElement].filter(Boolean).forEach((element) => {
      const offset = useWindowScroll
        ? element.getBoundingClientRect().top + window.scrollY
        : element.offsetTop
      elementOffsetsRef.current.set(element, offset)
    })

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return undefined

    const lenis = useWindowScroll
      ? new Lenis({ duration: 1.2, smoothWheel: true, touchMultiplier: 2, lerp: 0.1 })
      : new Lenis({
          wrapper: scroller,
          content: scroller.querySelector('.scroll-stack-inner'),
          duration: 1.2,
          smoothWheel: true,
          touchMultiplier: 2,
          lerp: 0.1,
        })

    lenis.on('scroll', updateCardTransforms)
    const raf = (time) => {
      lenis.raf(time)
      animationFrameRef.current = requestAnimationFrame(raf)
    }
    animationFrameRef.current = requestAnimationFrame(raf)
    lenisRef.current = lenis
    updateCardTransforms()

    const refresh = () => updateCardTransforms()
    window.addEventListener('resize', refresh)

    return () => {
      window.removeEventListener('resize', refresh)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      lenis.destroy()
      cards.forEach((card) => {
        card.style.transform = ''
        card.style.filter = ''
      })
      lenisRef.current = null
      cardsRef.current = []
      elementOffsetsRef.current.clear()
      lastTransformsRef.current.clear()
      stackCompletedRef.current = false
      isUpdatingRef.current = false
    }
  }, [itemDistance, updateCardTransforms, useWindowScroll])

  return (
    <div
      className={`scroll-stack-scroller${useWindowScroll ? ' scroll-stack-scroller--window' : ''} ${className}`.trim()}
      ref={scrollerRef}
    >
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" aria-hidden="true" />
      </div>
    </div>
  )
}
