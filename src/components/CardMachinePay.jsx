import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadCardMachines, startCardPayment, loadCardPayment, cancelCardPayment, rupees, messageFor } from '../lib/api.js'
import { newOnceKey } from '../lib/basket.js'

/**
 * CARD MACHINES THAT CONFIRM THEMSELVES (24 Oct). The amount is sent to the shop's card machine; the
 * customer taps or inserts there; the row fills itself with the slip's last 4 and approval code. The
 * till asks every 2 s. The server asks the machine again at Complete, so this screen's "approved" is
 * only a signal.
 *
 * No machine set up, offline, or the provider slow: nothing here, or one line, and the slip is typed
 * below as before -- that works with every machine there is.
 */
/** Cancel a request on its machine once: Back and this row closing would otherwise both ask. */
const cancelled = new Map()
export function cancelOnce(requestId) {
  if (!cancelled.has(requestId)) cancelled.set(requestId, cancelCardPayment(requestId).catch(err => { cancelled.delete(requestId); throw err }))
  return cancelled.get(requestId)
}

export default function CardMachinePay({ amountPaise, counterId, onChange }) {
  // Shared with Settings: a machine the owner adds is offered here without a reload.
  const { data } = useQuery({ queryKey: ['card-machines'], queryFn: () => loadCardMachines(), staleTime: 60_000, retry: false })
  const machines = data?.machines ?? []
  const [picked, setPicked] = useState('')
  const machineId = (machines.find(m => m.id === picked) ?? machines.find(m => m.counterId && m.counterId === counterId) ?? machines[0])?.id ?? ''
  const [req, setReq] = useState(null)        // { requestId, amountPaise, testMode }
  const [state, setState] = useState('idle')  // idle | sending | waiting | approved | refused | cancelled
  const [note, setNote] = useState('')
  const live = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // The amount changed under a request: that request is for the old amount. Cancel it on the machine.
  useEffect(() => {
    if (req && req.amountPaise !== amountPaise && state === 'waiting') stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountPaise])

  // The row goes away with an amount still on the machine: take it off.
  // ponytail: a card approved in that same second is still caught by the server's sweep, not lost.
  useEffect(() => () => { if (live.current && stateRef.current === 'waiting') cancelOnce(live.current).catch(() => {}) }, [])

  useEffect(() => {
    if (state !== 'waiting' || !req) return
    live.current = req.requestId
    const timer = setInterval(async () => {
      try {
        const s = await loadCardPayment(req.requestId)
        if (live.current !== req.requestId) return
        take(s)
      } catch { /* a missed poll is retried in 2 s */ }
    }, 2000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, req?.requestId])

  function take(s) {
    if (s.status === 'APPROVED') {
      setState('approved'); setNote('')
      onChange({ cardRequestId: s.requestId, approved: true, last4: s.last4, approvalCode: s.approvalCode })
    } else if (s.status === 'DECLINED' || s.status === 'CANCELLED') {
      setState('cancelled'); setReq(null); setNote(s.detail ?? ''); onChange(null)
    } else if (s.detail) {
      setNote(s.detail)
    }
  }

  async function send() {
    setState('sending'); setNote('')
    try {
      const made = await startCardPayment(machineId, amountPaise, newOnceKey())
      if (!made.ok) { setState('refused'); setNote(made.reason); return }
      setReq(made); setState('waiting'); onChange({ cardRequestId: made.requestId, approved: false })
      if (made.status !== 'WAITING') take(made)
    } catch (err) {
      setState('refused'); setNote(messageFor(err))
    }
  }

  async function stop() {
    if (!req) return
    try {
      const s = await cancelOnce(req.requestId)
      // Approved in the meantime: that money is this bill's -- keep it, never ask for it again.
      if (s.status === 'APPROVED') return take(s)
      setState('idle'); setReq(null); setNote(s.status === 'CANCELLED' ? '' : (s.detail ?? '')); onChange(null)
    } catch (err) {
      setNote(messageFor(err))
    }
  }

  if (!machines.length || !navigator.onLine) return null
  const machine = machines.find(m => m.id === machineId)

  if (state === 'idle' || state === 'sending' || state === 'refused' || state === 'cancelled') {
    return (
      <div style={s.wrap}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={send} disabled={state === 'sending' || !amountPaise || !machineId} style={s.button}>
            {state === 'sending' ? 'Sending…' : `Send ${rupees(amountPaise)} to the card machine`}
          </button>
          {machines.length > 1 && (
            <select value={machineId} onChange={e => setPicked(e.target.value)} aria-label="Card machine">
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>
        {machine?.testMode && <p style={s.muted}>{machine.name} is on its test system: no real money moves.</p>}
        {note && <p style={s.muted} role="status">{note}{state === 'refused' ? '' : ' Send it again, or type the slip below.'}</p>}
      </div>
    )
  }
  return (
    <div style={s.box} aria-label="Card machine">
      {state === 'approved'
        ? <p style={s.paid} role="status">Approved ✓ {rupees(amountPaise)} on the card machine.</p>
        : <>
            <p style={s.muted} role="status">{note || `Waiting for the customer's card on ${machine?.name ?? 'the machine'}…`}</p>
            <button type="button" onClick={stop}>Cancel on the machine</button>
          </>}
    </div>
  )
}

const s = {
  wrap: { display: 'grid', gap: 6 },
  button: { justifySelf: 'start' },
  box: { display: 'grid', justifyItems: 'center', gap: 6, padding: 10, border: '1px solid var(--line)', borderRadius: 12 },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 13 },
  paid: { margin: 0, color: 'var(--good, #15803d)', fontWeight: 700 }
}
