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

/** Call in a popup with what its Close / Back button does. */
export default function useEscape(close) {
  const ref = useRef(close)
  ref.current = close
  useEffect(() => {
    stack.push(ref)
    return () => { stack.splice(stack.indexOf(ref), 1) }
  }, [])
}
