import { useQuery } from '@tanstack/react-query'
import { loadVariants, rupees, messageFor } from '../lib/api.js'

/**
 * WF-PRODUCT-01. POS-SELL-006, -007, -008.
 *
 * Which colour, which size.
 *
 * A saree shop's search for "kanchipuram" returns the same saree three times in three colours, and
 * the cashier then reads three almost identical lines to find the one in the customer's hand. That
 * is slow at a counter and hopeless on a phone. So the search shows ONE row for the saree, and
 * tapping it opens this.
 *
 * OUT OF STOCK IS SHOWN, NOT HIDDEN. "We have it in green but not in blue" is something an
 * assistant needs to be able to say. A picker that silently drops blue makes them say "we do not
 * have it" instead, and the customer walks out. It stays tappable too -- a stock count is a guess
 * and the piece may be in the customer's hand already.
 */
export default function VariantSheet({ group, name, onPick, onClose }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['variants', group],
    queryFn: () => loadVariants(group)
  })

  return (
    <div style={s.backdrop} role="dialog" aria-label={`Choose ${name}`} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.head}>
          <b>{name}</b>
          <button onClick={onClose}>Close</button>
        </div>

        {isLoading && <p style={s.muted}>Loading…</p>}
        {isError && <p style={s.bad}>{messageFor(error)}</p>}

        <ul style={s.list}>
          {(data ?? []).map(variant => (
            <li key={variant.id}>
              <button style={s.option} onClick={() => onPick(variant)}>
                {variant.imageUrl
                  ? <img src={variant.imageUrl} alt="" style={s.swatch} />
                  : <span style={{ ...s.swatch, ...s.noImage }} aria-hidden="true" />}
                <span style={s.detail}>
                  <span>{[variant.colour, variant.size].filter(Boolean).join(' · ') || variant.code}</span>
                  <span style={s.muted}>{variant.code}</span>
                </span>
                <span style={s.right}>
                  <b>{rupees(variant.pricePaise)}</b>
                  <Left qty={variant.availableQty} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Null is not zero. An unknown count must never be shown as "none left". */
function Left({ qty }) {
  if (qty === null || qty === undefined) return null
  if (qty <= 0) return <span style={{ ...s.muted, color: 'var(--bad)' }}>none left</span>
  if (qty === 1) return <span style={{ ...s.muted, color: 'var(--warn)' }}>last one</span>
  return <span style={s.muted}>{qty} left</span>
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(16,24,14,0.4)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0
  },
  sheet: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderRadius: '12px 12px 0 0', padding: 16, width: 520, maxWidth: '100%',
    maxHeight: '80vh', overflow: 'auto', display: 'grid', gap: 12, alignContent: 'start',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  option: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    textAlign: 'left', fontWeight: 400, minHeight: 60
  },
  swatch: { width: 40, height: 40, borderRadius: 6, flex: '0 0 auto', objectFit: 'cover' },
  noImage: { background: 'var(--bg)', border: '1px solid var(--line)' },
  detail: { display: 'grid', flex: 1, minWidth: 0 },
  right: { display: 'grid', justifyItems: 'end', gap: 2 },
  muted: { color: 'var(--ink-soft)', fontSize: 12 },
  bad: { color: 'var(--bad)', margin: 0 }
}
