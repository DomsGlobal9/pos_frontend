import { registerSW } from 'virtual:pwa-register'

/**
 * A TILL LEFT OPEN ALL DAY STILL GETS UPDATES -- but never in the middle of a bill.
 *
 * Found live 7 Oct: after a deploy the till kept running the old screens until someone reloaded,
 * because the browser only looks for a new version when the page loads, and a till is loaded once and
 * left open for days. So: look every 15 minutes, and when a new version is waiting, put it in only
 * when nothing is in progress -- an empty basket, no sheet open, not part-way through a return or an
 * exchange. Until then the header says a new version is ready, with a button to take it now.
 *
 * The basket and any unsent sales are kept in storage, so even "Update now" mid-bill loses nothing;
 * waiting for idle just spares the cashier a flicker in front of a customer.
 */
const CHECK_EVERY_MS = 15 * 60 * 1000
const IDLE_CHECK_MS = 10 * 1000
let ready = false

const updateSW = registerSW({
  onNeedRefresh() {
    ready = true
    window.dispatchEvent(new Event('pos:update-ready'))
  },
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update().catch(() => {}), CHECK_EVERY_MS)
  }
})

/** Take the new version now (the header's button), or by itself once idle. */
export function applyUpdate() {
  updateSW(true)
}

export const updateReady = () => ready

/** Nothing is in progress at this till, so swapping the screens under it disturbs no one. */
export function tillIsIdle() {
  try {
    const basket = JSON.parse(localStorage.getItem('pos.basket.v2') ?? '{}')
    if ((basket.lines ?? []).length > 0) return false
  } catch { /* unreadable storage: treat as busy rather than risk it */ return false }
  if (document.querySelector('[role="dialog"]')) return false
  if (/\/(return|exchange)$/.test(location.pathname)) return false
  return true
}

setInterval(() => { if (ready && tillIsIdle()) applyUpdate() }, IDLE_CHECK_MS)
