import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SHOP_SETTINGS, isStorefrontApiConfigured } from '../config/storefront'
import { fetchCatalog } from '../lib/storefrontApi'
import { mergeCatalog } from '../lib/catalog'
import { products as fallbackProducts } from '../data/products'

/**
 * The shop's product list, as the POS currently has it.
 *
 * Stock changes every time something sells at the counter, so the list is
 * re-read on an interval and whenever the tab comes back into view. A failed
 * refresh keeps the products already on screen and marks them stale rather than
 * emptying the shop.
 */

const CatalogContext = createContext(null)
const REFRESH_INTERVAL_MS = 60_000

const FALLBACK_STATE = {
  products: fallbackProducts,
  settings: DEFAULT_SHOP_SETTINGS,
  source: 'fallback',
  status: 'ready',
  stale: false,
  error: null,
  updatedAt: null,
}

export function CatalogProvider({ children }) {
  const [state, setState] = useState(() => (
    isStorefrontApiConfigured
      ? { ...FALLBACK_STATE, products: [], source: 'live', status: 'loading' }
      : FALLBACK_STATE
  ))
  const inFlight = useRef(null)

  const load = useCallback(async () => {
    if (!isStorefrontApiConfigured) return
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    try {
      const payload = await fetchCatalog({ signal: controller.signal })
      setState({
        products: mergeCatalog(payload.products || []),
        settings: payload.settings || DEFAULT_SHOP_SETTINGS,
        source: 'live',
        status: 'ready',
        stale: Boolean(payload.stale),
        error: null,
        updatedAt: payload.fetchedAt || new Date().toISOString(),
      })
    } catch (error) {
      if (error.name === 'AbortError') return
      // Keep whatever is already on screen; an empty shop is worse than an old
      // one, and checkout re-checks stock against the POS anyway.
      setState(current => (
        current.products.length
          ? { ...current, stale: true, error: error.message }
          : { ...FALLBACK_STATE, source: 'fallback', stale: true, error: error.message }
      ))
    } finally {
      if (inFlight.current === controller) inFlight.current = null
    }
  }, [])

  useEffect(() => {
    if (!isStorefrontApiConfigured) return undefined
    load()

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, REFRESH_INTERVAL_MS)

    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      inFlight.current?.abort()
    }
  }, [load])

  const value = useMemo(() => ({ ...state, refresh: load, isLive: state.source === 'live' }), [state, load])
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export const useCatalog = () => useContext(CatalogContext) || FALLBACK_STATE
