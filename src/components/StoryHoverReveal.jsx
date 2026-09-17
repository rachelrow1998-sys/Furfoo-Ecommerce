import { useEffect, useRef, useState } from 'react'
import './StoryHoverReveal.css'

// Share of the gap to the pointer the mask closes each 60fps frame. Low enough
// that the reveal trails the cursor instead of being pinned to it.
const FOLLOW = 0.17
// Same idea for the open/close progress. Closing is a touch quicker so the
// frame settles back to the dog without lingering.
const OPEN = 0.13
const CLOSE = 0.18
// The head's short axis as a share of the longest edge of the frame. The mask
// is the head and nothing else, so the mask box is exactly the reveal.
const LENS_RATIO = 0.1
// How much longer the head is along the line of travel than across it. A circle
// meets its tail at the side of a curve, which is the join that reads wrong;
// stretched, the wake leaves from the narrow trailing end.
const HEAD_STRETCH = 2.1
// Below this much travel in a frame the heading is left alone, so the head does
// not swing on the jitter of an almost-still cursor.
const HEADING_MIN = 0.5
const HEADING_TURN = 0.16
// Below these the animation has arrived and the loop parks itself.
const SETTLED_PX = 0.3
const SETTLED_OPEN = 0.002
// A tap on a touch screen holds the reveal open this long before it closes.
const TAP_HOLD = 1100

// The wake is drawn along the path the mask has actually travelled, kept as a
// short history of its recent positions. A chain of springs was the obvious
// build, but its length scales with speed — it curls into a blob when the
// cursor crawls and would whip across the whole photo when it darts. Walking a
// fixed distance back down the real path gives the same tail at any speed.
const TRAIL_HISTORY = 48
// Tail length and the floor below which there is nothing worth drawing, both in
// mask diameters.
const TRAIL_LENGTH = 3.1
const TRAIL_MIN = 0.35
// The path is redrawn at even steps this far apart rather than at the raw frame
// positions. A frame's worth of travel is long enough that its round cap shows
// as a scallop on the edge; resampling short keeps the outline smooth.
const TRAIL_STEP = 9
const TRAIL_MAX_POINTS = 512
// Gap to the pointer, in px, at which the wake is at full strength.
const TRAIL_FULL = 9
// It strikes fast and lingers, rather than easing in and out symmetrically, so
// an ordinary sweep keeps one unbroken wake instead of flickering on and off.
const TRAIL_RISE = 0.5
const TRAIL_FALL = 0.07
const SETTLED_HEAT = 0.004
// Stroke width at the head, as a share of the mask's diameter, tapering to a
// point at the tail.
const TRAIL_WIDTH = 0.27
const TRAIL_TAPER = 1
// Brand red, run hot at the head and deep at the tail, so the wake carries a
// gradient down its length instead of one flat colour. The head is the light
// end, but not so pale that it vanishes against a photo this bright.
const TRAIL_HEAD = [255, 140, 96]
const TRAIL_MID = [216, 42, 46]
const TRAIL_TAIL = [124, 12, 28]
const TRAIL_CORE_ALPHA = 0.9
// A wider, fainter pass under the core, which is what gives it a glow rather
// than a hard edge.
const TRAIL_GLOW_ALPHA = 0.26
const TRAIL_GLOW_WIDTH = 1.9
// The ring around the head, as multiples of its radius: clear through the
// middle so the revealed cat is never tinted, rising to a band that sits just
// outside the reveal's soft edge, then out to nothing.
const HALO_CLEAR = 0.62
const HALO_PEAK = 0.92
const HALO_OUTER = 1.45
const HALO_ALPHA = 0.8
// Retina is worth it on a stroke this thin; past 2x it is only cost.
const MAX_DPR = 2

const TAU = Math.PI * 2

const mix = (from, to, t) => from.map((channel, i) => Math.round(channel + (to[i] - channel) * t))

// One ramp, head to tail, so neighbouring segments never step in colour.
const trailColor = (t, alpha) => {
  const [r, g, b] = t < 0.5
    ? mix(TRAIL_HEAD, TRAIL_MID, t * 2)
    : mix(TRAIL_MID, TRAIL_TAIL, (t - 0.5) * 2)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
 * Together the mask and the wake read as a tadpole: the mask is the head, and
 * the wake trailing off it is the tail. The head is an ellipse stretched along
 * the line of travel and turned to follow it, so the tail leaves from its narrow
 * trailing end rather than off the side of a circle. Turning it means the photo
 * inside carries the inverse rotation as well as the inverse translation, about
 * the same origin.
 *
 * The wake wraps the head in a ring and runs off it into the tail, light at the
 * head and deepening down its length. The ring is clear through the middle, so
 * the cat showing through the reveal is never tinted; only the rim is coloured.
 *
 * The wake is drawn on a canvas beneath the mask, as one tapering stroke down
 * the path the mask has just travelled. Drawing it segment by segment with
 * round joins, rather than as separate dots, is what keeps it continuous at
 * speed, and running the colour ramp off distance along that path rather than
 * off the segment index keeps the gradient even however the cursor moves.
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
  const canvasRef = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const frame = frameRef.current
    const lens = lensRef.current
    const inner = innerRef.current
    const canvas = canvasRef.current
    if (!frame || !lens || !inner || !revealSrc) return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = canvas && !reduceMotion ? canvas.getContext('2d') : null
    // x/y is where the mask is, tx/ty where it is headed; open is the same pair
    // collapsed onto one axis for the opening animation, heat for the wake.
    // `angle` is where the head's trailing end points — behind the motion —
    // eased as an angle. Easing it as a unit vector instead looks equivalent and
    // is not: on an exact reversal the lerp passes through the zero vector, and
    // renormalising a vector a hair short of the old heading puts it straight
    // back, so the head sticks and never turns round.
    const state = {
      x: 0, y: 0, tx: 0, ty: 0, lastX: 0, lastY: 0,
      open: 0, openTarget: 0, heat: 0,
      halfW: 0, halfH: 0, head: 0, angle: Math.PI,
    }
    // Ring buffer of recent mask positions, flat so nothing is allocated per
    // frame. `head` is the next slot to write.
    const history = new Float32Array(TRAIL_HISTORY * 2)
    let historyCount = 0
    let historyHead = 0

    const rememberPoint = (x, y) => {
      history[historyHead * 2] = x
      history[historyHead * 2 + 1] = y
      historyHead = (historyHead + 1) % TRAIL_HISTORY
      if (historyCount < TRAIL_HISTORY) historyCount++
    }

    const forgetPath = () => {
      historyCount = 0
      historyHead = 0
    }

    // `back` counts from the newest point.
    const pointX = (back) => history[((historyHead - 1 - back + TRAIL_HISTORY * 2) % TRAIL_HISTORY) * 2]
    const pointY = (back) => history[((historyHead - 1 - back + TRAIL_HISTORY * 2) % TRAIL_HISTORY) * 2 + 1]
    let rect = frame.getBoundingClientRect()
    let frameId = 0
    let last = 0
    let holdTimer = 0
    let painted = false

    const readRect = () => { rect = frame.getBoundingClientRect() }

    const measure = () => {
      readRect()
      const short = Math.round(Math.max(rect.width, rect.height) * LENS_RATIO)
      const long = Math.round(short * HEAD_STRETCH)
      state.halfW = long / 2
      state.halfH = short / 2
      state.head = short
      frame.style.setProperty('--lens-w', `${long}px`)
      frame.style.setProperty('--lens-h', `${short}px`)
      frame.style.setProperty('--frame-w', `${rect.width}px`)
      frame.style.setProperty('--frame-h', `${rect.height}px`)

      if (!context) return
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const clearTrail = () => {
      if (!context || !painted) return
      context.clearRect(0, 0, rect.width, rect.height)
      painted = false
    }

    // Walk back down the travelled path, stopping at a fixed distance, and
    // resample it at even steps so the taper changes gradually between points.
    // Reused between frames; `path` holds x, y, distance triples.
    const path = new Float32Array(TRAIL_MAX_POINTS * 3)
    let pathPoints = 0

    const addPoint = (x, y, distance) => {
      if (pathPoints >= TRAIL_MAX_POINTS) return false
      path[pathPoints * 3] = x
      path[pathPoints * 3 + 1] = y
      path[pathPoints * 3 + 2] = distance
      pathPoints++
      return true
    }

    const tracePath = () => {
      pathPoints = 0
      if (historyCount < 2) return 0

      const limit = state.head * TRAIL_LENGTH
      let previousX = pointX(0)
      let previousY = pointY(0)
      let walked = 0
      let nextStep = TRAIL_STEP
      addPoint(previousX, previousY, 0)

      for (let back = 1; back < historyCount; back++) {
        const x = pointX(back)
        const y = pointY(back)
        const span = Math.hypot(x - previousX, y - previousY)
        // Frames where the cursor held still add no length, so they are skipped
        // rather than piling duplicate points onto the stroke.
        if (span < 0.01) continue

        while (nextStep <= walked + span) {
          const reach = Math.min(nextStep, limit)
          const cut = (reach - walked) / span
          if (!addPoint(previousX + (x - previousX) * cut, previousY + (y - previousY) * cut, reach)) {
            return reach
          }
          if (reach >= limit) return limit
          nextStep += TRAIL_STEP
        }

        walked += span
        previousX = x
        previousY = y
      }

      return walked
    }

    // The ring that wraps the head. A radial fill rather than a stroke, so it
    // can be clear across the reveal and only colour the rim.
    const paintHalo = (angle) => {
      const radius = state.halfH
      const outer = radius * HALO_OUTER
      const [r, g, b] = TRAIL_HEAD

      // Drawn as a circle in a space that is turned and stretched to match the
      // head, so the ring hugs the ellipse instead of sitting round it.
      context.save()
      context.translate(state.x, state.y)
      context.rotate(angle)
      context.scale(HEAD_STRETCH, 1)

      const ring = context.createRadialGradient(0, 0, 0, 0, 0, outer)
      ring.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
      ring.addColorStop(HALO_CLEAR / HALO_OUTER, `rgba(${r}, ${g}, ${b}, 0)`)
      ring.addColorStop(HALO_PEAK / HALO_OUTER, `rgba(${r}, ${g}, ${b}, ${HALO_ALPHA})`)
      ring.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

      context.fillStyle = ring
      context.beginPath()
      context.arc(0, 0, outer, 0, TAU)
      context.fill()
      context.restore()
    }

    // Segment by segment, with round joins and a colour that moves a little
    // each step, so the seams disappear into one stroke. Colour and taper come
    // off distance along the path, which keeps the ramp even whatever the
    // spacing of the underlying points.
    //
    // The ring belongs to the reveal and the tail to the motion, so the canvas
    // carries only the open/close fade and the tail's own alpha carries the
    // speed — otherwise the ring would blink out whenever the cursor rested.
    const paintTrail = (angle) => {
      if (!context) return
      context.clearRect(0, 0, rect.width, rect.height)
      paintHalo(angle)

      const total = tracePath()
      if (total >= state.head * TRAIL_MIN && pathPoints >= 2 && state.heat > 0.002) {
        context.lineCap = 'round'
        context.lineJoin = 'round'

        for (const pass of [
          { width: TRAIL_GLOW_WIDTH, alpha: TRAIL_GLOW_ALPHA },
          { width: 1, alpha: TRAIL_CORE_ALPHA },
        ]) {
          for (let i = 0; i < pathPoints - 1; i++) {
            const t = path[i * 3 + 2] / total
            const taper = Math.pow(1 - t, TRAIL_TAPER)
            const width = state.head * TRAIL_WIDTH * taper * pass.width
            if (width < 0.4) continue

            context.beginPath()
            context.moveTo(path[i * 3], path[i * 3 + 1])
            context.lineTo(path[(i + 1) * 3], path[(i + 1) * 3 + 1])
            context.lineWidth = width
            context.strokeStyle = trailColor(t, pass.alpha * taper * state.heat)
            context.stroke()
          }
        }
      }

      painted = true
    }

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

      const movedX = state.x - state.lastX
      const movedY = state.y - state.lastY
      const moved = Math.hypot(movedX, movedY)
      if (moved > HEADING_MIN) {
        const target = Math.atan2(-movedY, -movedX)
        // Wrapped into [-pi, pi] so the head always swings the short way round.
        let delta = target - state.angle
        delta -= TAU * Math.floor((delta + Math.PI) / TAU)
        state.angle += delta * step(HEADING_TURN)
      }
      state.lastX = state.x
      state.lastY = state.y
      const angle = state.angle

      const left = state.x - state.halfW
      const top = state.y - state.halfH
      const size = `${(state.open * 100).toFixed(2)}%`

      lens.style.transform = `translate3d(${left}px, ${top}px, 0) rotate(${angle}rad)`
      lens.style.maskSize = `${size} ${size}`
      lens.style.webkitMaskSize = `${size} ${size}`
      // A percentage mask is degenerate at the very bottom of its range, so the
      // first sliver of the opening rides in on opacity instead.
      lens.style.opacity = `${Math.min(1, state.open * 8)}`
      // Exactly the opposite move, in the opposite order, about the same origin:
      // the two compose to the identity and the cat stays welded to the frame.
      inner.style.transform = `rotate(${-angle}rad) translate3d(${-left}px, ${-top}px, 0)`

      // The gap to the pointer stands in for speed — with a fixed lerp the two
      // are proportional — so the wake only shows while the cursor is moving.
      const heatTarget = state.openTarget === 0 ? 0 : Math.min(1, gap / TRAIL_FULL)
      state.heat += (heatTarget - state.heat) *
        step(heatTarget > state.heat ? TRAIL_RISE : TRAIL_FALL)

      if (context) {
        rememberPoint(state.x, state.y)
        canvas.style.opacity = `${state.open.toFixed(3)}`
        if (state.open > 0.002) paintTrail(angle)
        else clearTrail()
      }

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
        state.lastX = state.tx
        state.lastY = state.ty
        // A settled-but-open reveal keeps its ring: the canvas holds the last
        // frame, and with the loop parked nothing repaints it.
        if (state.openTarget === 0) {
          clearTrail()
          setActive(false)
        }
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
        state.lastX = state.tx
        state.lastY = state.ty
        // Drop the travelled path too, so re-entering somewhere else does not
        // drag a streak across the photo from wherever the cursor left.
        forgetPath()
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
      <canvas className="story-reveal__trail" ref={canvasRef} aria-hidden="true"/>

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
