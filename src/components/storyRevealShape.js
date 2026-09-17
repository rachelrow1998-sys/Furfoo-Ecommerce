/**
 * The reveal's silhouette: a stretched droplet, rounded at both ends, its
 * thickness swelling and narrowing along its length.
 *
 * Built as the envelope of a chain of circles running down a centreline. The
 * naive offset — step along the centreline and go out by r along the normal —
 * is only correct where the radius is constant; where it changes, that offset
 * pinches the ends into corners. The envelope condition is u · c' = -r', so the
 * contact direction leans along the tangent by exactly as much as the radius is
 * changing, which is what keeps the ends round and the waists smooth.
 *
 * One outline serves two consumers: it is baked into an SVG for the CSS mask,
 * and walked again on the canvas to draw the ring that hugs it. They have to be
 * the same shape or the ring floats off the reveal, so neither gets its own copy.
 *
 * The leading end is at -x and the trailing end — the one the wake leaves from —
 * at +x, which is the direction the element is rotated to point.
 */

// Radius and centreline drift, as fractions of the blob's thickness, at evenly
// spaced stations from the leading end to the trailing one.
const RADII = [0.45, 0.4, 0.33, 0.39, 0.3, 0.26]
const DRIFT = [0, -0.02, 0.02, -0.04, 0, 0.03]
const LENGTH = 2.1
const SAMPLES = 220
const CAP_STEPS = 30
// Margin around the blob inside its tile. Without it the mask's feather is cut
// off flat at the tile edge, which shows as a hard line along the blob.
const PAD = 0.09
const FEATHER = 2.4

const catmull = (points, t) => {
  const n = points.length - 1
  const scaled = Math.min(Math.max(t, 0), 1) * n
  const i = Math.min(Math.floor(scaled), n - 1)
  const f = scaled - i
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[Math.min(n, i + 2)]
  return 0.5 * (
    2 * p1 +
    (p2 - p0) * f +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f +
    (3 * p1 - p0 - 3 * p2 + p3) * f * f * f
  )
}

const centreX = (s) => s * LENGTH
const centreY = (s) => catmull(DRIFT, s)
const radiusAt = (s) => catmull(RADII, s)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

const tangentAt = (s) => {
  const a = Math.max(0, s - 0.002)
  const b = Math.min(1, s + 0.002)
  const dx = centreX(b) - centreX(a)
  const dy = centreY(b) - centreY(a)
  const length = Math.hypot(dx, dy) || 1
  return [dx / length, dy / length]
}

const envelope = () => {
  const upper = []
  const lower = []
  const d = 0.0015

  for (let i = 0; i <= SAMPLES; i++) {
    const s = i / SAMPLES
    const a = Math.max(0, s - d)
    const b = Math.min(1, s + d)
    const dx = centreX(b) - centreX(a)
    const dy = centreY(b) - centreY(a)
    const speed = Math.hypot(dx, dy) || 1e-6
    const tx = dx / speed
    const ty = dy / speed
    const slope = (radiusAt(b) - radiusAt(a)) / (b - a)
    const arc = speed / (b - a)

    // Clamped: past 1 a circle is swallowed by its neighbour and contributes
    // nothing to the outline.
    const lean = Math.min(1, Math.max(-1, -slope / arc))
    const rise = Math.sqrt(Math.max(0, 1 - lean * lean))
    const r = radiusAt(s)
    const x = centreX(s)
    const y = centreY(s)

    upper.push([x + r * (lean * tx - rise * ty), y + r * (lean * ty + rise * tx)])
    lower.push([x + r * (lean * tx + rise * ty), y + r * (lean * ty - rise * tx)])
  }

  return { upper, lower }
}

/**
 * Round off an end by walking its circle between the two contact points — but
 * not by the shorter arc. Where the radius is shrinking both contacts lean the
 * same way, and the short arc between them cuts back through the body, which
 * shows as a bite taken out of the end. Keep whichever arc sweeps past
 * `outward`, the direction pointing away from the rest of the shape.
 */
const cap = (s, from, to, outward) => {
  const x = centreX(s)
  const y = centreY(s)
  const r = radiusAt(s)
  const a0 = Math.atan2(from[1] - y, from[0] - x)
  const a1 = Math.atan2(to[1] - y, to[0] - x)
  const aim = Math.atan2(outward[1], outward[0])

  const short = wrap(a1 - a0)
  const long = short > 0 ? short - Math.PI * 2 : short + Math.PI * 2
  const strays = (sweep) => Math.abs(wrap(a0 + sweep / 2 - aim))
  const sweep = strays(short) <= strays(long) ? short : long

  const points = []
  for (let i = 1; i < CAP_STEPS; i++) {
    const a = a0 + sweep * (i / CAP_STEPS)
    points.push([x + r * Math.cos(a), y + r * Math.sin(a)])
  }
  return points
}

const build = () => {
  const { upper, lower } = envelope()
  const back = tangentAt(1)
  const front = tangentAt(0)
  const outline = [
    ...upper,
    ...cap(1, upper[upper.length - 1], lower[lower.length - 1], back),
    ...lower.slice().reverse(),
    ...cap(0, lower[0], upper[0], [-front[0], -front[1]]),
  ]

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  // Normalised so the blob's thickness is exactly 1 and it is centred on the
  // origin: a point times the thickness in px is a point on screen.
  const thickness = maxY - minY
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const unit = outline.map(([x, y]) => [(x - midX) / thickness, (y - midY) / thickness])
  const blobAspect = (maxX - minX) / thickness

  const height = 100
  const boxHeight = height * (1 + 2 * PAD)
  const boxWidth = (blobAspect + 2 * PAD) * height
  const path = unit
    .map(([x, y], i) =>
      `${i === 0 ? 'M' : 'L'}${(x * height + boxWidth / 2).toFixed(2)} ${(y * height + boxHeight / 2).toFixed(2)}`)
    .join('') + 'Z'

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth.toFixed(2)}" height="${boxHeight.toFixed(2)}" ` +
    `viewBox="0 0 ${boxWidth.toFixed(2)} ${boxHeight.toFixed(2)}">` +
    `<filter id="f" x="-25%" y="-25%" width="150%" height="150%">` +
    `<feGaussianBlur stdDeviation="${FEATHER}"/></filter>` +
    `<path d="${path}" fill="#fff" filter="url(#f)"/></svg>`

  return {
    outline: unit,
    // The tile's own proportions, which the mask element's box has to match.
    boxAspect: boxWidth / boxHeight,
    // The blob's thickness as a share of that box height.
    thickness: height / boxHeight,
    mask: `url("data:image/svg+xml,${encodeURIComponent(svg)
      .replace(/%20/g, ' ')
      .replace(/%3D/g, '=')
      .replace(/%3A/g, ':')
      .replace(/%2F/g, '/')}")`,
  }
}

export const SHAPE = build()
