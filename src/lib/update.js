import { registerSW } from 'virtual:pwa-register'
import { staffToken } from './session.js'

/**
 * A TILL LEFT OPEN ALL DAY STILL GETS UPDATES -- but never in the middle of a bill.
 *
 * Found live 7 Oct: after a deploy the till kept running the old screens until someone reloaded,
 * because the browser only looks for a new version when the page loads, and a till is loaded once and
 * left open for days. So: look every 5 minutes, and again whenever the till comes back into view or
 * back online; when a new version is waiting, put it in only when nothing is in progress -- an empty
 * basket, no sheet open, not part-way through a return or an exchange. Until then the header says a
 * new version is ready, with a button to take it now.
 *
 * 25 Nov (owner: "it's refreshing manually, it should refresh automatically"): with nobody signed in
 * -- the sign-in, PIN, welcome and new-password screens -- there is no bill to protect and no header
 * button to press, so the new version goes in as soon as this tab has been still for 15 seconds and no
 * password is half typed. Opening POS just after a deploy shows the new screens within seconds.
 *
 * The basket and any unsent sales are kept in storage, so even "Update now" mid-bill loses nothing;
 * waiting for idle just spares the cashier a flicker in front of a customer.
 */
const CHECK_EVERY_MS = 5 * 60 * 1000
const IDLE_CHECK_MS = 5 * 1000
const BUSY_AFTER_TOUCH_MS = 2 * 60 * 1000
const SIGNED_OUT_STILL_MS = 15 * 1000
let ready = false
let reg = null
let thisTabTouch = 0   // this tab's own last tap or key (the shared one counts every tab of the shop)

const updateSW = registerSW({
  onNeedRefresh() {
    ready = true
    window.dispatchEvent(new Event('pos:update-ready'))
    if (canGoNow()) applyUpdate()
  },
  onRegisteredSW(_url, registration) {
    reg = registration ?? null
    if (reg) setInterval(lookNow, CHECK_EVERY_MS)
  }
})

/** Ask the server whether a newer version is out. Cheap: the browser only fetches sw.js. */
function lookNow() {
  if (reg && navigator.onLine !== false) reg.update().catch(() => {})
}

/** Take the new version now (the header's button), or by itself once idle. */
export function applyUpdate() {
  asked = true
  updateSW(true)
}

/*
 * Once the new version has taken over, show it. The plugin reloads only when this page already had a
 * version at load; a page opened for the first time on a device (found 25 Nov in a real-build test)
 * was taken over and kept showing the old screens. So we reload ourselves, once, for a version we asked for.
 */
let asked = false
let reloading = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!asked || reloading) return
  reloading = true
  window.location.reload()
})

export const updateReady = () => ready

/** Nothing is in progress at this till, so swapping the screens under it disturbs no one. */
export function tillIsIdle() {
  try {
    const basket = JSON.parse(localStorage.getItem('pos.basket.v2') ?? '{}')
    if ((basket.lines ?? []).length > 0) return false
  } catch { /* unreadable storage: treat as busy rather than risk it */ return false }
  if (document.querySelector('[role="dialog"]')) return false
  if (/\/(return|exchange)$/.test(location.pathname)) return false
  // Touched in the last 2 minutes: someone is at the till (17 Nov, live on sphl: the new version went in
  // the moment a sale completed, and the receipt vanished before it could be printed or sent).
  try {
    if (Date.now() - (Number(localStorage.getItem('pos.lastTouch')) || 0) < BUSY_AFTER_TOUCH_MS) return false
  } catch { /* no storage: the other checks decide */ }
  return true
}

/** Nobody signed in at this tab, it has been still a moment, and no password is half typed. */
function signedOutAndStill() {
  if (staffToken()) return false
  if (Date.now() - thisTabTouch < SIGNED_OUT_STILL_MS) return false
  if ([...document.querySelectorAll('input[type="password"], input[inputmode="numeric"]')].some(i => i.value)) return false
  return true
}

function canGoNow() {
  if (document.visibilityState === 'hidden') return false   // goes in when someone looks
  return signedOutAndStill() || tillIsIdle()
}

const touched = () => { thisTabTouch = Date.now() }
window.addEventListener('pointerdown', touched, true)
window.addEventListener('keydown', touched, true)
// Back in view (a till woken in the morning, a tab switched to) or back online: look at once.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lookNow() })
window.addEventListener('online', lookNow)

setInterval(() => { if (ready && canGoNow()) applyUpdate() }, IDLE_CHECK_MS)
