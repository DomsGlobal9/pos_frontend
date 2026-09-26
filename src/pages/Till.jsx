import { useQuery } from '@tanstack/react-query'
import { ScanBarcode, Plug, PlugZap, Database } from 'lucide-react'
import { health } from '../lib/api.js'

/**
 * The sell screen.
 *
 * Empty for now -- this is the skeleton. What it already proves is worth having: the till is served,
 * it reaches its server, the server reaches its database, and it knows whether it is running
 * standalone or with Inventory behind it.
 *
 * The shape below is the shape it keeps: one screen, no navigation during a sale. Items build up on
 * the left, the total sits on the right and stays large and visible. Nothing here will move a
 * cashier off this screen to finish a bill.
 */
export default function Till() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: health,
    refetchInterval: 30_000
  })

  return (
    <div className="till" style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <ScanBarcode size={22} />
          <span>ScaleEzy POS</span>
        </div>
        <Status loading={isLoading} error={isError} health={data} />
      </header>

      <main style={styles.body}>
        <section style={styles.basket}>
          <div style={styles.empty}>
            <ScanBarcode size={40} strokeWidth={1.25} />
            <h2 style={styles.emptyTitle}>Scan an item to start</h2>
            <p style={styles.emptyText}>
              The sell screen lands here next: scan or search, the item appears, the total adds up.
            </p>
          </div>
        </section>

        <aside style={styles.totals}>
          <div>
            <div style={styles.totalLabel}>Total</div>
            {/* Always visible, always large. The one number a cashier and a customer both look at. */}
            <div style={styles.totalValue}>₹0</div>
          </div>
          <button disabled style={{ ...styles.complete, opacity: 0.45, cursor: 'not-allowed' }}>
            Complete sale
          </button>
        </aside>
      </main>
    </div>
  )
}

/**
 * Says plainly what is and is not working, in words rather than a coloured dot. If the database is
 * unreachable the shop needs to know before a customer is standing there, not after.
 */
function Status({ loading, error, health }) {
  if (loading) return <span style={styles.statusMuted}>Checking…</span>

  if (error || !health) {
    return (
      <span style={{ ...styles.status, color: 'var(--bad)' }}>
        <Plug size={16} /> No connection to the till server
      </span>
    )
  }

  const standalone = health.mode === 'standalone'
  return (
    <span style={styles.statusGroup}>
      <span style={{ ...styles.status, color: health.database === 'up' ? 'var(--good)' : 'var(--bad)' }}>
        <Database size={16} />
        {health.database === 'up' ? `Database ${health.databaseMs} ms` : 'Database unreachable'}
      </span>
      <span style={{ ...styles.status, color: standalone ? 'var(--warn)' : 'var(--ink-soft)' }}>
        <PlugZap size={16} />
        {standalone ? 'Standalone — own item list' : 'Inventory connected'}
      </span>
    </span>
  )
}

const styles = {
  page: { height: '100%', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--line)'
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 18 },
  statusGroup: { display: 'flex', alignItems: 'center', gap: 18 },
  status: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 },
  statusMuted: { fontSize: 14, color: 'var(--ink-soft)' },
  body: { flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', minHeight: 0 },
  basket: { padding: 20, overflow: 'auto' },
  empty: {
    height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 8, color: 'var(--ink-soft)', textAlign: 'center'
  },
  emptyTitle: { margin: 0, fontSize: 20, color: 'var(--ink)' },
  emptyText: { margin: 0, maxWidth: 360, lineHeight: 1.6 },
  totals: {
    borderLeft: '1px solid var(--line)', background: 'var(--panel)', padding: 20,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
  },
  totalLabel: { fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 },
  totalValue: { fontSize: 44, fontWeight: 700, lineHeight: 1.1, marginTop: 4 },
  complete: { width: '100%', minHeight: 56, fontSize: 17, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
}
