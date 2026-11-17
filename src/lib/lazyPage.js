import { lazy } from 'react'
import ScreenUnavailable from '../components/ScreenUnavailable.jsx'

/**
 * EVERY SCREEN LOADS ON ITS OWN (17 Nov, owner: lazy loading for every page). The till downloads the
 * shell first and each screen only when it is opened; the service worker keeps them all, so this
 * still works with the internet off.
 *
 * One trap: a till left open across a deploy asks for a screen file of the OLD version, which the new
 * deploy no longer serves. Then the page is reloaded once onto the new version -- the basket and any
 * unsent sales are kept in storage, so nothing is lost -- and only a second failure is an error.
 *
 * And one more (17 Nov): with the internet OFF there is no new version to reload onto, and a reload
 * would put the browser's own "no internet" page where the till was. Offline, a screen that cannot
 * be fetched shows ScreenUnavailable instead, which reloads by itself when the line returns.
 */
const RELOADED = 'pos.reloadedForPage'

export function lazyPage(load, name = 'default') {
  return lazy(() => load().then(
    m => {
      try { sessionStorage.removeItem(RELOADED) } catch { /* no storage: nothing to clear */ }
      return { default: m[name] }
    },
    err => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return { default: ScreenUnavailable }
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

/**
 * Fetch the screens while the till is idle: the ones a cashier opens first so the first tap is
 * instant, then EVERY other one, so the whole till is on the device before the internet can drop.
 * (17 Nov: only six were fetched, and Sync -- the screen opened precisely when the line is down --
 * was not one of them.)
 */
export function warmUp(first, rest = []) {
  const fetchAll = loads => loads.forEach(l => l().catch(() => {}))
  const whenIdle = (fn, timeout) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout }) : setTimeout(fn, Math.min(timeout, 1500)))
  whenIdle(() => { fetchAll(first); whenIdle(() => fetchAll(rest), 6000) }, 4000)
}
