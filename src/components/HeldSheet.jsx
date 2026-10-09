import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { loadHeldBills, recallBill, discardHeldBill, messageFor } from '../lib/api.js'
import { askYesNo } from './Ask.jsx'
import useEscape from '../lib/useEscape.js'

/**
 * WF-HELD-01. POS-SELL-020, -021.
 *
 * Every parked bill in the shop -- the shift's, not one cashier's, so whoever is free finishes it.
 * Oldest first, because the one waiting longest is usually the customer standing there longest.
 *
 * A PARKED BILL IS A DRAFT. Nothing was sold, nothing is kept for anyone. That is why it lives on
 * the Sell screen rather than under Orders.
 */
export default function HeldSheet({ basketIsEmpty, onRecalled, onClose }) {
  useEscape(onClose)
  const queryClient = useQueryClient()
  // Always read fresh when opened: a bill parked a moment ago -- here or at another till -- must be
  // on the list. With the app's 30-second cache it was not, and a cashier would think it was lost.
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['held-bills'], queryFn: loadHeldBills, staleTime: 0, refetchOnMount: 'always' })

  async function takeBack(held) {
    // One bill on the till at a time. Recalling over a half-built basket would silently throw the
    // current one away.
    if (!basketIsEmpty) {
      toast.error('Park or clear the bill on the till first.')
      return
    }
    try {
      const payload = await recallBill(held.id)
      queryClient.invalidateQueries({ queryKey: ['held-bills'] })
      onRecalled(payload)
    } catch (err) {
      // Most likely a colleague took it a moment earlier. Say so and refresh the list.
      toast.error(messageFor(err))
      queryClient.invalidateQueries({ queryKey: ['held-bills'] })
    }
  }

  async function throwAway(held) {
    if (!await askYesNo(`Throw away "${held.label}"?`, { note: 'Nothing was sold, so nothing else changes.', confirmLabel: 'Throw away', danger: true })) return
    try {
      await discardHeldBill(held.id)
      queryClient.invalidateQueries({ queryKey: ['held-bills'] })
    } catch (err) {
      toast.error(messageFor(err))
    }
  }

  const bills = data ?? []

  return (
    <div style={s.backdrop} role="dialog" data-sheet aria-label="Parked bills" onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.head}>
          <b>Parked bills</b>
          <button onClick={onClose}>Close</button>
        </div>

        {isLoading && <p style={s.muted}>Loading…</p>}
        {isError && <p style={s.bad}>{messageFor(error)}</p>}
        {!isLoading && bills.length === 0 && <p style={s.muted}>Nothing parked.</p>}

        <ul style={s.list}>
          {bills.map(held => (
            <li key={held.id} style={s.row}>
              <button style={s.main} onClick={() => takeBack(held)}>
                <b>{held.label}</b>
                <span style={s.muted}>
                  {held.itemCount} {held.itemCount === 1 ? 'piece' : 'pieces'}
                  {' · '}{held.counterName}
                  {held.parkedBy ? ` · ${held.parkedBy}` : ''}
                  {' · '}{new Date(held.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </button>
              <button style={s.bin} onClick={() => throwAway(held)} aria-label={`Throw away ${held.label}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(16,24,14,0.4)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
  },
  sheet: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px 12px 0 0',
    padding: 16, width: 520, maxWidth: '100%', maxHeight: '80vh', overflow: 'auto',
    display: 'grid', gap: 12, alignContent: 'start',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  row: { display: 'flex', gap: 6 },
  main: { flex: 1, display: 'grid', textAlign: 'left', fontWeight: 400, minHeight: 60, gap: 2 },
  bin: { minWidth: 48, fontSize: 18, color: 'var(--ink-soft)' },
  muted: { color: 'var(--ink-soft)', fontSize: 12 },
  bad: { color: 'var(--bad)', margin: 0 }
}
