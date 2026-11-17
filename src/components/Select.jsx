import { Children, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { usePopover } from '../lib/popover.js'

/**
 * THE TILL'S OWN DROP-DOWN (17 Nov, owner: "fix all dropdowns, no native should be there").
 *
 * A browser <select> opens the operating system's list: grey, tiny on a touch screen, different on
 * every device, and nothing the till can style. This is a button and a list of the till's own.
 *
 * It is used exactly like the <select> it replaces -- value, onChange(e) with e.target.value, and
 * <option> children -- so a screen changes one word to switch.
 *
 * Keyboard, as a drop-down should: Enter, Space or an arrow opens it; arrows, Home and End move;
 * Enter or Space chooses; Escape or Tab closes; typing a letter jumps to the first match. Focus stays
 * on the button throughout, which is what tells a screen reader which option is current.
 */
const textOf = node => (node == null || node === false ? '' : Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'object' ? textOf(node.props?.children) : String(node))

export default function Select({ value, onChange, children, disabled = false, className = '', style, name, id, 'aria-label': ariaLabel, ...rest }) {
  const options = useMemo(() => Children.toArray(children)
    .filter(c => c?.type === 'option')
    .map(c => ({ value: String(c.props.value ?? ''), label: c.props.children, text: textOf(c.props.children), disabled: Boolean(c.props.disabled) })), [children])
  const current = String(value ?? '')
  const chosen = options.findIndex(o => o.value === current)

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const button = useRef(null)
  const list = useRef(null)
  const typed = useRef({ text: '', at: 0 })
  const listId = useId()
  const close = () => setOpen(false)
  const place = usePopover(open, button, list, close, { minWidth: 180, maxHeight: 336 })

  const show = (at = chosen >= 0 ? chosen : options.findIndex(o => !o.disabled)) => {
    if (disabled || options.length === 0) return
    setActive(at); setOpen(true)
    // After it is drawn: bring the current choice into view in a long list.
    requestAnimationFrame(() => list.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }))
  }
  const choose = o => {
    if (!o || o.disabled) return
    setOpen(false)
    if (o.value !== current) onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } })
  }
  const move = (from, step) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i
    return from
  }
  const goTo = i => {
    setActive(i)
    requestAnimationFrame(() => list.current?.children[i]?.scrollIntoView({ block: 'nearest' }))
  }

  const onKeyDown = e => {
    if (disabled) return
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); show() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close()
    else if (e.key === 'ArrowDown') { e.preventDefault(); goTo(move(active, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(move(active, -1)) }
    else if (e.key === 'Home') { e.preventDefault(); goTo(move(-1, 1)) }
    else if (e.key === 'End') { e.preventDefault(); goTo(move(options.length, -1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[active]) }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const hit = options.findIndex(o => !o.disabled && o.text.toLowerCase().startsWith(typed.current.text))
      if (hit >= 0) goTo(hit)
    }
  }

  return (
    <>
      <button
        {...rest}
        ref={button} id={id} type="button" role="combobox" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        className={`select-btn ${className}`.trim()} style={style} data-value={current}
        onClick={() => (open ? close() : show())} onKeyDown={onKeyDown}
      >
        <span className="select-value">{chosen >= 0 ? options[chosen].label : ''}</span>
        <ChevronDown size={18} strokeWidth={2.5} aria-hidden className="select-chevron" />
      </button>
      {open && createPortal(
        // The list never takes focus (the button keeps it), so a press must not move it away.
        <ul ref={list} id={listId} role="listbox" aria-label={ariaLabel} className="select-list" style={place} onMouseDown={e => e.preventDefault()}>
          {options.map((o, i) => (
            <li
              key={o.value} id={`${listId}-${i}`} role="option" data-value={o.value}
              aria-selected={i === chosen} aria-disabled={o.disabled || undefined}
              className={`select-option${i === active ? ' is-active' : ''}`}
              onPointerMove={() => { if (!o.disabled && active !== i) setActive(i) }}
              onClick={() => choose(o)}
            >
              <span className="select-option-text">{o.label}</span>
              {i === chosen && <Check size={16} strokeWidth={2.5} aria-hidden />}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  )
}
