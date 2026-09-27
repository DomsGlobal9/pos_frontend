import { Link } from 'react-router-dom'

/**
 * A registered screen that is honest about not being built yet.
 *
 * Orders and Customers are two of the five fixed primary destinations from day one (MASTER.md
 * §16.2), but their features arrive in Phases 5 and 3. Three ways to handle that, and only one is
 * acceptable:
 *
 *   - hide the tab           breaks the fixed five, and the nav moves under the user later
 *   - a dead tab             breaks "no dead buttons"
 *   - a registered screen that says what it will do, and offers the thing they can do now
 *
 * This is the third. It is recorded in FLOWS.md as a visible product compromise rather than
 * assumed to be fine: a shop opening the app during Phase 0 sees two tabs that do not yet work.
 */
export default function Placeholder({ title, does, arriving }) {
  return (
    <div style={s.page}>
      <h1 style={s.title}>{title}</h1>
      <p style={s.body}>{does}</p>
      <p style={s.muted}>{arriving}</p>
      <Link to="/sell" style={s.action}>Go to Sell</Link>
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  body: { margin: 0, lineHeight: 1.6 },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 13 },
  action: {
    justifySelf: 'start', display: 'inline-flex', alignItems: 'center', minHeight: 48,
    padding: '0 18px', borderRadius: 10, textDecoration: 'none',
    border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600
  }
}
