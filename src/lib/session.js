/**
 * Who is at this till. POS-CORE-002. Approved 27 Sep: open the till with a password, then a PIN.
 *
 *   tillToken   this device's till is open (an owner or manager signed in). 30 days, or until closed.
 *   staffToken  the person billing right now. 12 hours; Switch drops it and asks for a name and PIN.
 *
 * Kept in local storage so a reload does not sign anyone out mid-sale. Listeners hear when the
 * server says the till was closed or the person's turn ended, so the shell can show the right screen.
 */
const KEY = 'pos.session.v1'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {} } catch { return {} }
}
let state = read()
const listeners = new Set()

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
/** Switch: the next person chooses their name. The till stays open. */
export function personOut() {
  const { staffToken: _gone, person: _p, ...rest } = state
  commit(rest)
}
/** The till is closed on this device. */
export function tillClosed() {
  commit({})
}
