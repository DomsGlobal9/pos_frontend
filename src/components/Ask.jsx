import { useEffect, useRef, useState } from 'react'

/**
 * The till's own ask-a-question dialog, replacing window.prompt and window.confirm.
 *
 * WHY NOT THE BROWSER'S. A native dialog looks like a till is supposed to look on nobody's
 * counter, but the reason it had to go is worse than looks: after a few in a row Chrome offers
 * "prevent this page from creating additional dialogs", and a cashier who ticks it has silently
 * turned OFF discounts, price changes and payment checks for the rest of that session. The button
 * still presses. Nothing happens. Nothing says why. Found on the live till, 5 Oct.
 *
 * Three more things a native dialog cannot do, all of which matter at a counter:
 *   - it is an OS box, so it ignores the shop's tablet layout and is small under a finger
 *   - it blocks the main thread, so a barcode scanned mid-question types into the OS, not the till
 *   - it cannot show its own arithmetic -- "10%" with no "= Rs 2,449.90" under it is a guess
 * And no automated browser can drive one, which is why discount and price override had no UI test.
 *
 * THE SHAPE FOLLOWS THE SCREEN. A bottom sheet under 768px, where a thumb is, and a centred box
 * above it, because a sheet glued to the bottom edge of a 27-inch monitor looks broken.
 *
 * Promise in, answer out, so a call site reads almost exactly as the window.* one it replaces:
 *
 *     const typed = await askText('Money off the whole bill...', '0')   // null if cancelled
 *     if (!await askYesNo('Throw this away?')) return
 */

let deliver = null
const waiting = []

function request(question) {
  return new Promise(resolve => {
    const full = { ...question, resolve }
    if (deliver) deliver(full)
    else waiting.push(full)
  })
}

/** Like window.prompt: the typed string, or null if the person backed out. */
export const askText = (message, defaultValue = '', options = {}) =>
  request({ kind: 'text', message, defaultValue, ...options })

/** Like window.confirm: true or false. */
export const askYesNo = (message, options = {}) =>
  request({ kind: 'yesno', message, ...options })

/** Mounted once, next to the router. Everything above talks to this. */
export default function AskHost() {
  const [question, setQuestion] = useState(null)
  const [value, setValue] = useState('')
  const box = useRef(null)
  const panel = useRef(null)
  const no = useRef(null)

  useEffect(() => {
    deliver = next => { setQuestion(next); setValue(next.defaultValue ?? '') }
    if (waiting.length) deliver(waiting.shift())
    return () => { deliver = null }
  }, [])

  // The text box takes focus, so a question can be answered and dismissed without a mouse.
  // A yes/no puts focus on Cancel (found 9 Oct: nothing had it, so Escape did nothing): Esc backs out, a stray Enter is harmless.
  useEffect(() => { if (question?.kind === 'text') box.current?.select(); else if (question) no.current?.focus() }, [question])

  function answer(result) {
    question?.resolve(result)
    setQuestion(null)
    // The next one, if two were asked at once.
    if (waiting.length) deliver(waiting.shift())
  }

  if (!question) return null

  const { kind, message, hint, note, confirmLabel, danger, placeholder, inputMode } = question
  const cancel = () => answer(kind === 'text' ? null : false)

  return (
    <div
      className="ask-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={message}
      onMouseDown={e => { if (e.target === e.currentTarget) cancel() }}
    >
      <form
        ref={panel}
        className="ask-panel"
        onSubmit={e => { e.preventDefault(); answer(kind === 'text' ? value : true) }}
        /*
         * Escape closes it wherever focus is. A till is used by people who reach for Esc before
         * they reach for a mouse, and a question with no way out is how a counter gets stuck.
         */
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } }}
      >
        <p className="ask-message">{message}</p>
        {note && <p className="ask-note">{note}</p>}

        {kind === 'text' && (
          <>
            <input
              ref={box}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              inputMode={inputMode}
              aria-label={message}
              autoFocus
            />
            {hint && <p className="ask-hint">{hint}</p>}
          </>
        )}

        <div className="ask-buttons">
          <button ref={no} type="button" onClick={cancel}>Cancel</button>
          <button
            type="submit"
            style={danger
              ? { background: 'var(--bad)', borderColor: 'var(--bad)', color: '#fff' }
              : { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}
          >
            {confirmLabel ?? (kind === 'text' ? 'Save' : 'Yes')}
          </button>
        </div>
      </form>
    </div>
  )
}
