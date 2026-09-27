/**
 * The basket the cashier is building, held in the browser.
 *
 * Deliberately NOT the authority on what anything costs. The figures here are for the screen only;
 * the server re-reads every price from the database when the sale is written, and what it comes to
 * is what is charged. If the two ever disagree the server wins and the screen re-prices -- which is
 * the whole reason the till never sends a price.
 *
 * THE DRAFT CARRIES ITS ONCE-KEY, and that is not a detail.
 *
 * The first version stored only the lines and made a new key whenever the component mounted. That
 * looked fine until a bill was completed and the page was reloaded before "Next sale" was pressed:
 * the sold basket came back on screen with a BRAND NEW key, so pressing Take payment would have
 * written a second real sale of goods already paid for. The key is the only thing standing between
 * a shop and a double charge, and a key that is regenerated on reload is not standing anywhere.
 *
 * So the key lives and dies with the basket: made once when a basket starts, saved with it, and
 * thrown away only when the sale is saved or the bill is cleared. A reload in the middle of a sale
 * keeps it, which means a resubmission of the same basket REPLAYS rather than duplicates.
 */

const KEY = 'pos.basket.v2'

export function lineTotal(line) {
  return line.pricePaise * line.qty
}

export function basketTotals(lines) {
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)
  // Rounded to whole rupees, matching the server's NEAREST_RUPEE default.
  const whole = Math.floor(subtotal / 100) * 100
  const total = subtotal - whole >= 50 ? whole + 100 : whole
  return { subtotalPaise: subtotal, roundOffPaise: total - subtotal, totalPaise: total }
}

/**
 * One key per basket.
 *
 * Made when a basket starts, never when Complete is pressed -- a key generated at press time is a
 * new key on every press, which is exactly the double charge it exists to prevent.
 */
export function newOnceKey() {
  if (globalThis.crypto?.randomUUID) return `till-${globalThis.crypto.randomUUID()}`
  return `till-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Keep the basket and its key across a refresh and a browser crash.
 *
 * A cashier who loses a half-built bill of fourteen sarees will not trust the software again, and
 * will keep a paper pad beside the screen forever. Written on every change rather than on a timer.
 *
 * Wrapped in try/catch because storage throws in a private window and in a browser with site data
 * blocked, and a till that will not open because it could not save a draft is worse than a till
 * that forgets one.
 */
export function saveDraft(lines, onceKey) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lines, onceKey }))
  } catch {
    // Nothing to do, and nothing worth telling the cashier about.
  }
}

/** The saved basket, or a fresh empty one with a new key. */
export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && Array.isArray(parsed.lines) && typeof parsed.onceKey === 'string') {
      return { lines: parsed.lines, onceKey: parsed.onceKey }
    }
  } catch {
    // Fall through to a fresh basket.
  }
  return { lines: [], onceKey: newOnceKey() }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Same again.
  }
}
