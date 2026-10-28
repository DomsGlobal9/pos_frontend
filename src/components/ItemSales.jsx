import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadItemSales, rupees, messageFor } from '../lib/api.js'

/**
 * Every item sold in the report's period (28 Oct), not just the top ten: pieces and value sold less
 * returned, with colour and size, and what is left on the shelf now. "By design" adds a design's
 * colours and sizes together, which is how a shop decides what to buy again. Loaded when opened.
 */
export default function ItemSales({ range }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [byGroup, setByGroup] = useState(false)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['item-sales', range.from, range.to],
    queryFn: () => loadItemSales(range),
    enabled: open
  })

  if (!open) return <button type="button" onClick={() => setOpen(true)} style={s.open}>See every item sold</button>
  if (isLoading) return <p style={s.muted}>Adding up every item…</p>
  if (isError) return <p style={s.bad}>{messageFor(error)}</p>

  const needle = q.trim().toLowerCase()
  const rows = data.items.filter(i => !needle || [i.name, i.code, i.colour, i.size, i.group].some(v => v && v.toLowerCase().includes(needle)))
  const groups = data.groups.filter(g => !needle || g.group.toLowerCase().includes(needle))

  return (
    <div style={s.wrap} aria-label="Every item sold">
      <div style={s.bar}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find an item, colour or size" aria-label="Find in items sold" style={{ flex: 1, minWidth: 160 }} />
        {data.groups.length > 0 && (
          <button type="button" aria-pressed={byGroup} onClick={() => setByGroup(!byGroup)}>{byGroup ? 'Each item' : 'By design'}</button>
        )}
      </div>
      <p style={s.muted}>
        {data.items.length} items · {data.totals.netQty} pieces · {rupees(data.totals.netPaise)} after {data.totals.returnedQty} returned. Values include GST.
      </p>
      {byGroup ? (
        <ul style={s.list}>
          {groups.map(g => (
            <li key={g.group} style={s.row}>
              <span style={{ flex: 1 }}><b>{g.group}</b><div style={s.muted}>{g.items} colours / sizes</div></span>
              <span style={s.num}><b>{g.netQty}</b><div style={s.muted}>{rupees(g.netPaise)}</div></span>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? <p style={s.muted}>{needle ? 'Nothing matches that.' : 'Nothing sold in this period.'}</p> : (
        <ul style={s.list}>
          {rows.map(i => (
            <li key={i.key} style={s.row}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={s.ellipsis}>{i.name}</div>
                <div style={s.muted}>
                  {[i.colour, i.size, i.code].filter(Boolean).join(' · ') || 'typed on the bill'}
                  {i.returnedQty ? ` · ${i.returnedQty} back` : ''}
                  {i.leftNow !== null && i.leftNow !== undefined ? ` · ${Math.max(0, i.leftNow)} left` : ''}
                </div>
              </span>
              <span style={s.num}><b>{i.netQty}</b><div style={s.muted}>{rupees(i.netPaise)}</div></span>
            </li>
          ))}
        </ul>
      )}
      <p style={s.muted}>The accountant's Excel (Connections → Export) has the same list as the sheet "Items sold".</p>
    </div>
  )
}

const s = {
  open: { justifySelf: 'start' },
  wrap: { display: 'grid', gap: 8 },
  bar: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', maxHeight: 420, overflowY: 'auto' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 },
  num: { textAlign: 'right' },
  ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  muted: { color: 'var(--ink-soft)', fontSize: 12, margin: 0 },
  bad: { color: 'var(--bad)' }
}
