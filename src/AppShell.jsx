import { Outlet, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { health, loadShop, whoAmI } from './lib/api.js'
import { useDevice, isTouchFirst } from './lib/useMedia.js'
import NavBar from './components/NavBar.jsx'
import { useEffect, useState } from 'react'
import { checkIn } from './lib/device.js'
import { useOutbox, flush, outboxItems } from './lib/outbox.js'
import { onSession, tillToken, personOut } from './lib/session.js'
import { OpenTill, WhoAtTill } from './components/TillGate.jsx'

/**
 * The shell every screen sits in. POS-CORE-001.
 *
 * Nav plus a thin header, and nothing else -- the screens own their own content. The shape changes
 * by device but the destinations never do:
 *
 *   phone / tablet   header on top, content, nav along the bottom where a thumb reaches
 *   desktop          nav rail on the left, content beside it
 *
 * The header carries the shop name and the honest connection state, because POS-SYNC-001/002 say a
 * user should always be able to tell whether their work is safe without going looking for it.
 */
export default function AppShell() {
  const device = useDevice()
  const bottomNav = isTouchFirst(device)

  const queryClient = useQueryClient()

  /*
   * Is someone at this till? POS-CORE-002.
   *
   *   ok     somebody is signed in (or, in development only, the seeded dev user answers)
   *   open   the till is closed on this device: an owner or manager opens it
   *   who    the till is open, nobody is billing: choose your name, enter your PIN
   *
   * If the server cannot be reached at all, the till carries on: sales are kept on the device
   * (Phase 11), and nobody is locked out of their own counter by a dropped line.
   */
  const [gate, setGate] = useState('checking')
  useEffect(() => {
    let alive = true
    whoAmI()
      .then(() => alive && setGate('ok'))
      .catch(err => { if (alive) setGate(err?.response?.status === 401 ? (tillToken() ? 'who' : 'open') : 'ok') })
    const off = onSession(st => {
      if (!st.tillToken) setGate('open')
      else if (!st.staffToken) setGate('who')
      else { setGate('ok'); queryClient.invalidateQueries() }
    })
    return () => { alive = false; off() }
  }, [queryClient])

  const { items: waiting } = useOutbox()
  const { data: status, isError: unreachable, refetch: recheck } = useQuery({
    queryKey: ['health'], queryFn: health, refetchInterval: 30_000, retry: false
  })
  const [online, setOnline] = useState(() => navigator.onLine)
  const { data: shop } = useQuery({ queryKey: ['shop'], queryFn: loadShop, staleTime: Infinity, enabled: gate === 'ok' })

  // This device checks in when the till opens and every minute after. Never blocks anything.
  useEffect(() => {
    checkIn()
    const t = setInterval(checkIn, 60_000)
    return () => clearInterval(t)
  }, [])

  /*
   * Send what this till is holding. POS-SYNC-005.
   *
   * When the till opens, every fifteen seconds, and the moment the browser says the line is back.
   * flush() runs one at a time however many of these fire together, and sending the same sale twice
   * is safe -- the server answers the second with the first bill.
   */
  useEffect(() => {
    let alive = true
    const send = async () => {
      if (!outboxItems().some(i => i.state === 'waiting')) return
      const went = await flush()
      // Tell the server what is still here -- sent, or refused and needing a look -- straight away,
      // not at the next minute's check-in: the day close reads it.
      checkIn()
      if (!alive || went === 0) return
      queryClient.invalidateQueries()
      toast.success(went === 1 ? '1 waiting sale sent.' : `${went} waiting sales sent.`)
    }
    const up = () => { setOnline(true); recheck(); send() }
    const down = () => { setOnline(false); recheck() }
    send()
    const t = setInterval(send, 15_000)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      alive = false
      clearInterval(t)
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [queryClient, recheck])

  if (gate === 'checking') return <div style={s.page} aria-busy="true" />
  if (gate === 'open') return <OpenTill />
  if (gate === 'who') return <WhoAtTill />

  return (
    <div style={{ ...s.page, flexDirection: bottomNav ? 'column' : 'row' }}>
      {!bottomNav && <NavBar device={device} />}

      <div style={s.main}>
        <header style={s.header}>
          <div style={s.brand}>
            {/* On a phone the rail is gone, so the mark lives here instead. */}
            {bottomNav && <img src="/scaleezy-mark.svg" alt="" width="26" height="26" />}
            <div style={{ minWidth: 0 }}>
              <strong style={s.shop}>{shop?.shop?.shopName ?? 'ScaleEzy POS'}</strong>
              {shop?.cashier?.name && (
                <div style={s.who}>
                  {shop.cashier.name}
                  {/* The next person takes the till with their own PIN. Only on an opened till. */}
                  {tillToken() && <button type="button" style={s.switch} onClick={() => personOut()}>Switch</button>}
                </div>
              )}
            </div>
          </div>
          <Connection status={status} offline={!online || unreachable} waiting={waiting.length} />
        </header>

        <div style={s.content} className="shell-content">
          <Outlet context={{ device, shop }} />
        </div>
      </div>

      {bottomNav && <NavBar device={device} />}
    </div>
  )
}

/**
 * Whether the work is safe, in words.
 *
 * MASTER.md §9: every expected error says what happened, whether the user's work is safe, and what
 * to do next. That applies to a status line as much as to an error, so this never says "503" or
 * "ECONNREFUSED" -- and it distinguishes the server being unreachable from the server being up
 * with a database problem, because those need different people to fix them.
 */
function Connection({ status, offline, waiting }) {
  // Sales on this till that the server has not got. POS-SYNC-003: never "All saved" while any are.
  const held = waiting > 0 && (
    <Link to="/sync" className="chip warn" style={s.state}>
      <Dot color="var(--warn)" /> {waiting === 1 ? '1 sale' : `${waiting} sales`} waiting to send
    </Link>
  )
  if (offline) {
    return held || (
      <span className="chip bad" style={s.state}>
        <Dot color="var(--bad)" /> No connection. Sales are kept on this till.
      </span>
    )
  }
  if (held) return held
  if (!status) {
    return <span className="chip" style={s.state}>Checking…</span>
  }
  if (status.database !== 'up') {
    return (
      <span className="chip bad" style={s.state}>
        <Dot color="var(--bad)" /> Saving is paused. Nothing you have entered is lost.
      </span>
    )
  }
  return (
    <span className="chip good" style={s.state}>
      <Dot color="var(--good)" /> {status.mode === 'standalone' ? 'All saved' : 'All saved · Inventory connected'}
    </span>
  )
}

const Dot = ({ color }) => <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: color, display: 'inline-block' }} />

const s = {
  page: { height: '100%', display: 'flex', background: 'var(--bg)' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minHeight: 60, padding: '8px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--line)'
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  shop: { display: 'block', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  who: { fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 8 },
  switch: { minHeight: 26, padding: '0 10px', fontSize: 12, fontWeight: 600, borderRadius: 99 },
  state: { fontSize: 12, textAlign: 'right', whiteSpace: 'normal' },
  content: { flex: 1, minHeight: 0, overflow: 'auto' }
}
