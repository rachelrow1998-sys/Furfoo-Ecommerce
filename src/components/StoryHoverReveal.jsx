import { useEffect, useRef, useState } from 'react'
import './StoryHoverReveal.css'

// Share of the gap to the pointer the mask closes each 60fps frame. Low enough
// that the reveal trails the cursor instead of being pinned to it.
const FOLLOW = 0.17
// Same idea for the open/close progress. Closing is a touch quicker so the
// frame settles back to the dog without lingering.
const OPEN = 0.13
const CLOSE = 0.18
// Mask diameter as a share of the longest edge of the frame. At 4:5 this is
// wide enough to show the cat's head and harness in one look.
const LENS_RATIO = 0.76
// Below these the animation has arrived and the loop parks itself.
const SETTLED_PX = 0.3
const SETTLED_OPEN = 0.002
// A tap on a touch screen holds the reveal open this long before it closes.
const TAP_HOLD = 1100

/**
 * Two photos shot on the same set, stacked in the same box. The second one is
 * only ever painted inside a soft circular mask that follows the pointer, so it
 * reads as the cursor uncovering the cat rather than the two images swapping.
 *
 * Both layers are laid out identically and neither is ever scaled: the mask is
 * a fixed-size element that is translated to the pointer, and the photo inside
 * it carries the exact opposite translation, which pins it to the frame. The
 * mask opens and closes on its own `mask-size` instead, so the photo is never
 * rasterised at anything but its natural scale. Per frame that leaves two
 * transforms and the mask's size, and the loop stops once they have arrived.
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
  const [active, setActive] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    const lens = lensRef.current
    const inner = innerRef.current
    if (!frame || !lens || !inner || !revealSrc) return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // x/y is where the mask is, tx/ty where it is headed; open is the same pair
    // collapsed onto one axis for the opening animation.
    const state = { x: 0, y: 0, tx: 0, ty: 0, open: 0, openTarget: 0, half: 0 }
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
    }

    const draw = (now) => {
      const delta = last ? Math.min(50, now - last) : 16.7
      last = now
      // Frame-rate independent lerp, so a 120Hz screen eases at the same speed.
      const step = (rate) => (reduceMotion ? 1 : 1 - Math.pow(1 - rate, delta / 16.7))

      const follow = step(FOLLOW)
      state.x += (state.tx - state.x) * follow
      state.y += (state.ty - state.y) * follow
      state.open += (state.openTarget - state.open) * step(state.openTarget > state.open ? OPEN : CLOSE)

      const left = state.x - state.half
      const top = state.y - state.half
      const size = `${(state.open * 100).toFixed(2)}%`

      lens.style.transform = `translate3d(${left}px, ${top}px, 0) translateZ(0)`
      lens.style.maskSize = `${size} ${size}`
      lens.style.webkitMaskSize = `${size} ${size}`
      // A percentage mask is degenerate at the very bottom of its range, so the
      // first sliver of the opening rides in on opacity instead.
      lens.style.opacity = `${Math.min(1, state.open * 8)}`
      // Exactly the opposite move: the cat stays welded to the frame.
      inner.style.transform = `translate3d(${-left}px, ${-top}px, 0)`

      const arrived = Math.abs(state.tx - state.x) < SETTLED_PX &&
        Math.abs(state.ty - state.y) < SETTLED_PX &&
        Math.abs(state.openTarget - state.open) < SETTLED_OPEN

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
      }
      run()
    }

    const open = (clientX, clientY) => {
      measure()
      // Re-entering somewhere else should not sweep the mask across the photo.
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

    {revealSrc && <div className="story-reveal__lens" ref={lensRef} aria-hidden={!active}>
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
    </div>}
  </div>
}
