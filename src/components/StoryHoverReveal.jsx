import { useEffect, useRef, useState } from 'react'
import './StoryHoverReveal.css'

// Share of the gap to the pointer the mask closes each 60fps frame. Low enough
// that the reveal trails the cursor instead of being pinned to it.
const FOLLOW = 0.17
// Same idea for the open/close progress. Closing is a touch quicker so the
// frame settles back to the dog without lingering.
const OPEN = 0.13
const CLOSE = 0.18
// Mask diameter as a share of the longest edge of the frame. Small enough to
// read as a spotlight the cursor carries, rather than half the photo.
const LENS_RATIO = 0.38
// Below these the animation has arrived and the loop parks itself.
const SETTLED_PX = 0.3
const SETTLED_OPEN = 0.002
// A tap on a touch screen holds the reveal open this long before it closes.
const TAP_HOLD = 1100

// The wake. Each link chases the one ahead of it, so the chain strings out when
// the cursor moves and collapses back under the mask when it stops.
const TRAIL_LINKS = 16
// Each link lags its leader by roughly (1 - lead) / lead of the mask's speed,
// so this has to stay low enough that the chain reaches past the mask's own
// radius — otherwise the whole wake hides under the revealed circle.
const TRAIL_LEAD = 0.18
// Gap to the pointer, in px, at which the wake is at full strength.
const TRAIL_FULL = 14
// It strikes fast and lingers, rather than easing in and out symmetrically.
const TRAIL_RISE = 0.45
const TRAIL_FALL = 0.12
const SETTLED_HEAT = 0.004
// Brand red, run hot at the head and deep at the tail, so the wake reads as a
// gradient rather than one flat colour.
const TRAIL_HEAD = [255, 150, 96]
const TRAIL_MID = [216, 42, 46]
const TRAIL_TAIL = [130, 14, 26]
// Sixteen links overlap, so each one stays well short of opaque. The fade is
// deliberately slow off the head: the head rides under the mask, so a straight
// linear ramp would leave only the faintest links showing.
const TRAIL_ALPHA = 0.8
const TRAIL_FADE_CURVE = 0.55
// Link diameter as a share of the mask's, head to tail.
const TRAIL_WIDEST = 0.62
const TRAIL_NARROWEST = 0.14

const mix = (from, to, t) => from.map((channel, i) => Math.round(channel + (to[i] - channel) * t))

/**
 * Two photos shot on the same set, stacked in the same box. The second one is
 * only ever painted inside a soft circular mask that follows the pointer, so it
 * reads as the cursor uncovering the cat rather than the two images swapping.
 *
 * Both layers are laid out identically and neither is ever scaled: the mask is
 * a fixed-size element that is translated to the pointer, and the photo inside
 * it carries the exact opposite translation, which pins it to the frame. The
 * mask opens and closes on its own `mask-size` instead, so the photo is never
 * rasterised at anything but its natural scale.
 *
 * The wake sits under the mask, so it only shows where it reaches past the
 * revealed circle. Its links carry their colour and size from the start and
 * move on transforms alone, which keeps the per-frame work to transforms and
 * two opacities. The loop stops once everything has arrived.
 */
export default function StoryHoverReveal({
  baseSrc,
  baseAlt,
  revealSrc,
  revealAlt,
  onBaseError,
  onRevealError,
}) {
  const frameRef = useRef(null)
  const lensRef = useRef(null)
  const innerRef = useRef(null)
  const trailRef = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    const lens = lensRef.current
    const inner = innerRef.current
    const trail = trailRef.current
    if (!frame || !lens || !inner || !revealSrc) return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // x/y is where the mask is, tx/ty where it is headed; open is the same pair
    // collapsed onto one axis for the opening animation, heat for the wake.
    const state = { x: 0, y: 0, tx: 0, ty: 0, open: 0, openTarget: 0, heat: 0, half: 0 }
    const sparks = trail && !reduceMotion ? Array.from(trail.children) : []
    const links = sparks.map(() => ({ x: 0, y: 0, half: 0 }))
    let rect = frame.getBoundingClientRect()
    let frameId = 0
    let last = 0
    let holdTimer = 0

    const readRect = () => { rect = frame.getBoundingClientRect() }

    const measure = () => {
      readRect()
      const diameter = Math.round(Math.max(rect.width, rect.height) * LENS_RATIO)
      state.half = diameter / 2
      frame.style.setProperty('--lens-size', `${diameter}px`)
      frame.style.setProperty('--frame-w', `${rect.width}px`)
      frame.style.setProperty('--frame-h', `${rect.height}px`)

      sparks.forEach((spark, i) => {
        const t = links.length > 1 ? i / (links.length - 1) : 0
        const size = Math.round(diameter * (TRAIL_WIDEST + (TRAIL_NARROWEST - TRAIL_WIDEST) * t))
        links[i].half = size / 2
        spark.style.width = `${size}px`
        spark.style.height = `${size}px`
      })
    }

    // Colour and fade are fixed per link, so they are written once.
    sparks.forEach((spark, i) => {
      const t = links.length > 1 ? i / (links.length - 1) : 0
      const [r, g, b] = t < 0.5
        ? mix(TRAIL_HEAD, TRAIL_MID, t * 2)
        : mix(TRAIL_MID, TRAIL_TAIL, (t - 0.5) * 2)
      const alpha = TRAIL_ALPHA * Math.pow(1 - t, TRAIL_FADE_CURVE)
      spark.style.backgroundImage = 'radial-gradient(circle closest-side, ' +
        `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)}) 0%, rgba(${r}, ${g}, ${b}, 0) 72%)`
    })

    const draw = (now) => {
      const delta = last ? Math.min(50, now - last) : 16.7
      last = now
      // Frame-rate independent lerp, so a 120Hz screen eases at the same speed.
      const step = (rate) => (reduceMotion ? 1 : 1 - Math.pow(1 - rate, delta / 16.7))

      const gap = Math.hypot(state.tx - state.x, state.ty - state.y)
      const lerp = step(FOLLOW)
      state.x += (state.tx - state.x) * lerp
      state.y += (state.ty - state.y) * lerp
      state.open += (state.openTarget - state.open) * step(state.openTarget > state.open ? OPEN : CLOSE)

      const left = state.x - state.half
      const top = state.y - state.half
      const size = `${(state.open * 100).toFixed(2)}%`

      lens.style.transform = `translate3d(${left}px, ${top}px, 0)`
      lens.style.maskSize = `${size} ${size}`
      lens.style.webkitMaskSize = `${size} ${size}`
      // A percentage mask is degenerate at the very bottom of its range, so the
      // first sliver of the opening rides in on opacity instead.
      lens.style.opacity = `${Math.min(1, state.open * 8)}`
      // Exactly the opposite move: the cat stays welded to the frame.
      inner.style.transform = `translate3d(${-left}px, ${-top}px, 0)`

      // The gap to the pointer stands in for speed — with a fixed lerp the two
      // are proportional — so the wake only shows while the cursor is moving.
      const heatTarget = state.openTarget === 0 ? 0 : Math.min(1, gap / TRAIL_FULL)
      state.heat += (heatTarget - state.heat) *
        step(heatTarget > state.heat ? TRAIL_RISE : TRAIL_FALL)

      let leadX = state.x
      let leadY = state.y
      sparks.forEach((spark, i) => {
        const link = links[i]
        const chase = step(TRAIL_LEAD)
        link.x += (leadX - link.x) * chase
        link.y += (leadY - link.y) * chase
        spark.style.transform =
          `translate3d(${link.x - link.half}px, ${link.y - link.half}px, 0)`
        leadX = link.x
        leadY = link.y
      })

      if (trail) trail.style.opacity = `${(state.heat * state.open).toFixed(3)}`

      const arrived = Math.abs(state.tx - state.x) < SETTLED_PX &&
        Math.abs(state.ty - state.y) < SETTLED_PX &&
        Math.abs(state.openTarget - state.open) < SETTLED_OPEN &&
        Math.abs(heatTarget - state.heat) < SETTLED_HEAT

      if (arrived) {
        // Nothing left to move, so stop burning frames until the pointer does
        // something. A closed mask also drops out of the compositor entirely.
        frameId = 0
        last = 0
        state.x = state.tx
        state.y = state.ty
        if (state.openTarget === 0) setActive(false)
        return
      }

      frameId = requestAnimationFrame(draw)
    }

    const run = () => {
      if (frameId) return
      last = 0
      frameId = requestAnimationFrame(draw)
    }

    const aim = (clientX, clientY, snap) => {
      state.tx = clientX - rect.left
      state.ty = clientY - rect.top
      if (snap) {
        state.x = state.tx
        state.y = state.ty
        // Collapse the wake onto the pointer too, so re-entering somewhere else
        // does not drag a streak across the photo.
        links.forEach((link) => { link.x = state.tx; link.y = state.ty })
        state.heat = 0
      }
      run()
    }

    const open = (clientX, clientY) => {
      measure()
      const snap = state.openTarget === 0
      state.openTarget = 1
      setActive(true)
      aim(clientX, clientY, snap)
    }

    const close = () => {
      state.openTarget = 0
      run()
    }

    const onPointerEnter = (event) => {
      if (event.pointerType !== 'mouse') return
      open(event.clientX, event.clientY)
    }

    const onPointerMove = (event) => {
      if (event.pointerType !== 'mouse') return
      aim(event.clientX, event.clientY, false)
    }

    const onPointerLeave = (event) => {
      if (event.pointerType !== 'mouse') return
      close()
    }

    const onTouchStart = (event) => {
      const touch = event.touches[0]
      if (!touch) return
      window.clearTimeout(holdTimer)
      open(touch.clientX, touch.clientY)
    }

    const onTouchMove = (event) => {
      const touch = event.touches[0]
      if (!touch) return
      aim(touch.clientX, touch.clientY, false)
    }

    // A tap holds the reveal open long enough to be seen before it closes.
    const onTouchEnd = () => {
      window.clearTimeout(holdTimer)
      holdTimer = window.setTimeout(close, TAP_HOLD)
    }

    // The page scrolls under the pointer, so the frame's viewport position only
    // matters while the mask is on screen.
    const onScroll = () => {
      if (state.openTarget || state.open > SETTLED_OPEN) readRect()
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(frame)

    frame.addEventListener('pointerenter', onPointerEnter)
    frame.addEventListener('pointermove', onPointerMove, { passive: true })
    frame.addEventListener('pointerleave', onPointerLeave)
    frame.addEventListener('touchstart', onTouchStart, { passive: true })
    frame.addEventListener('touchmove', onTouchMove, { passive: true })
    frame.addEventListener('touchend', onTouchEnd, { passive: true })
    frame.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      window.clearTimeout(holdTimer)
      observer.disconnect()
      frame.removeEventListener('pointerenter', onPointerEnter)
      frame.removeEventListener('pointermove', onPointerMove)
      frame.removeEventListener('pointerleave', onPointerLeave)
      frame.removeEventListener('touchstart', onTouchStart)
      frame.removeEventListener('touchmove', onTouchMove)
      frame.removeEventListener('touchend', onTouchEnd)
      frame.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [revealSrc])

  return <div
    className={`story-reveal${active ? ' is-active' : ''}`}
    ref={frameRef}
  >
    <img
      className="story-reveal__photo"
      src={baseSrc}
      alt={baseAlt}
      loading="lazy"
      decoding="async"
      draggable="false"
      onError={onBaseError}
    />

    {revealSrc && <>
      <div className="story-reveal__trail" ref={trailRef} aria-hidden="true">
        {Array.from({ length: TRAIL_LINKS }, (_, i) =>
          <span className="story-reveal__spark" key={i}/>)}
      </div>

      <div className="story-reveal__lens" ref={lensRef} aria-hidden={!active}>
        <div className="story-reveal__lens-inner" ref={innerRef}>
          <img
            className="story-reveal__photo"
            src={revealSrc}
            alt={revealAlt}
            loading="lazy"
            decoding="async"
            draggable="false"
            onError={onRevealError}
          />
        </div>
      </div>
    </>}
  </div>
}
