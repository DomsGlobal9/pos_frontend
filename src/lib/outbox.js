import { useSyncExternalStore } from 'react'
import { completeSale, completeStampedSale, messageFor } from './api.js'
import { staffToken, offlineKey, tillToken } from './session.js'

/*
 * A SALE KEPT ON THE DEVICE IS SENT AS THE PERSON WHO MADE IT, WHOEVER IS AT THE TILL BY THEN.
 * The bill, the shift and the drawer it is counted in all hang on that name.
 *
 * It used to keep its maker's whole sign-in beside it for that, and after Switch that sign-in was
 * still in this browser's storage for the next person to lift (security audit pos-run-1, 17 Nov).
 * Dropping it at Switch put Ravi's sale on Priya's name, which is worse, and was taken back.
 *
 * Now the maker leaves a STAMP instead (backend: services/auth/maker-stamp.ts). While signed in, a
 * person holds an offline key the server gave them. Queuing a sale, the till keeps the first two
 * parts of their sign-in -- who, which shop, until when; not the signature, so it signs nobody in --
 * and a proof made with that key over this sale's once-key and its exact text. The server checks the
 * proof against the bytes it receives. What stays on the device can send this one sale, unchanged,
 * under its maker's name, and nothing else.
 *
 * The sign-in itself is held only for the instant it takes to make the stamp, so that a tab closed in
 * that instant still knows whose sale it was. A till signed in before this version has no offline key
 * until its next Switch; until then its sales are kept the old way.
 */

const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('')

/** The stamp for one queued sale, or null where the browser or the session cannot make one. */
async function stampFor(onceKey, bodyText, token, key) {
  if (!token || !key || !globalThis.crypto?.subtle) return null
  const text = new TextEncoder()
  const bodyHash = hex(await crypto.subtle.digest('SHA-256', text.encode(bodyText)))
  const hmacKey = await crypto.subtle.importKey('raw', text.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const proof = hex(await crypto.subtle.sign('HMAC', hmacKey, text.encode(`${onceKey}\n${bodyHash}`)))
  return { claims: token.split('.').slice(0, 2).join('.'), proof }
}

/**
 * Sales this till could not send, kept until it can. POS-SYNC-003..005, POS-OFF-002.
 *
 * STAGE 1, and on purpose no more (MASTER.md §16.9). The till does not number bills, price them or
 * decide anything while the line is down. A sale whose Complete could not reach the server is kept
 * here exactly as it was sent -- with the SAME once-key -- and sent again when the line is back.
 * The server numbers it on arrival. If the first attempt did in fact arrive and only the reply was
 * lost, the second attempt gets that same bill back: one sale, one number, one payment.
 *
 * Each entry:
 *   onceKey       the basket's key -- the only thing that makes sending twice safe
 *   body          what goes to POST /sales, including madeOfflineAt (when the customer paid)
 *   restore       the basket as the till holds it, for "Open in till"
 *   summary       what the list shows: total, pieces, first item, customer, how it was paid
 *   state         waiting | sending | needs_attention
 *   message       why it needs attention, in the server's own words
 *
 * Kept in local storage so a reload, a crash or a closed laptop loses nothing. Storage that
 * throws (a private window) keeps the outbox for this tab only -- and says so on the Sync screen.
 */

const KEY = 'pos.outbox.v1'
const SENT_KEY = 'pos.outbox.sent.v1'

let storageWorks = true
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { storageWorks = false; return fallback }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { storageWorks = false }
}

// "sending" does not survive a reload: whatever was in flight is simply waiting again. Sending it
// once more is safe -- that is the whole point of the once-key.
let items = read(KEY, []).map(i => (i.state === 'sending' ? { ...i, state: 'waiting' } : i))
let sent = read(SENT_KEY, [])
const listeners = new Set()

function commit(next) {
  items = next
  write(KEY, items)
  listeners.forEach(fn => fn())
}

// Another tab of the same till changed the outbox: follow it, so two tabs never disagree.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { items = read(KEY, []); listeners.forEach(fn => fn()) }
    if (e.key === SENT_KEY) { sent = read(SENT_KEY, []); listeners.forEach(fn => fn()) }
  })
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
let snapshot = { items, sent }
const getSnapshot = () => {
  if (snapshot.items !== items || snapshot.sent !== sent) snapshot = { items, sent }
  return snapshot
}

/** The outbox, live: re-renders whenever anything is added, sent or removed. */
export function useOutbox() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export const outboxItems = () => items
export const storageAvailable = () => storageWorks

/** What the device tells the server on check-in. POS-DAY-004. */
export function pendingSummary() {
  const oldest = items.reduce((min, i) => (!min || i.createdAt < min ? i.createdAt : min), null)
  return { count: items.length, oldestAt: oldest }
}

/**
 * Did the request fail because the line is down, rather than because the server said no?
 *
 * No reply at all (offline, timed out, DNS) or a gateway in between that could not reach us: the
 * sale may or may not have arrived, and sending it again is safe. Anything the SERVER answered --
 * a price that changed, a payment that does not add up, an approval needed -- is a real answer,
 * and sending the same thing again would get the same answer forever.
 */
export function isNetworkFailure(error) {
  if (!error) return false
  if (!error.response) return true
  return [502, 503, 504].includes(error.response.status)
}

export function addToOutbox({ onceKey, body, restore, summary }) {
  if (items.some(i => i.onceKey === onceKey)) return
  const now = new Date().toISOString()
  const queued = { ...body, madeOfflineAt: body.madeOfflineAt ?? now }
  // The exact text the stamp is made over, and the exact text that is sent.
  const bodyText = JSON.stringify(queued)
  const token = staffToken()
  commit([...items, {
    onceKey,
    body: queued,
    bodyText,
    restore,
    summary,
    // Who made it. Their sign-in, for the instant until the stamp below replaces it.
    token,
    maker: null,
    createdAt: now,
    attempts: 1,
    state: 'waiting',
    message: null,
    lastTriedAt: now
  }])
  stampFor(onceKey, bodyText, token, offlineKey())
    .then(maker => { if (maker && items.some(i => i.onceKey === onceKey)) patch(onceKey, { maker, token: null }) })
    .catch(() => { /* no stamp: it stays as it was queued, under the sign-in */ })
}

export function removeFromOutbox(onceKey) {
  commit(items.filter(i => i.onceKey !== onceKey))
}

function patch(onceKey, change) {
  commit(items.map(i => (i.onceKey === onceKey ? { ...i, ...change } : i)))
}

/**
 * Send what is waiting, oldest first, one at a time. Returns how many went.
 *
 * One at a time because order matters to a person reading the bills (the 10:02 sale should not get
 * a later number than the 10:05 one when both come back together), and because a line that is still
 * down fails the first attempt and there is no point hammering it with the rest.
 *
 * Only one flush runs at once, however many things ask for it (the timer, the "online" event, the
 * Send now button): the rest get the same promise.
 */
let running = null
export function flush({ includeAttention = false } = {}) {
  if (running) return running
  running = (async () => {
    let wentThrough = 0
    const queue = items
      .filter(i => i.state === 'waiting' || (includeAttention && i.state === 'needs_attention'))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    for (const entry of queue) {
      // Opened in the till or removed while we were busy with the one before.
      if (!items.some(i => i.onceKey === entry.onceKey)) continue
      patch(entry.onceKey, { state: 'sending', lastTriedAt: new Date().toISOString() })
      try {
        let result
        try {
          result = entry.maker
            ? await completeStampedSale(entry.bodyText, entry.maker, tillToken())
            : await completeSale(entry.body, entry.token ?? undefined)
        } catch (error) {
          // The stamp was not accepted (the maker has left the shop, the till was closed), or an old
          // entry's sign-in has run out: send it as whoever is at the till now, rather than leave a
          // paid sale stuck on the device.
          if ((entry.maker || entry.token) && error?.response?.status === 401) result = await completeSale(entry.body)
          else throw error
        }
        commit(items.filter(i => i.onceKey !== entry.onceKey))
        sent = [{
          onceKey: entry.onceKey,
          saleId: result.sale.id,
          invoiceNo: result.sale.invoiceNo,
          totalPaise: result.sale.totalPaise,
          madeAt: entry.createdAt,
          sentAt: new Date().toISOString()
        }, ...sent].slice(0, 20)
        write(SENT_KEY, sent)
        listeners.forEach(fn => fn())
        wentThrough++
      } catch (error) {
        const current = items.find(i => i.onceKey === entry.onceKey)
        if (!current) continue
        // Nobody signed in right now: keep it waiting, it is not the sale's fault.
        if (isNetworkFailure(error) || error?.response?.status === 401) {
          patch(entry.onceKey, { state: 'waiting', attempts: (current.attempts ?? 0) + 1 })
          break   // the line is still down; the rest would fail the same way
        }
        patch(entry.onceKey, { state: 'needs_attention', attempts: (current.attempts ?? 0) + 1, message: messageFor(error) })
      }
    }
    return wentThrough
  })().finally(() => { running = null })
  return running
}
