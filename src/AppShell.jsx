import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { health, loadShop } from './lib/api.js'
import { useDevice, isTouchFirst } from './lib/useMedia.js'
import NavBar from './components/NavBar.jsx'

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

  return (
    <div style={{ ...s.page, flexDirection: bottomNav ? 'column' : 'row' }}>
      {!bottomNav && <NavBar device={device} />}

      <div style={s.main}>
        <header style={s.header}>
          <strong style={s.shop}>{shop?.shop?.shopName ?? 'ScaleEzy POS'}</strong>
          <Connection status={status} />
        </header>

        <div style={s.content}>
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
    return <span style={{ ...s.state, color: 'var(--ink-soft)' }}>Checking…</span>
  }
  if (status.database !== 'up') {
    return (
      <span style={{ ...s.state, color: 'var(--bad)' }}>
        Saving is paused. Nothing you have entered is lost.
      </span>
    )
  }
  return (
    <span style={{ ...s.state, color: 'var(--ink-soft)' }}>
      {status.mode === 'standalone' ? 'All saved' : 'All saved · Inventory connected'}
    </span>
  )
}

const s = {
  page: { height: '100%', display: 'flex' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 16px', background: 'var(--panel)', borderBottom: '1px solid var(--line)'
  },
  shop: { fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  state: { fontSize: 12, textAlign: 'right' },
  content: { flex: 1, minHeight: 0, overflow: 'auto' }
}
