import { useEffect, useRef } from 'react'

/*
 * Escape closes the popup on top (found 9 Oct: only the yes/no questions did). One stack, one listener:
 * an approval opened over the payment screen closes alone, the payment screen stays.
 */
const stack = []
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !stack.length || e.defaultPrevented) return
  e.preventDefault()
  stack[stack.length - 1].current?.()
})

/*
 * Tab stays inside an open popup (found 9 Oct: after Complete sale it walked into the menu behind,
 * where a scan would add to the bill being paid). Shift+Tab goes round the other way.
 */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
window.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return
  const open = document.querySelectorAll('[role="dialog"]')
  if (!open.length) return
  const box = document.activeElement?.closest('[role="dialog"]') ?? open[open.length - 1]
  const all = [...box.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length)
  if (!all.length) return
  const first = all[0], last = all[all.length - 1], at = document.activeElement
  if (!box.contains(at)) { e.preventDefault(); first.focus() }
  else if (e.shiftKey && at === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
})

/** Call in a popup with what its Close / Back button does. */
export default function useEscape(close) {
  const ref = useRef(close)
  ref.current = close
  useEffect(() => {
    stack.push(ref)
    return () => { stack.splice(stack.indexOf(ref), 1) }
  }, [])
}
