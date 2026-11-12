import { staffToken } from './session.js'

/**
 * LIVE -- the till hears the moment something changes, and the screen redraws (12 Nov, owner:
 * "everything in a blink of an eye, without refresh").
 *
 * One line to the server (GET /live, server-sent events) for as long as someone is signed in. The
 * server says only WHAT changed -- "sales", "items" -- and the screens that show it ask again, with
 * the usual routes and permissions. The timers each screen already had stay, in case the line drops.
 *
 * fetch, not EventSource: EventSource cannot send the Authorization header, and a token in the
 * address would end up in server logs.
 */
const TOPICS = {
  sales: ['home', 'bills', 'bill', 'orders', 'held-bills', 'shift', 'day', 'report', 'item-sales', 'awaiting-check', 'sends', 'credit-note', 'audit', 'return-info'],
  customers: ['customers', 'customer', 'wallet'],
  items: ['items', 'variants', 'stock-book'],
  'inventory-link': ['inventory-link', 'deliveries', 'shop', 'wallet']
}

const base = import.meta.env.VITE_API_BASE || '/api/v1'

/** Start listening for this signed-in person. Returns how to stop. */
export function startLive(queryClient) {
  // The browser suites wait for "no network" before each step, which a line held open never gives.
  // So in an automated browser it is off unless the suite asks for it (check-live-ui does).
  try { if (navigator.webdriver && localStorage.getItem('pos.live') !== 'on') return () => {} } catch { /* storage blocked: on */ }
  let stopped = false
  let controller = null
  let wait = 1000

  const refresh = (topics) => {
    const keys = new Set(topics.flatMap(t => TOPICS[t] ?? []))
    // Only what is on screen is fetched again; the rest is marked old and fetched when next shown.
    queryClient.invalidateQueries({ predicate: q => keys.has(q.queryKey?.[0]) })
  }

  async function connect() {
    const token = staffToken()
    if (stopped || !token) return
    controller = new AbortController()
    try {
      const res = await fetch(`${base}/live`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      if (!res.ok || !res.body) throw new Error(`live ${res.status}`)
      wait = 1000
      // Back from a drop: whatever changed meanwhile is fetched now.
      refresh(Object.keys(TOPICS))
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        let cut
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut)
          buffer = buffer.slice(cut + 2)
          const line = block.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try { refresh(JSON.parse(line.slice(6)).topics ?? []) } catch { /* a garbled line is skipped */ }
        }
      }
    } catch { /* dropped or refused: try again below */ }
    if (stopped) return
    setTimeout(connect, wait)
    wait = Math.min(wait * 2, 30_000)
  }

  connect()
  return () => { stopped = true; controller?.abort() }
}
