import axios from 'axios'

/**
 * Talking to the POS server.
 *
 * Relative base URL on purpose: in dev Vite proxies /api to localhost:4007, and in production the
 * till is served from the same origin as its server or behind a rewrite. One path, both places --
 * a per-environment base URL is how a deployed till ends up calling localhost.
 */
export const api = axios.create({
  baseURL: '/api/v1',
  // A till waits, but not forever. Ten seconds is long enough for a slow shop line and short enough
  // that a cashier knows something is wrong rather than staring at a spinner.
  timeout: 10_000
})

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

export async function completeSale(body) {
  const { data } = await api.post('/sales', body)
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
