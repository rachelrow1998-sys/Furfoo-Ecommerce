/**
 * Thin client for the storefront service.
 *
 * Every call returns parsed JSON or throws a StorefrontError carrying the
 * service's own `code` and `details`, so a page can tell "sold out" from "the
 * POS is down" without parsing prose.
 */

import { STOREFRONT_API, isStorefrontApiConfigured } from '../config/storefront'

export class StorefrontError extends Error {
  constructor(message, { code = 'request_failed', status = 0, details = null } = {}) {
    super(message)
    this.name = 'StorefrontError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  if (!isStorefrontApiConfigured) {
    throw new StorefrontError('The shop API is not configured.', { code: 'api_not_configured' })
  }

  let response
  try {
    response = await fetch(`${STOREFRONT_API}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new StorefrontError('Could not reach the shop. Check your connection and try again.', { code: 'network_error' })
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok === false) {
    throw new StorefrontError(payload?.error || `The shop answered ${response.status}.`, {
      code: payload?.code || 'request_failed',
      status: response.status,
      details: payload?.details || null,
    })
  }
  return payload
}

export function fetchCatalog({ signal } = {}) {
  return request('/api/storefront/catalog', { signal })
}

export function fetchQuote(items, { signal } = {}) {
  return request('/api/storefront/quote', { method: 'POST', body: { items }, signal })
}

export function createCheckout(payload, { signal } = {}) {
  return request('/api/storefront/checkout', { method: 'POST', body: payload, signal })
}

export function fetchOrder(id, { signal } = {}) {
  return request(`/api/storefront/orders/${encodeURIComponent(id)}`, { signal })
}
