export const HACHI_EVENTS = ['hachi_opened', 'hachi_closed', 'hachi_welcome_clicked', 'hachi_quiz_started', 'hachi_quiz_completed', 'hachi_product_recommended', 'hachi_product_clicked', 'hachi_whatsapp_clicked', 'hachi_adoption_clicked', 'hachi_sound_toggled', 'hachi_prompt_dismissed']

export function trackHachiEvent(eventName, payload = {}) {
  if (import.meta.env.DEV && HACHI_EVENTS.includes(eventName)) console.info(`[Hachi] ${eventName}`, payload)
}

export function whatsappUrl(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function hasUrgentHealthTerms(message) {
  return /bleed|open wound|difficulty breathing|can't breathe|cannot breathe|severe swelling|collapse|seizure|extreme letharg|persistent vomit|cannot stand|can't stand|serious pain/i.test(message)
}

export async function askHachi(message, context = {}) {
  // Future AI API integration belongs here. Never place provider keys in the frontend.
  return { unsupported: true, message, context }
}

export async function sendMessageToHachi(message) {
  return askHachi(message, { source: 'website-pet' })
}
