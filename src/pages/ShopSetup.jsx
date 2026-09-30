import { useState } from 'react'
import axios from 'axios'

/**
 * Setting up a new shop. For ScaleEzy staff, not for a shop -- reached only by typing /setup, never
 * from a menu, and useless without ScaleEzy's setup key.
 *
 * The key lives in this page's memory only: not stored, not in the address, gone when the tab
 * closes. The server checks it on every press and allows ten tries a minute.
 *
 * It makes the shop, Counter 1, the owner, and (optionally) the managers and cashiers, in one go --
 * everyone is checked first, so a mistake in the third person sets up nothing. Then it shows a card
 * to hand the owner: where to go and what to do first. Never a PIN or a password on it.
 */
const API = import.meta.env.VITE_API_BASE || '/api/v1'
const ROLE_LABEL = { OWNER: 'Owner', MANAGER: 'Manager', CASHIER: 'Cashier' }
const blankPerson = () => ({ name: '', role: 'CASHIER', pin: '', login: '', password: '' })

// "suresh@shop.in" is an email; ten digits are a phone. The server checks both properly.
const loginOf = (text) => {
  const t = (text ?? '').trim()
  if (!t) return {}
  return t.includes('@') ? { email: t } : { phone: t }
}

export default function ShopSetup() {
  const [key, setKey] = useState('')
  const [shop, setShop] = useState({ clientId: '', shopName: '', address: '', gstin: '' })
  const [owner, setOwner] = useState({ name: '', login: '', password: '', pin: '' })
  const [staff, setStaff] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const setPerson = (i, patch) => setStaff(list => list.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const body = {
        clientId: shop.clientId.trim(),
        shopName: shop.shopName.trim(),
        ...(shop.address.trim() ? { address: shop.address.trim() } : {}),
        ...(shop.gstin.trim() ? { gstin: shop.gstin.trim() } : {}),
        owner: { name: owner.name.trim(), ...loginOf(owner.login), password: owner.password, pin: owner.pin },
        staff: staff.map(p => ({
          name: p.name.trim(), role: p.role, pin: p.pin,
          ...(p.role !== 'CASHIER' && p.login.trim() ? loginOf(p.login) : {}),
          ...(p.role !== 'CASHIER' && p.password ? { password: p.password } : {})
        }))
      }
      const { data } = await axios.post(`${API}/platform/shops`, body, { headers: { 'x-platform-key': key.trim() }, timeout: 60_000 })
      setDone(data.data)
      // What was typed is not kept around once it has done its job.
      setOwner({ name: '', login: '', password: '', pin: '' }); setStaff([])
    } catch (err) {
      const status = err?.response?.status
      const said = err?.response?.data?.message
      setError(
        status === 404 ? 'Shop setup is switched off on this server.'
          : said && status && status < 500 ? said
            : err?.code === 'ECONNABORTED' ? 'The server took too long. Check the shop list before trying again -- it may have been set up.'
              : 'The server could not be reached. Check the connection and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Ready done={done} onAnother={() => { setDone(null); setShop({ clientId: '', shopName: '', address: '', gstin: '' }) }} />

  return (
    <div style={s.page}>
      <form style={s.card} onSubmit={submit} aria-label="Set up a new shop">
        <div>
          <h1 style={s.title}>Set up a new shop</h1>
          <p style={s.muted}>For ScaleEzy staff only.</p>
        </div>

        <label style={s.label}>ScaleEzy setup key
          <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} aria-label="ScaleEzy setup key" />
        </label>

        <h2 style={s.heading}>The shop</h2>
        <label style={s.label}>Shop id — the same one Inventory uses
          <input value={shop.clientId} onChange={e => setShop({ ...shop, clientId: e.target.value.replace(/\s/g, '') })} aria-label="Shop id" placeholder="sphl" />
        </label>
        <label style={s.label}>Name on the bill
          <input value={shop.shopName} onChange={e => setShop({ ...shop, shopName: e.target.value })} aria-label="Name on the bill" placeholder="SPHL" />
        </label>
        <label style={s.label}>Address on the bill (optional)
          <input value={shop.address} onChange={e => setShop({ ...shop, address: e.target.value })} aria-label="Address" />
        </label>
        <label style={s.label}>GSTIN (optional)
          <input value={shop.gstin} onChange={e => setShop({ ...shop, gstin: e.target.value.toUpperCase() })} aria-label="GSTIN" maxLength={15} />
        </label>

        <h2 style={s.heading}>The owner</h2>
        <label style={s.label}>Name
          <input value={owner.name} onChange={e => setOwner({ ...owner, name: e.target.value })} aria-label="Owner name" />
        </label>
        <label style={s.label}>Email or 10-digit phone — to open the till with
          <input value={owner.login} onChange={e => setOwner({ ...owner, login: e.target.value })} aria-label="Owner email or phone" autoComplete="off" />
        </label>
        <div style={s.two}>
          <label style={s.label}>Password (8 or more)
            <input type="password" value={owner.password} onChange={e => setOwner({ ...owner, password: e.target.value })} aria-label="Owner password" autoComplete="new-password" />
          </label>
          <label style={s.label}>4-digit PIN
            <input type="password" inputMode="numeric" value={owner.pin} onChange={e => setOwner({ ...owner, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} aria-label="Owner PIN" autoComplete="off" />
          </label>
        </div>

        <h2 style={s.heading}>Staff (optional — the owner can add them later)</h2>
        {staff.map((p, i) => (
          <fieldset key={i} style={s.person} aria-label={`Person ${i + 1}`}>
            <div style={s.two}>
              <label style={s.label}>Name
                <input value={p.name} onChange={e => setPerson(i, { name: e.target.value })} aria-label={`Person ${i + 1} name`} />
              </label>
              <label style={s.label}>Role
                <select value={p.role} onChange={e => setPerson(i, { role: e.target.value })} aria-label={`Person ${i + 1} role`}>
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
              </label>
            </div>
            <label style={s.label}>4-digit PIN
              <input type="password" inputMode="numeric" value={p.pin} onChange={e => setPerson(i, { pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} aria-label={`Person ${i + 1} PIN`} autoComplete="off" />
            </label>
            {p.role !== 'CASHIER' && (
              <div style={s.two}>
                <label style={s.label}>Email or phone to open the till (optional)
                  <input value={p.login} onChange={e => setPerson(i, { login: e.target.value })} aria-label={`Person ${i + 1} email or phone`} autoComplete="off" />
                </label>
                <label style={s.label}>Password (optional)
                  <input type="password" value={p.password} onChange={e => setPerson(i, { password: e.target.value })} aria-label={`Person ${i + 1} password`} autoComplete="new-password" />
                </label>
              </div>
            )}
            <button type="button" style={s.quiet} onClick={() => setStaff(list => list.filter((_, j) => j !== i))}>Remove this person</button>
          </fieldset>
        ))}
        <button type="button" onClick={() => setStaff(list => [...list, blankPerson()])} style={{ justifySelf: 'start' }}>+ Add a person</button>
        <p style={s.muted}>A cashier only needs a PIN. A manager needs a password only if they will open the till in the morning.</p>

        {error && <p style={s.bad} role="alert">{error}</p>}
        <button type="submit" style={s.primary} disabled={busy || !key.trim()}>{busy ? 'Setting up…' : 'Set up the shop'}</button>
      </form>
    </div>
  )
}

/** The card for the owner. Printable. Never a PIN or a password on it. */
function Ready({ done, onAnother }) {
  const address = window.location.origin
  const openers = (done.people ?? []).filter(p => p.opensTillWith)
  return (
    <div style={s.page}>
      <section style={s.card} aria-label="Shop ready">
        <h1 style={s.title}>{done.shopName} is ready</h1>
        <p style={s.muted}>Shop id {done.clientId} · {done.counter}</p>

        <h2 style={s.heading}>Give this to the owner</h2>
        <ol style={s.steps}>
          <li>Open <b>{address}</b> on the shop's computer, tablet or phone.</li>
          <li><b>Open the till</b> with <b>{done.signInWith}</b> and the password you were given.</li>
          <li>Tap your name and type your 4-digit PIN.</li>
          <li><b>More → Staff</b>: add your managers and cashiers — a name, a role and a PIN each.</li>
          <li><b>More → Settings → Inventory link</b>: paste the key from Inventory, then <b>Refresh items</b>.</li>
          <li><b>More → Settings</b>: your UPI ID, so customers see a QR to pay.</li>
        </ol>

        <h2 style={s.heading}>Who can use the till</h2>
        <ul style={s.people}>
          {(done.people ?? []).map((p, i) => (
            <li key={i} style={s.row}>
              <span><b>{p.name}</b> · {ROLE_LABEL[p.role] ?? p.role}</span>
              <span style={s.muted}>{p.opensTillWith ? `opens the till with ${p.opensTillWith}` : 'PIN only'}</span>
            </li>
          ))}
        </ul>
        {openers.length === 0 && <p style={s.bad}>Nobody can open the till yet.</p>}
        <p style={s.muted}>Passwords and PINs are not shown here. Tell each person theirs yourself.</p>

        <div style={s.buttons} className="no-print">
          <button type="button" onClick={() => window.print()}>Print</button>
          <button type="button" style={s.primary} onClick={onAnother}>Set up another shop</button>
        </div>
      </section>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px', display: 'grid', justifyItems: 'center', alignContent: 'start' },
  card: { width: 560, maxWidth: '100%', display: 'grid', gap: 12, padding: 20, border: '1px solid var(--line)', borderRadius: 16, background: 'var(--panel)', boxShadow: 'var(--shadow)' },
  title: { margin: 0, fontSize: 22 },
  heading: { margin: '8px 0 0', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)', minWidth: 0 },
  two: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' },
  person: { display: 'grid', gap: 10, border: '1px solid var(--line)', borderRadius: 12, padding: 12, margin: 0, minWidth: 0 },
  quiet: { justifySelf: 'start', color: 'var(--ink-soft)' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 12 },
  bad: { margin: 0, color: 'var(--bad)', fontSize: 14 },
  steps: { margin: 0, paddingLeft: 20, display: 'grid', gap: 6, lineHeight: 1.5 },
  people: { listStyle: 'none', margin: 0, padding: 0, display: 'grid' },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 },
  buttons: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }
}
