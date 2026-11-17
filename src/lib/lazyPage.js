import { lazy } from 'react'

/**
 * EVERY SCREEN LOADS ON ITS OWN (17 Nov, owner: lazy loading for every page). The till downloads the
 * shell first and each screen only when it is opened; the service worker keeps them all, so this
 * still works with the internet off.
 *
 * One trap: a till left open across a deploy asks for a screen file of the OLD version, which the new
 * deploy no longer serves. Then the page is reloaded once onto the new version -- the basket and any
 * unsent sales are kept in storage, so nothing is lost -- and only a second failure is an error.
 */
const RELOADED = 'pos.reloadedForPage'

export function lazyPage(load, name = 'default') {
  return lazy(() => load().then(
    m => {
      try { sessionStorage.removeItem(RELOADED) } catch { /* no storage: nothing to clear */ }
      return { default: m[name] }
    },
    err => {
      let tried = true
      try { tried = sessionStorage.getItem(RELOADED) === '1'; sessionStorage.setItem(RELOADED, '1') } catch { /* no storage */ }
      if (!tried) {
        window.location.reload()
        return new Promise(() => {})   // the reload takes over; never settle
      }
      throw err
    }
  ))
}

/** Fetch the screens a cashier opens first, while the till is idle, so the first tap is instant. */
export function warmUp(loads) {
  const go = () => loads.forEach(l => l().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 4000 })
  else setTimeout(go, 1500)
}
