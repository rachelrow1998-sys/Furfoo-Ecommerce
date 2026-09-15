import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let lenis = null
let tickerCallback = null
const virtualScrollHooks = new Set()

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Single page-wide Lenis instance: every wheel/touch impulse is eased into the
 * scroll position instead of being applied to it, which is what gives the long
 * inertial glide. GSAP drives the frame loop so ScrollTrigger and Lenis always
 * read the same scroll value within a frame — otherwise pinned sections and
 * reveals lag a frame behind the page.
 */
export function initSmoothScroll() {
  if (lenis || typeof window === 'undefined' || prefersReducedMotion()) return lenis

  lenis = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 1,
    smoothWheel: true,
    // Touch devices already provide native inertia; syncing it tends to feel
    // heavy and breaks pull-to-refresh.
    syncTouch: false,
    autoRaf: false,
    allowNestedScroll: true,
    virtualScroll: (data) => {
      for (const hook of virtualScrollHooks) {
        if (hook(data) === false) return false
      }
      return true
    },
  })

  lenis.on('scroll', ScrollTrigger.update)

  tickerCallback = (time) => lenis.raf(time * 1000)
  gsap.ticker.add(tickerCallback)
  gsap.ticker.lagSmoothing(0)

  return lenis
}

export function destroySmoothScroll() {
  if (!lenis) return
  if (tickerCallback) gsap.ticker.remove(tickerCallback)
  gsap.ticker.lagSmoothing(500, 33)
  lenis.destroy()
  lenis = null
  tickerCallback = null
}

export function getSmoothScroll() {
  return lenis
}

/**
 * Inspect (and optionally swallow) raw scroll impulses before Lenis consumes
 * them. Return `false` from the hook to cancel that impulse.
 */
export function onVirtualScroll(hook) {
  virtualScrollHooks.add(hook)
  return () => { virtualScrollHooks.delete(hook) }
}

/**
 * Both paths honour `scroll-margin-top` on the target (Lenis reads it too), so
 * sections stop below the fixed navbar without any extra offset here.
 */
export function scrollToTarget(target, { offset = 0, immediate = false } = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset, immediate, force: true })
    return
  }

  const behavior = immediate ? 'auto' : 'smooth'

  if (typeof target === 'number') {
    window.scrollTo({ top: target + offset, behavior })
    return
  }

  const element = typeof target === 'string' ? document.querySelector(target) : target
  element?.scrollIntoView({ behavior, block: 'start' })
}

/** Freeze the page behind overlays (drawer, modal, hero intro). */
export function pausePageScroll() {
  lenis?.stop()
}

export function resumePageScroll() {
  lenis?.start()
}
