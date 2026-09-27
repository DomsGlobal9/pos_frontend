import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { findCustomerByPhone, createCustomer, rupees, messageFor } from '../lib/api.js'

/**
 * WF-CUST-01. POS-CUST-002, -004, -005, -006, -010.
 *
 * Adding or finding the customer, without leaving the sale.
 *
 * THE NUMBER IS THE IDENTITY, so this screen is a phone box and nothing else until a number has
 * been typed. Type it, and one of two things happens: we know them, and their name and history
 * appear; or we do not, and a name field appears with the number already captured.
 *
 * THE SKIP BUTTON IS AS IMPORTANT AS THE REST. Someone paying cash who will not give a number is
 * a normal Saturday, and a screen that makes a cashier feel they have to fill this in is a screen
 * that gets fake numbers typed into it — which is worse than no customer at all, because a fake
 * number becomes a permanent record that splits someone else's history.
 */
export default function CustomerSheet({ onPick, onSkip, onClose }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [found, setFound] = useState(null)
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const phoneBox = useRef(null)
  const nameBox = useRef(null)

  useEffect(() => { phoneBox.current?.focus() }, [])

  async function look(event) {
    event.preventDefault()
    if (!phone.trim() || busy) return
    setBusy(true)
    try {
      const customer = await findCustomerByPhone(phone)
      setFound(customer)
      setSearched(true)
      // Not known: the cashier's next move is the name, so put them there.
      if (!customer) requestAnimationFrame(() => nameBox.current?.focus())
    } catch (error) {
      // The server's phone messages are already written for a person -- "An Indian mobile number
      // starts with 6, 7, 8 or 9" -- so they go straight through.
      toast.error(messageFor(error))
      setSearched(false)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    try {
      const { customer } = await createCustomer({
        phone,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(consent ? { marketingConsent: true } : {})
      })
      onPick(customer)
    } catch (error) {
      toast.error(messageFor(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.backdrop} role="dialog" aria-label="Customer" onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.head}>
          <b>Customer</b>
          <button onClick={onSkip}>Skip</button>
        </div>

        <form onSubmit={look} style={s.form}>
          <label style={s.label}>
            Phone number
            <input
              ref={phoneBox}
              inputMode="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setSearched(false); setFound(null) }}
              placeholder="10-digit mobile"
              aria-label="Customer phone number"
            />
          </label>
          {!searched && (
            <button type="submit" disabled={!phone.trim() || busy}>
              {busy ? 'Looking…' : 'Look up'}
            </button>
          )}
        </form>

        {searched && found && (
          <div style={s.known}>
            <div style={s.knownName}>{found.name || 'No name yet'}</div>
            <div style={s.muted}>{found.phoneDisplay}</div>
            <div style={s.stats}>
              <span>{found.visitCount} {found.visitCount === 1 ? 'visit' : 'visits'}</span>
              <span>{rupees(found.lifetimeSpentPaise)} spent</span>
            </div>
            <button style={s.primary} onClick={() => onPick(found)}>
              Use {found.name ? found.name.split(' ')[0] : 'this customer'}
            </button>
          </div>
        )}

        {searched && !found && (
          <div style={s.newOne}>
            <p style={s.muted}>New customer. Adding them takes one field.</p>
            <label style={s.label}>
              Name
              <input
                ref={nameBox}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Optional"
                aria-label="Customer name"
              />
            </label>
            {/*
              * Only ever turned ON here. A screen without the tick is not the customer saying no —
              * it is usually nobody having asked — so nothing in the sell flow withdraws consent.
              */}
            <label style={s.check}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                style={s.checkbox}
              />
              <span>
                Happy to receive offers
                <div style={s.muted}>Only tick this if you asked and they said yes.</div>
              </span>
            </label>
            <button style={s.primary} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Add and use'}
            </button>
          </div>
        )}

        <p style={s.footnote}>
          A sale does not need a customer. Press Skip if they would rather not give a number.
        </p>
      </div>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
  },
  sheet: {
    background: 'var(--panel)', border: '1px solid var(--line)',
    borderRadius: '12px 12px 0 0', padding: 16, width: 460, maxWidth: '100%',
    maxHeight: '85vh', overflow: 'auto', display: 'grid', gap: 12, alignContent: 'start',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  form: { display: 'grid', gap: 10 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  known: { display: 'grid', gap: 6, padding: 12, border: '1px solid var(--line)', borderRadius: 10 },
  knownName: { fontSize: 18, fontWeight: 700 },
  stats: { display: 'flex', gap: 16, fontSize: 13, color: 'var(--ink-soft)' },
  newOne: { display: 'grid', gap: 10, padding: 12, border: '1px solid var(--line)', borderRadius: 10 },
  check: { display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14 },
  checkbox: { width: 22, height: 22, minHeight: 22, marginTop: 2, flex: '0 0 auto' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  muted: { color: 'var(--ink-soft)', fontSize: 12, fontWeight: 400 },
  footnote: { margin: 0, fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center' }
}
