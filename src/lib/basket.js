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

/** The price this line is actually being sold at: the override when there is one, the tag otherwise. */
export const unitPrice = (line) => line.overridePricePaise ?? line.pricePaise

/*
 * THE OFFER ON A LINE, from the quote Inventory gave for this basket (§9). It applies only while
 * the line is the one that was quoted -- same quantity, no price typed over it -- which is exactly
 * when the server will apply it too. An override is a person at the counter, and it drops the
 * line's offers on both sides.
 */
export function offerOn(line, offers) {
  const q = offers?.[line.code]
  if (!q || line.overridePricePaise || q.qty !== line.qty) return 0
  return q.discountPaise ?? 0
}

export function lineTotal(line, offers) {
  return unitPrice(line) * line.qty - offerOn(line, offers)
}

/**
 * What the bill comes to, for the screen.
 *
 * Mirrors the server's order of operations -- tags (or overrides), then the bill discount, then
 * rounding to whole rupees -- so the figure the cashier asks the customer for is the figure the
 * server will charge. If they ever disagree the server refuses with the exact difference, which
 * is the safety net, not the plan.
 */
export function basketTotals(lines, billDiscountPaise = 0, offers = null) {
  // Offers first, then the manual discount on what is left -- the order both sides keep (§9).
  const tags = lines.reduce((sum, l) => sum + unitPrice(l) * l.qty, 0)
  const offersPaise = lines.reduce((sum, l) => sum + offerOn(l, offers), 0)
  const afterOffers = tags - offersPaise
  const discount = Math.min(Math.max(0, billDiscountPaise), afterOffers)
  const beforeRounding = afterOffers - discount
  const whole = Math.floor(beforeRounding / 100) * 100
  const total = beforeRounding - whole >= 50 ? whole + 100 : whole
  return {
    subtotalPaise: tags,
    offersPaise,
    discountPaise: discount,
    roundOffPaise: total - beforeRounding,
    totalPaise: total
  }
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
/*
 * The whole bill in progress, not only its lines: a reload that kept the sarees but dropped the
 * customer or a discount the manager had approved charged the customer more, or lost their points,
 * without a word (found on the live till, 7 Oct).
 */
export function saveDraft(lines, onceKey, extra = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lines, onceKey, ...extra }))
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
      return {
        lines: parsed.lines, onceKey: parsed.onceKey,
        customer: parsed.customer ?? null,
        billDiscountPaise: Number.isInteger(parsed.billDiscountPaise) ? parsed.billDiscountPaise : 0,
        couponCode: typeof parsed.couponCode === 'string' ? parsed.couponCode : ''
      }
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
