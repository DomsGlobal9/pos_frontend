import { Outlet, Link, useLocation } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { health, loadShop, whoAmI, loadInventoryLink } from './lib/api.js'
import { useDevice, isTouchFirst } from './lib/useMedia.js'
import NavBar from './components/NavBar.jsx'
import { useEffect, useState } from 'react'
import { checkIn } from './lib/device.js'
import { applyUpdate, updateReady, tillIsIdle } from './lib/update.js'
import { useOutbox, flush, outboxItems } from './lib/outbox.js'
import { onSession, tillToken, staffToken, personOut } from './lib/session.js'
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
const IDLE_SIGN_OUT_MS = 10 * 60 * 1000

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
  // Sending to Inventory can stop mid-day while everything on the till is saved (live 8 Oct): looked at every minute.
  const { data: link } = useQuery({ queryKey: ['inventory-link'], queryFn: loadInventoryLink, refetchInterval: 60_000, enabled: gate === 'ok' && shop?.inventoryConnected === true })

  /*
   * A TILL LEFT ALONE ASKS FOR A PIN AGAIN (found 9 Oct: the live till sat signed in as the owner, and a
   * name-and-PIN turn lasts 12 hours -- anyone at the counter could approve, discount or write off as them).
   * Ten minutes with no tap or key (a scanner types), and only when nothing is in progress. The last touch
   * is shared by every tab: Switch clears them all, so a forgotten tab must not sign out a busy one.
   */
  useEffect(() => {
    const KEY = 'pos.lastTouch'
    let wrote = 0
    const touch = () => {
      const now = Date.now()
      if (now - wrote > 5_000) { wrote = now; try { localStorage.setItem(KEY, String(now)) } catch { /* private window */ } }
    }
    touch()
    window.addEventListener('pointerdown', touch, true)
    window.addEventListener('keydown', touch, true)
    const t = setInterval(() => {
      let last = wrote
      try { last = Math.max(last, Number(localStorage.getItem(KEY)) || 0) } catch { /* this tab's own */ }
      if (staffToken() && Date.now() - last > IDLE_SIGN_OUT_MS && tillIsIdle()) {
        personOut()
        toast('Signed out after 10 minutes with nothing happening. Choose your name to carry on.', { id: 'idle-out', duration: 10_000 })
      }
    }, 30_000)
    return () => { clearInterval(t); window.removeEventListener('pointerdown', touch, true); window.removeEventListener('keydown', touch, true) }
  }, [])

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
          <Connection status={status} offline={!online || unreachable} waiting={waiting.length} inventory={shop?.inventoryConnected === true} inventoryStopped={!!link?.blocked} />
          <UpdateReady />
          <HelpButton />
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
 * The guide for THIS screen (as Inventory's): /help?from=<where you are> opens the page whose `app:`
 * is that screen. A new tab, so a bill in progress is never left.
 */
function HelpButton() {
  const { pathname } = useLocation()
  return (
    <a href={`/help?from=${encodeURIComponent(pathname)}`} target="_blank" rel="noreferrer" style={s.help}
      aria-label="Help for this screen" title="Help for this screen">
      <HelpCircle size={20} aria-hidden="true" />
    </a>
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
/** A new version is waiting: it goes in by itself when this bill is done, or now on a tap. */
function UpdateReady() {
  const [ready, setReady] = useState(updateReady())
  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener('pos:update-ready', on)
    return () => window.removeEventListener('pos:update-ready', on)
  }, [])
  if (!ready) return null
  return (
    <span className="chip" style={s.state} role="status">
      A new version is ready — it updates by itself when the till is free.{' '}
      <button type="button" onClick={applyUpdate} style={{ padding: '0 6px' }}>Update now</button>
    </span>
  )
}

function Connection({ status, offline, waiting, inventory, inventoryStopped }) {
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
  // Saved here, but not reaching Inventory: never "All saved · Inventory connected" while that is so.
  if (inventory && inventoryStopped) {
    return (
      <Link to="/inventory-link" className="chip warn" style={s.state}>
        <Dot color="var(--warn)" /> All saved · Sending to Inventory has stopped
      </Link>
    )
  }
  return (
    <span className="chip good" style={s.state}>
      {/* "Inventory connected" only when this shop's own link is on -- never from the server's setting. */}
      <Dot color="var(--good)" /> {inventory ? 'All saved · Inventory connected' : 'All saved'}
    </span>
  )
}

const Dot = ({ color }) => <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: color, display: 'inline-block' }} />

const s = {
  help: { display: 'grid', placeItems: 'center', minWidth: 40, minHeight: 40, borderRadius: 999, color: 'var(--brand-deep)', flexShrink: 0 },
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
