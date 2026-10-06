/**
 * Who is at this till. POS-CORE-002. Approved 27 Sep: open the till with a password, then a PIN.
 *
 *   tillToken   this device's till is open (an owner or manager signed in). 30 days, or until closed.
 *   staffToken  the person billing right now. 12 hours; Switch drops it and asks for a name and PIN.
 *
 * Kept in local storage so a reload does not sign anyone out mid-sale. Listeners hear when the
 * server says the till was closed or the person's turn ended, so the shell can show the right screen.
 *
 * ONE STORE, MANY TABS. Local storage is shared by every tab of the till on this browser, and this
 * module used to read it once and then trust its own copy. So each tab held a private snapshot, and
 * whichever tab last wrote won: a tab whose till had been closed an hour ago, told so by the server,
 * wrote {} over the till another tab had opened a minute ago -- and that tab found out on its next
 * reload, which made it look random. Found on the test shop, 6 Oct, after six sign-outs in an
 * afternoon that no close had caused.
 *
 * So: the storage event keeps every tab's copy current, and a tab only clears a till it still holds.
 */
const KEY = 'pos.session.v1'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {} } catch { return {} }
}
let state = read()
const listeners = new Set()

// Another tab signed in, switched, or closed: take its word for it, and show the right screen here.
window.addEventListener('storage', e => {
  if (e.key !== KEY && e.key !== null) return
  state = read()
  listeners.forEach(fn => fn(state))
})

function commit(next) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private window: this tab only */ }
  listeners.forEach(fn => fn(state))
}

export const session = () => state
export const staffToken = () => state.staffToken ?? null
export const tillToken = () => state.tillToken ?? null
export const onSession = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

export function tillOpened({ tillToken, staffToken, shop, person }) {
  commit({ tillToken, staffToken, shopName: shop?.name ?? null, person })
}
export function personIn({ staffToken, person }) {
  commit({ ...state, staffToken, person })
}
/*
 * A CLEAR ONLY CLEARS WHAT THIS TAB STILL HOLDS.
 *
 * Two ways a refusal can be about a session that is no longer the live one. The server answered a
 * request this tab sent with an OLDER token, before the storage event brought the newer one in --
 * so a refusal names the token it was for, and one that is not what we hold now is history, not
 * news. And storage itself may already carry a different till, opened by another tab since; that is
 * the live session, so adopt it rather than wipe it. A person pressing the button passes no token
 * and is always obeyed. Private window: read() is {} and the write fails anyway.
 */
function stillOurs(field, refused) {
  if (refused && refused !== state.staffToken && refused !== state.tillToken) return false
  const stored = read()
  if (!stored[field] || stored[field] === state[field]) return true
  state = stored
  listeners.forEach(fn => fn(state))
  return false
}
/** Switch: the next person chooses their name. The till stays open. */
export function personOut(refused) {
  if (!stillOurs('staffToken', refused)) return
  const { staffToken: _gone, person: _p, ...rest } = state
  commit(rest)
}
/** The till is closed on this device. */
export function tillClosed(refused) {
  if (!stillOurs('tillToken', refused)) return
  commit({})
}
