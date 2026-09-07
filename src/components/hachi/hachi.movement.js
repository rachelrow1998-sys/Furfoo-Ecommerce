const restrictedSelector = [
  '[data-hachi-block-zone]', '.navbar', '.cart-drawer.is-open',
  'button', 'a', 'input', 'textarea', 'select', '[role="dialog"]', 'video[controls]',
].join(',')

export function getRestrictedZones(excludeRoot) {
  return [...document.querySelectorAll(restrictedSelector)]
    .filter(element => !excludeRoot?.contains(element) && element.getClientRects().length)
    .map(element => element.getBoundingClientRect())
    .filter(rect => rect.bottom >= -80 && rect.top <= window.innerHeight + 80 && rect.right >= -80 && rect.left <= window.innerWidth + 80)
    .slice(0, 80)
}

export function isPositionBlocked(position, size, zones) {
  const box = { left: position.x, top: position.y, right: position.x + size.width, bottom: position.y + size.height }
  return zones.some(zone => box.left < zone.right && box.right > zone.left && box.top < zone.bottom && box.bottom > zone.top)
}

export function clampPosition(position, size, padding = 16) {
  return {
    x: Math.max(padding, Math.min(window.innerWidth - size.width - padding, position.x)),
    y: Math.max(96, Math.min(window.innerHeight - size.height - padding, position.y)),
  }
}

export function findNearestValidPosition(desired, size, zones, padding = 16) {
  const start = clampPosition(desired, size, padding)
  if (!isPositionBlocked(start, size, zones)) return start
  const horizontalOffsets = [-140, 140, -240, 240, -360, 360]
  const verticalOffsets = [0, -150, -280, 120]
  for (const verticalOffset of verticalOffsets) {
    for (const horizontalOffset of horizontalOffsets) {
      const candidate = clampPosition({ x: start.x + horizontalOffset, y: start.y + verticalOffset }, size, padding)
      if (!isPositionBlocked(candidate, size, zones)) return candidate
    }
  }
  return clampPosition({ x: padding, y: Math.max(110, window.innerHeight * .42) }, size, padding)
}

export function findSectionAnchor(anchor, size, root) {
  const mobile = window.innerWidth <= 700
  const padding = mobile ? 10 : 24
  const left = padding
  const right = window.innerWidth - size.width - padding
  const top = Math.max(110, window.innerHeight * 0.25)
  const bottom = window.innerHeight - size.height - (mobile ? 12 : 22)
  const desired = anchor === 'bottom-left' ? { x: left, y: bottom }
    : anchor === 'top-left' ? { x: left, y: top }
      : anchor === 'top-right' ? { x: right, y: top }
        : { x: right, y: bottom }
  return findNearestValidPosition(desired, size, getRestrictedZones(root), padding)
}
