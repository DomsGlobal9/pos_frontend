import axios from 'axios'
import { staffToken, tillToken, tillClosed, personOut } from './session.js'

/**
 * Talking to the POS server.
 *
 * Relative base URL on purpose: in dev Vite proxies /api to localhost:4007, and in production the
 * till is served from the same origin as its server or behind a rewrite. One path, both places --
 * a per-environment base URL is how a deployed till ends up calling localhost.
 */
export const api = axios.create({
  // VITE_API_BASE only when the till is hosted apart from its server (e.g. https://pos-api.example.com/api/v1).
  // Unset: the same origin, as in development.
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  // A till waits, but not forever. Ten seconds is long enough for a slow shop line and short enough
  // that a cashier knows something is wrong rather than staring at a spinner.
  timeout: 10_000
})

/*
 * The person at the till goes with every request; the till's own token with the sign-in calls.
 * When the server says the till was closed, or this person's turn has ended, the session is
 * updated and the shell shows the right screen -- never a raw 401.
 */
api.interceptors.request.use(config => {
  const staff = staffToken()
  if (staff && !config.headers.Authorization) config.headers.Authorization = `Bearer ${staff}`
  const till = tillToken()
  if (till && String(config.url ?? '').startsWith('/auth/')) config.headers['x-till-token'] = till
  return config
})
api.interceptors.response.use(r => r, error => {
  const code = error?.response?.status === 401 ? error.response.data?.details?.code : null
  // Only for the person at the till -- not for a queued sale sent under someone else's name.
  if (code && !error.config?.headers?.['x-keep-session']) {
    // The token this request actually carried: a refusal is about that one, not whatever is held now.
    const h = error.config?.headers ?? {}
    const refused = String(h.Authorization ?? '').replace(/^Bearer /, '') || h['x-till-token'] || undefined
    if (code === 'TILL_CLOSED' || code === 'TILL_UNKNOWN') tillClosed(refused)
    else if (code === 'NO_STAFF') personOut(refused)
  }
  return Promise.reject(error)
})

// ---- signing in at the till. POS-CORE-002.
export const openTill = (body) => api.post('/auth/open', body).then(r => r.data.data)
export const loadTillStaff = () => api.get('/auth/staff').then(r => r.data.data)
export const switchPerson = (body) => api.post('/auth/switch', body).then(r => r.data.data)
export const whoAmI = () => api.get('/auth/me').then(r => r.data.data)
export const closeThisTill = () => api.post('/auth/close').then(r => r.data.data)
export const closeEveryTill = () => api.post('/auth/close-all').then(r => r.data.data)
export const loadStaff = () => api.get('/staff').then(r => r.data.data)
export const addStaff = (body) => api.post('/staff', body).then(r => r.data.data)
export const changeStaff = (id, body) => api.patch(`/staff/${id}`, body).then(r => r.data.data)

/**
 * One sentence a cashier can act on, out of anything that can go wrong.
 *
 * The server already writes its errors for people to read (utils/httpError). This handles the cases
 * that never reach the server: a dropped line, a timeout, a proxy returning HTML. Those are exactly
 * the moments a raw error would leak onto a screen a customer can see over the counter.
 */
export function messageFor(error) {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.code === 'ECONNABORTED') return 'That took too long. Nothing has been charged -- try once more.'
  if (error?.code === 'ERR_NETWORK') return 'No connection to the till server. Check the internet, then try again.'
  return 'Something went wrong. Nothing has been charged -- try once more.'
}

/**
 * The health check is the one call that must not throw on a bad status.
 *
 * It answers 503 when the database is unreachable, because its usual caller is a load balancer that
 * reads the status code. The till is the other caller, and for it a 503 is a useful ANSWER rather
 * than a failure: the server is up and has told us precisely what is wrong. Left to throw, it looked
 * identical to the server being unreachable, and the screen said "no connection to the till server"
 * about a server that was replying.
 *
 * The difference matters at 9 a.m. It decides whether the shop restarts the till, or rings us.
 */
export async function health() {
  const { data } = await api.get('/health', {
    validateStatus: (status) => status === 200 || status === 503
  })
  return data.data
}

export async function homeSummary() {
  const { data } = await api.get('/home/summary')
  return data.data
}

export async function loadShop() {
  const { data } = await api.get('/shop')
  return data.data
}

export async function searchItems(q) {
  const { data } = await api.get('/sales/items', { params: { q } })
  return data.data
}

/** POS-SELL-006. Every colour and size of one thing. */
export async function loadVariants(group) {
  const { data } = await api.get(`/sales/variants/${encodeURIComponent(group)}`)
  return data.data
}

/** POS-CUST-002. Null when we have not met them -- an ordinary answer, not a failure. */
export async function findCustomerByPhone(phone) {
  const { data } = await api.get(`/customers/by-phone/${encodeURIComponent(phone)}`)
  return data.data
}

/** POS-CUST-004. Find-or-create, so two cashiers at once end with one customer. */
export async function createCustomer(body) {
  const { data } = await api.post('/customers', body)
  return data.data
}

export async function searchCustomers(q) {
  const { data } = await api.get('/customers', { params: q ? { q } : {} })
  return data.data
}

/** Name, GSTIN and address -- a business buyer's tax invoices carry them. null clears one. */
export async function saveCustomerDetails(id, details) {
  const { data } = await api.patch(`/customers/${id}`, details)
  return data.data
}

export async function loadCustomer(id) {
  const { data } = await api.get(`/customers/${id}`)
  return data.data
}

/** WF-ORDERS-01. tab is ALL, WAITING, READY, DUE or COMPLETE. */
export async function loadOrders(tab = 'ALL', q = '') {
  const { data } = await api.get('/orders', { params: { tab, ...(q ? { q } : {}) } })
  return data.data
}

/** POS-ORD-012. Idempotent on onceKey. */
export async function collectOnOrder(id, body) {
  const { data } = await api.post(`/orders/${id}/collect`, body)
  return data.data
}

export async function markOrderReady(id) {
  const { data } = await api.post(`/orders/${id}/ready`)
  return data.data
}

/** POS-ORD-013/014. acceptDue is the explicit "hand over with money owed". */
export async function handOverOrder(id, acceptDue = false) {
  const { data } = await api.post(`/orders/${id}/hand-over`, acceptDue ? { acceptDue: true } : {})
  return data.data
}

/** WF-HELD-01. */
export async function loadHeldBills() {
  const { data } = await api.get('/held-bills')
  return data.data
}

export async function parkBill(body) {
  const { data } = await api.post('/held-bills', body)
  return data.data
}

/** One person gets it; everyone else is told it has gone. */
export async function recallBill(id) {
  const { data } = await api.post(`/held-bills/${id}/recall`)
  return data.data
}

export async function discardHeldBill(id) {
  const { data } = await api.delete(`/held-bills/${id}`)
  return data.data
}

/** POS-CORE-010. Owner and managers only; the server refuses anyone else in plain words. */
export async function loadAudit() {
  const { data } = await api.get('/admin/audit')
  return data.data
}

/** POS-PAY-011. Payments nobody has confirmed against the bank yet. */
export async function loadAwaitingCheck() {
  const { data } = await api.get('/payments/awaiting-check')
  return data.data
}

export async function resolvePayment(id, body) {
  const { data } = await api.post(`/payments/${id}/resolve`, body)
  return data.data
}

export async function completeSale(body, asToken) {
  // A sale kept on the device is sent as the person who made it (their sign-in, kept with it).
  const { data } = await api.post('/sales', body, asToken ? { headers: { Authorization: `Bearer ${asToken}`, 'x-keep-session': '1' } } : undefined)
  return data.data
}

/** POS-SALE-001..006. Filters are optional; `after` pages. */
export async function loadBills(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
  const { data } = await api.get('/bills', { params: clean })
  return data.data
}

export async function loadBill(id) {
  const { data } = await api.get(`/bills/${id}`)
  return data.data
}

/**
 * POS-RCPT-003, -004. Records that a copy was taken and says WHICH copy it is.
 *
 * Called before the print dialog opens, not after: the browser gives no reliable signal that a
 * page actually printed, so counting on the way in is the only honest option. It over-counts if
 * someone cancels the dialog, which is the safe direction to be wrong -- a copy marked duplicate
 * that never existed costs nothing; an unmarked duplicate in circulation costs a saree.
 */
export async function markPrinted(id) {
  const { data } = await api.post(`/bills/${id}/printed`)
  return data.data
}

// ---- Returns and exchanges. WF-RETURN-01, WF-EXCHANGE-01. ----------------------------------

/** What on this bill can come back, and on what terms. */
export async function loadReturnInfo(saleId) {
  const { data } = await api.get(`/returns/bill/${saleId}`)
  return data.data
}

/** The exact refund for a selection. Writes nothing. */
export async function quoteReturn(saleId, lines) {
  const { data } = await api.post(`/returns/bill/${saleId}/quote`, { lines })
  return data.data
}

export async function recordReturn(saleId, body) {
  const { data } = await api.post(`/returns/bill/${saleId}`, body)
  return data.data
}

export async function recordExchange(saleId, body) {
  const { data } = await api.post(`/returns/bill/${saleId}/exchange`, body)
  return data.data
}

export async function loadCreditNote(id) {
  const { data } = await api.get(`/returns/${id}`)
  return data.data
}

// ---- Shift, drawer and day close. WF-SHIFT-01, WF-CASH-01, WF-DAY-01. ------------------------

export async function loadShift(counterId) {
  const { data } = await api.get(`/shifts/counter/${counterId}`)
  return data.data
}

export async function openShift(body) {
  const { data } = await api.post('/shifts', body)
  return data.data
}

export async function moveCash(body) {
  const { data } = await api.post('/shifts/cash', body)
  return data.data
}

export async function closeShift(id, body) {
  const { data } = await api.post(`/shifts/${id}/close`, body)
  return data.data
}

export async function loadDay(date) {
  const { data } = await api.get(`/day-close/${date}`)
  return data.data
}

export async function closeTheDay(date, body = {}) {
  const { data } = await api.post(`/day-close/${date}`, body)
  return data.data
}

// ---- The Inventory link. Owner-only apart from reading and refreshing items. ---------------------

export async function loadInventoryLink() {
  const { data } = await api.get('/inventory-link')
  return data.data
}

export async function connectInventory(body) {
  const { data } = await api.post('/inventory-link/connect', body)
  return data.data
}

export async function disconnectInventory() {
  const { data } = await api.post('/inventory-link/disconnect')
  return data.data
}

export async function retryInventory() {
  const { data } = await api.post('/inventory-link/retry')
  return data.data
}

/** Leave the bill the queue stopped at out of Inventory. Owner only; a reason is required. */
export async function leaveOutOfInventory(document, reason) {
  // It sends what was waiting behind the bill straight after, which can take a while.
  const { data } = await api.post('/inventory-link/leave-out', { document, reason }, { timeout: 120_000 })
  return data.data
}

export async function syncInventoryItems() {
  // Can take a while for a big catalogue; longer than the till's usual ten seconds.
  const { data } = await api.post('/inventory-link/sync-catalogue', {}, { timeout: 120_000 })
  return data.data
}

export async function setInventoryWhenDown(whenDown) {
  const { data } = await api.post('/inventory-link/when-down', { whenDown })
  return data.data
}

/** WF-REPORTS-01. `from` and `to` are YYYY-MM-DD; a cashier always gets their own today. */
export async function loadReport({ from, to } = {}) {
  const { data } = await api.get('/reports', { params: { from, to } })
  return data.data
}

// ---- Digital receipts, UPI QR, devices. Phase 10. ------------------------------------------

/** POS-RCPT-006. One press, one message, to the bill's own customer. */
export async function sendReceiptWhatsApp(saleId, onceKey) {
  const { data } = await api.post(`/bills/${saleId}/send`, { onceKey, channel: 'WHATSAPP' }, { timeout: 30_000 })
  return data.data
}

export async function loadSends(saleId) {
  const { data } = await api.get(`/bills/${saleId}/sends`)
  return data.data
}

/** The customer's own copy, by the token on the paper. No sign-in. */
export async function loadPublicReceipt(token) {
  const { data } = await api.get(`/public/receipts/${token}`)
  return data.data
}

export async function setShopUpi(upiId) {
  const { data } = await api.put('/shop/upi', { upiId })
  return data.data
}

/** The shop's GST registration: REGULAR | COMPOSITION | UNREGISTERED. Owner-only; not while connected. */
export async function setShopGst(registration) {
  const { data } = await api.put('/shop/gst', { registration })
  return data.data
}

/** The logo on the bill: a JPEG data URL, an https address, or null to remove. Owner-only. */
export async function setShopLogo(logoUrl) {
  const { data } = await api.put('/shop/logo', { logoUrl })
  return data.data
}

/**
 * What this basket comes to with the shop's offers on it, from Inventory via our server (§9).
 * Always answers: `{ ok: true, quote }` or `{ ok: false, reason }`. Never a thrown error for a
 * quote that could not be had -- the till sells at its own prices and says so in one line.
 */
export async function quoteBasket(body) {
  const { data } = await api.post('/sales/quote', body)
  return data.data
}

/** The customer's points and store credit usable on this bill, from Inventory (§10). Always answers. */
export async function loadWallet(customerId, billPaise) {
  const { data } = await api.get('/sales/wallet', { params: { customerId, billPaise } })
  return data.data
}

export async function loadDevices() {
  const { data } = await api.get('/devices')
  return data.data
}

export async function updateDevice(id, body) {
  const { data } = await api.patch(`/devices/${id}`, body)
  return data.data
}

export async function loadSale(id) {
  const { data } = await api.get(`/sales/${id}`)
  return data.data
}

/** Paise to a readable figure. The server sends integers; nothing here ever does money arithmetic
 * in floats -- it only formats. */
export function rupees(paise) {
  if (paise === null || paise === undefined) return ''
  const negative = paise < 0
  const value = Math.abs(paise) / 100
  const text = value.toLocaleString('en-IN', {
    minimumFractionDigits: Math.abs(paise) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })
  return `${negative ? '-' : ''}₹${text}`
}

// ---- Connections: keys, webhooks, import, export. WF-INTEGRATIONS-01.
const got = (p) => p.then(r => r.data.data)
export const loadApiKeys = () => got(api.get('/connections/api-keys'))
export const createApiKey = (body) => got(api.post('/connections/api-keys', body))
export const revokeApiKey = (id) => got(api.post(`/connections/api-keys/${id}/revoke`))
export const loadWebhooks = () => got(api.get('/connections/webhooks'))
export const createWebhook = (body) => got(api.post('/connections/webhooks', body))
export const updateWebhook = (id, body) => got(api.patch(`/connections/webhooks/${id}`, body))
export const removeWebhook = (id) => got(api.delete(`/connections/webhooks/${id}`))
export const testWebhook = (id) => got(api.post(`/connections/webhooks/${id}/test`, {}, { timeout: 20_000 }))
export const loadDeliveries = (id) => got(api.get(`/connections/webhooks/${id}/deliveries`))
export const resendDelivery = (id) => got(api.post(`/connections/deliveries/${id}/resend`))
export const importItems = (file, commit) => got(api.post('/connections/items/import', { file, commit }, { timeout: 120_000 }))

/** Fetch a file from the server and hand it to the browser as a download. */
export async function download(path, params, filename) {
  let res
  try {
    res = await api.get(path, { params, responseType: 'blob', timeout: 120_000 })
  } catch (error) {
    // A refusal arrives as a blob too; read the sentence out of it so the screen can show it.
    const blob = error?.response?.data
    if (blob instanceof Blob) {
      try { error.response.data = JSON.parse(await blob.text()) } catch { /* not JSON */ }
    }
    throw error
  }
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** The owner's item list, including the items switched off. POS-STAND-003. */
export async function loadItems(q) {
  const { data } = await api.get('/items', { params: q ? { q } : {} })
  return data.data
}

/** Add one item, or correct one already there -- the same code is how a price gets fixed. */
export async function saveItem(body) {
  const { data } = await api.post('/items', body)
  return data.data
}
