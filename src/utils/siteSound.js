export const SITE_SOUND_KEY = 'furfoo_hachi_sound_enabled'
export const SITE_SOUND_EVENT = 'furfoo:site-sound-change'

export function isSiteSoundEnabled(fallback = true) {
  const stored = localStorage.getItem(SITE_SOUND_KEY)
  return stored === null ? fallback : stored === 'true'
}

export function setSiteSoundEnabled(enabled) {
  const next = Boolean(enabled)
  localStorage.setItem(SITE_SOUND_KEY, String(next))
  window.dispatchEvent(new CustomEvent(SITE_SOUND_EVENT, { detail: { enabled: next } }))
  return next
}

export function subscribeSiteSound(listener) {
  const handleChange = event => listener(Boolean(event.detail?.enabled))
  window.addEventListener(SITE_SOUND_EVENT, handleChange)
  return () => window.removeEventListener(SITE_SOUND_EVENT, handleChange)
}

export function playSiteSound(audio, { restart = true, startAt = 0 } = {}) {
  if (!audio || !isSiteSoundEnabled()) return false
  if (restart) {
    audio.pause()
    try { audio.currentTime = Math.max(0, startAt) } catch { /* Audio is still at its initial position. */ }
  }
  audio.muted = false
  void audio.play().catch(() => {})
  return true
}

export function stopSiteSound(audio) {
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
}
