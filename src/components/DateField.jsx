import { useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePopover } from '../lib/popover.js'

/**
 * THE TILL'S OWN DATE FIELD (17 Nov, owner: "no native should be there").
 *
 * <input type="date"> opens the browser's calendar: a different one on every device, small on a
 * touch screen, and on some laptops only a row of numbers to type over. This is a button that shows
 * the day in words ("17 Nov 2026") and a calendar of the till's own.
 *
 * Used like the input it replaces: value "YYYY-MM-DD", onChange(e) with e.target.value, min, max.
 *
 * The month's name at the top opens years and months, so a day years back (a report, an old day
 * close) is four presses, not forty. Arrows move by day and week, Page Up/Down by month, Escape
 * closes and gives focus back to the button.
 */
const pad = n => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? ''); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null }
const todayYmd = () => { const n = new Date(); return ymd(n.getFullYear(), n.getMonth(), n.getDate()) }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = [['S', 'Sunday'], ['M', 'Monday'], ['T', 'Tuesday'], ['W', 'Wednesday'], ['T', 'Thursday'], ['F', 'Friday'], ['S', 'Saturday']]
const words = s => { const p = parse(s); return p ? `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : '' }

export default function DateField({ value, onChange, min, max, disabled = false, placeholder = 'Choose a day', className = '', style, name, id, 'aria-label': ariaLabel, ...rest }) {
  const today = todayYmd()
  const chosen = parse(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('days')                     // 'days' | 'years'
  const [shown, setShown] = useState(() => chosen ?? parse(today))
  const button = useRef(null)
  const panel = useRef(null)
  const panelId = useId()
  const close = (refocus = false) => { setOpen(false); if (refocus) button.current?.focus() }
  const place = usePopover(open, button, panel, () => close(), { minWidth: 304, matchWidth: false, maxHeight: 440, watch: `${view}:${shown.y}-${shown.m}` })

  const allowed = d => (!min || d >= min) && (!max || d <= max)
  // At once when the day is already drawn (the same month), so a quick Enter after an arrow lands on
  // the day just moved to; a frame later when its month has yet to be drawn.
  const focusDay = d => {
    const now = panel.current?.querySelector(`[data-date="${d}"]`)
    if (now) now.focus()
    else requestAnimationFrame(() => panel.current?.querySelector(`[data-date="${d}"]`)?.focus())
  }

  const show = () => {
    if (disabled) return
    // Open on the chosen day; with none, on today, or on the nearest day that may be chosen.
    const start = chosen ?? parse(max && today > max ? max : min && today < min ? min : today)
    setShown({ y: start.y, m: start.m }); setView('days'); setOpen(true)
    focusDay(ymd(start.y, start.m, start.d))
  }
  const pick = d => {
    if (!allowed(d)) return
    close(true)
    if (d !== value) onChange?.({ target: { value: d, name }, currentTarget: { value: d, name } })
  }
  const step = months => setShown(s => { const n = new Date(s.y, s.m + months, 1); return { y: n.getFullYear(), m: n.getMonth() } })

  // The six weeks on show: the days before the 1st and after the last are left empty, not filled
  // with another month's numbers -- a pressed "30" must never turn out to be last month's.
  const weeks = useMemo(() => {
    const first = new Date(shown.y, shown.m, 1).getDay()
    const count = new Date(shown.y, shown.m + 1, 0).getDate()
    const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
    while (cells.length % 7) cells.push(null)
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  }, [shown.y, shown.m])

  const years = useMemo(() => {
    const now = parse(today).y
    const last = max ? parse(max).y : now + 2
    const first = Math.min(min ? parse(min).y : 2000, last)
    return Array.from({ length: last - first + 1 }, (_, i) => last - i)
  }, [min, max, today])
  const monthAllowed = (y, m) => (!min || ymd(y, m, new Date(y, m + 1, 0).getDate()) >= min) && (!max || ymd(y, m, 1) <= max)

  const onDayKey = (e, d) => {
    const p = parse(d)
    const to = (dy, dm = 0) => {
      e.preventDefault()
      const n = new Date(p.y, p.m + dm, p.d + dy)
      // A month with fewer days: land on its last one, not spill into the next.
      if (dm && n.getMonth() !== ((p.m + dm) % 12 + 12) % 12) n.setDate(0)
      const next = ymd(n.getFullYear(), n.getMonth(), n.getDate())
      if (!allowed(next)) return
      setShown({ y: n.getFullYear(), m: n.getMonth() }); focusDay(next)
    }
    if (e.key === 'ArrowLeft') to(-1)
    else if (e.key === 'ArrowRight') to(1)
    else if (e.key === 'ArrowUp') to(-7)
    else if (e.key === 'ArrowDown') to(7)
    else if (e.key === 'PageUp') to(0, -1)
    else if (e.key === 'PageDown') to(0, 1)
  }

  return (
    <>
      <button
        {...rest}
        ref={button} id={id} type="button" role="combobox" disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={ariaLabel}
        className={`select-btn date-btn ${className}`.trim()} style={style} data-value={value ?? ''}
        onClick={() => (open ? close() : show())}
        onKeyDown={e => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show() } }}
      >
        <span className={`select-value${chosen ? '' : ' is-empty'}`}>{chosen ? words(value) : placeholder}</span>
        <CalendarDays size={18} strokeWidth={2.2} aria-hidden className="select-chevron" />
      </button>
      {open && createPortal(
        <div
          ref={panel} id={panelId} role="dialog" aria-label={ariaLabel ? `${ariaLabel}: choose a day` : 'Choose a day'} className="cal" style={place}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) } }}
        >
          <div className="cal-head">
            <button type="button" className="cal-nav" aria-label="Earlier month" disabled={view !== 'days' || !monthAllowed(...Object.values(prevOf(shown)))} onClick={() => step(-1)}><ChevronLeft size={18} aria-hidden /></button>
            <button type="button" className="cal-title" aria-expanded={view === 'years'} onClick={() => setView(v => (v === 'days' ? 'years' : 'days'))}>
              {MONTHS[shown.m]} {shown.y}
            </button>
            <button type="button" className="cal-nav" aria-label="Later month" disabled={view !== 'days' || !monthAllowed(...Object.values(nextOf(shown)))} onClick={() => step(1)}><ChevronRight size={18} aria-hidden /></button>
          </div>

          {view === 'days' ? (
            <>
              <div className="cal-grid" role="grid" aria-label={`${MONTHS[shown.m]} ${shown.y}`}>
                <div className="cal-row" role="row">
                  {DAYS.map(([short, long], i) => <span key={i} className="cal-dow" role="columnheader" aria-label={long}>{short}</span>)}
                </div>
                {weeks.map((week, w) => (
                  <div key={w} className="cal-row" role="row">
                    {week.map((d, i) => {
                      if (!d) return <span key={i} role="gridcell" />
                      const date = ymd(shown.y, shown.m, d)
                      const on = date === value
                      return (
                        <button
                          key={i} type="button" role="gridcell" data-date={date} disabled={!allowed(date)}
                          aria-selected={on} aria-current={date === today ? 'date' : undefined}
                          aria-label={`${d} ${MONTHS[shown.m]} ${shown.y}${date === today ? ', today' : ''}`}
                          className={`cal-day${on ? ' is-on' : ''}${date === today ? ' is-today' : ''}`}
                          onClick={() => pick(date)} onKeyDown={e => onDayKey(e, date)}
                        >{d}</button>
                      )
                    })}
                  </div>
                ))}
              </div>
              {allowed(today) && value !== today && (
                <div className="cal-foot">
                  <button type="button" className="btn-quiet" onClick={() => pick(today)}>Today</button>
                </div>
              )}
            </>
          ) : (
            <div className="cal-jump">
              <div className="cal-years" role="group" aria-label="Year">
                {years.map(y => (
                  <button key={y} type="button" data-year={y} aria-pressed={y === shown.y} className="cal-chip" onClick={() => setShown(s => ({ ...s, y }))}>{y}</button>
                ))}
              </div>
              <div className="cal-months" role="group" aria-label="Month">
                {MONTHS.map((label, m) => (
                  <button
                    key={m} type="button" data-month={m} disabled={!monthAllowed(shown.y, m)} aria-pressed={m === shown.m} className="cal-chip"
                    onClick={() => { setShown(s => ({ ...s, m })); setView('days') }}
                  >{label.slice(0, 3)}</button>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

const prevOf = s => { const n = new Date(s.y, s.m - 1, 1); return { y: n.getFullYear(), m: n.getMonth() } }
const nextOf = s => { const n = new Date(s.y, s.m + 1, 1); return { y: n.getFullYear(), m: n.getMonth() } }
