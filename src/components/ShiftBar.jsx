import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { loadShift } from '../lib/api.js'

/**
 * One line above the sell screen when the drawer needs attention. POS-SHIFT-001, -009.
 *
 * It NEVER stops a sale. A customer at the counter is served; cash taken with no shift open is
 * reported at the day close on its own line. But the cashier is told, in words, that the cash they
 * are about to take will not count in any drawer -- which is what makes them open one.
 *
 * Silent when a shift is open and it is today's. Nothing to say is nothing on the screen.
 */
export default function ShiftBar({ counter }) {
  const { data } = useQuery({
    queryKey: ['shift', counter?.id],
    queryFn: () => loadShift(counter.id),
    enabled: !!counter,
    staleTime: 30_000
  })

  if (!data) return null

  if (!data.open) {
    return (
      <Link to="/shift" style={s.bar}>
        No shift open on {data.counter.name}. Cash taken now won't count in any drawer. <b>Open shift →</b>
      </Link>
    )
  }

  if (data.open.openSinceYesterday) {
    return (
      <Link to="/shift" style={{ ...s.bar, ...s.late }}>
        This shift has been open since yesterday. <b>Count and close it →</b>
      </Link>
    )
  }

  return null
}

const s = {
  bar: {
    display: 'block', marginBottom: 10, padding: '10px 12px', borderRadius: 10, fontSize: 14,
    border: '1px solid var(--line)', color: 'var(--warn)', textDecoration: 'none', background: 'var(--panel)'
  },
  late: { color: 'var(--bad)' }
}
