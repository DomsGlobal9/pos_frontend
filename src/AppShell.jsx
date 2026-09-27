import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { health, loadShop } from './lib/api.js'
import { useDevice, isTouchFirst } from './lib/useMedia.js'
import NavBar from './components/NavBar.jsx'
import { useEffect } from 'react'
import { checkIn } from './lib/device.js'

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

  const { data: status } = useQuery({ queryKey: ['health'], queryFn: health, refetchInterval: 30_000 })
  const { data: shop } = useQuery({ queryKey: ['shop'], queryFn: loadShop, staleTime: Infinity })

  // This device checks in when the till opens and every minute after. Never blocks anything.
  useEffect(() => {
    checkIn()
    const t = setInterval(checkIn, 60_000)
    return () => clearInterval(t)
  }, [])

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
              {shop?.cashier?.name && <div style={s.who}>{shop.cashier.name}</div>}
            </div>
          </div>
          <Connection status={status} />
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
function Connection({ status }) {
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
  who: { fontSize: 12, color: 'var(--ink-soft)' },
  state: { fontSize: 12, textAlign: 'right', whiteSpace: 'normal' },
  content: { flex: 1, minHeight: 0, overflow: 'auto' }
}
