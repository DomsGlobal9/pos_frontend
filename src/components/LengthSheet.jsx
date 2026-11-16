import { useEffect, useRef, useState } from 'react'
import { rupees } from '../lib/api.js'
import useEscape from '../lib/useEscape.js'
import { fromTyped, perUnitPaise, qtyText, quickLengths, stepOf } from '../lib/units.js'

/**
 * HOW MUCH? (16 Nov, selling cloth by the metre.)
 *
 * Cloth is sold by length, so adding it asks for one. A few lengths a shop cuts often are one tap; any
 * other is typed in metres ("2.3") and taken to the nearest step of the shop's smallest cut, said out
 * loud ("2.25 m: cut in steps of 0.25 m") so the cashier never charges for a length nobody cut.
 * Inventory refuses a length off the steps, so the till only ever offers steps.
 */
export default function LengthSheet({ item, onAdd, onClose }) {
  useEscape(onClose)
  const unit = item.unit
  const [typed, setTyped] = useState('')
  const box = useRef(null)
  useEffect(() => { box.current?.focus() }, [])

  const base = typed.trim() ? fromTyped(typed, unit) : null
  const asked = Number(String(typed).replace(',', '.'))
  const moved = base !== null && Math.round(asked * unit.factor) !== base
  const per = perUnitPaise(item.pricePaise, unit)
  const step = stepOf(unit)
  const left = item.availableQty

  return (
    <div style={s.backdrop} role="dialog" data-sheet aria-label={`How much ${item.name}?`} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.head}>
          <div>
            <b>{item.name}</b>
            <div style={s.muted}>
              {rupees(per)} / {unit.short}
              {step > 1 ? ` · cut in steps of ${qtyText(step, unit)}` : ''}
              {left !== null && left !== undefined ? ` · ${qtyText(Math.max(0, left), unit)} left` : ''}
            </div>
          </div>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={s.quick}>
          {quickLengths(unit).map(b => (
            <button key={b} style={s.quickBtn} onClick={() => onAdd(b)} aria-label={`Add ${qtyText(b, unit)}`}>
              {qtyText(b, unit)}
              <span style={s.muted}>{rupees(b * item.pricePaise)}</span>
            </button>
          ))}
        </div>

        <form onSubmit={e => { e.preventDefault(); if (base) onAdd(base) }} style={s.form}>
          <label style={s.label}>
            Or type the length, in {unit.short === 'm' ? 'metres' : unit.short}
            <input
              ref={box} value={typed} onChange={e => setTyped(e.target.value)}
              inputMode="decimal" placeholder={unit.short === 'm' ? '2.25' : '1.5'} aria-label={`Length in ${unit.short}`}
            />
          </label>
          {base !== null && (
            <div style={moved ? s.note : s.muted}>
              {moved ? `${qtyText(base, unit)}: cut in steps of ${qtyText(step, unit)}. ` : ''}
              {qtyText(base, unit)} × {rupees(per)} / {unit.short} = <b>{rupees(base * item.pricePaise)}</b>
            </div>
          )}
          <button type="submit" style={s.primary} disabled={!base}>
            {base ? `Add ${qtyText(base, unit)}` : 'Add'}
          </button>
        </form>
      </div>
    </div>
  )
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
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  quick: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 },
  quickBtn: { display: 'grid', gap: 2, minHeight: 56, fontWeight: 600 },
  form: { display: 'grid', gap: 8 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', minHeight: 48 },
  note: { color: 'var(--warn)', fontSize: 13 },
  muted: { color: 'var(--ink-soft)', fontSize: 12, fontWeight: 400 }
}
