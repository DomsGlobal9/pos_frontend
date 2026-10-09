import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Store, UserRound, Users, ClipboardCheck, Eye, EyeOff, Plus, X, CheckCircle2, Printer, ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'

/**
 * Setting up a new shop. For ScaleEzy staff, not for a shop -- reached only by typing /setup, never
 * from a menu, and useless without ScaleEzy's setup key. Approved layout 30 Sep: four steps, one at
 * a time -- Shop, Owner, Staff, Check -- then a card to hand the owner.
 *
 * Each step is checked before Next, with the same rules the server uses, so a mistake is shown on
 * the step it belongs to rather than at the end. The server checks everything again (and everyone
 * together) before it writes anything; if it still refuses, the page goes back to the step the
 * problem is on.
 *
 * The setup key is asked for last, lives in this page's memory only (not stored, not in the address)
 * and is gone when the tab closes. The server allows ten tries a minute. The card at the end never
 * shows a PIN or a password.
 */
const API = import.meta.env.VITE_API_BASE || '/api/v1'
const ROLES = [['CASHIER', 'Cashier'], ['MANAGER', 'Manager'], ['OWNER', 'Owner']]
const ROLE_LABEL = Object.fromEntries(ROLES)
const STEPS = [
  { title: 'Shop', Icon: Store },
  { title: 'Owner', Icon: UserRound },
  { title: 'Staff', Icon: Users },
  { title: 'Check', Icon: ClipboardCheck }
]
const EMPTY_SHOP = { clientId: '', shopName: '', address: '', gstin: '' }
const EMPTY_OWNER = { name: '', login: '', password: '', pin: '' }
const blankPerson = () => ({ name: '', role: 'CASHIER', pin: '', opensTill: false, login: '', password: '' })

// ---- the same rules as the server, so mistakes show on their own step -------------------------

const weakPin = (pin) => /^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0123', '9876'].includes(pin)
function pinProblem(pin) {
  if (!/^\d{4}$/.test(pin)) return 'Four digits.'
  if (weakPin(pin)) return `Too easy to guess. Choose something other than ${pin}.`
  return null
}
function loginProblem(text, required) {
  const t = text.trim()
  if (!t) return required ? 'An email or a 10-digit mobile number.' : null
  if (t.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? null : 'That email does not look right.'
  const d = t.replace(/\D/g, '')
  return d.length === 10 || (d.length === 12 && d.startsWith('91')) ? null : 'A 10-digit mobile number, or an email.'
}
const loginOf = (text) => {
  const t = (text ?? '').trim()
  if (!t) return {}
  return t.includes('@') ? { email: t } : { phone: t }
}

function shopProblems(shop) {
  const e = {}
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(shop.clientId.trim())) e.clientId = 'Letters, numbers, - and _ only — the id Inventory uses, like sphl.'
  if (shop.shopName.trim().length < 2) e.shopName = 'The name customers see on the bill.'
  if (shop.gstin.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/.test(shop.gstin.trim())) e.gstin = '15 characters, starting with the 2-digit state code.'
  return e
}
function ownerProblems(owner) {
  const e = {}
  if (owner.name.trim().length < 2) e.name = 'Their name, as the shop calls them.'
  const l = loginProblem(owner.login, true); if (l) e.login = l
  if (owner.password.length < 8) e.password = 'At least 8 characters.'
  const p = pinProblem(owner.pin); if (p) e.pin = p
  return e
}
function staffProblems(staff, owner) {
  const all = staff.map(() => ({}))
  const pins = new Map([[owner.pin, 'the owner']])
  const logins = new Map(owner.login.trim() ? [[owner.login.trim().toLowerCase(), 'the owner']] : [])
  staff.forEach((p, i) => {
    const e = all[i]
    if (p.name.trim().length < 2) e.name = 'Their name.'
    const pp = pinProblem(p.pin)
    if (pp) e.pin = pp
    else if (pins.has(p.pin)) e.pin = `Same PIN as ${pins.get(p.pin)}. Each person needs their own.`
    else pins.set(p.pin, p.name.trim() || `person ${i + 1}`)
    if (p.role !== 'CASHIER' && p.opensTill) {
      const l = loginProblem(p.login, true)
      if (l) e.login = l
      else if (logins.has(p.login.trim().toLowerCase())) e.login = `Already used by ${logins.get(p.login.trim().toLowerCase())}.`
      else logins.set(p.login.trim().toLowerCase(), p.name.trim() || `person ${i + 1}`)
      if (p.password.length < 8) e.password = 'At least 8 characters.'
    }
  })
  return all
}
const none = (e) => (Array.isArray(e) ? e.every(x => Object.keys(x).length === 0) : Object.keys(e).length === 0)

/** Which step a refusal from the server belongs on. */
function stepOf(message, staff) {
  if (/setup key|switched off/i.test(message)) return 3
  if (/^The owner/.test(message)) return 1
  if (staff.some(p => p.name.trim() && message.startsWith(p.name.trim()))) return 2
  if (/already set up|clientId|shopName|GSTIN/i.test(message)) return 0
  return 3
}

// ---- the page ---------------------------------------------------------------------------------

export default function ShopSetup() {
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [tried, setTried] = useState([false, false, false])
  const [shop, setShop] = useState(EMPTY_SHOP)
  const [owner, setOwner] = useState(EMPTY_OWNER)
  const [staff, setStaff] = useState([])
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState(null)
  const [done, setDone] = useState(null)
  const top = useRef(null)

  useEffect(() => { top.current?.focus() }, [step])

  const problems = [shopProblems(shop), ownerProblems(owner), staffProblems(staff, owner)]
  const show = (i) => (tried[i] ? problems[i] : (i === 2 ? staff.map(() => ({})) : {}))

  function go(to) {
    setRefusal(null)
    setStep(to)
    setReached(r => Math.max(r, to))
  }
  function next(e) {
    e?.preventDefault()
    if (step < 3) {
      setTried(t => t.map((v, i) => (i === step ? true : v)))
      if (!none(problems[step])) return
      go(step + 1)
    }
  }
  const setPerson = (i, patch) => setStaff(list => list.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  async function create() {
    setBusy(true); setRefusal(null)
    try {
      const body = {
        clientId: shop.clientId.trim(),
        shopName: shop.shopName.trim(),
        ...(shop.address.trim() ? { address: shop.address.trim() } : {}),
        ...(shop.gstin.trim() ? { gstin: shop.gstin.trim() } : {}),
        owner: { name: owner.name.trim(), ...loginOf(owner.login), password: owner.password, pin: owner.pin },
        staff: staff.map(p => ({
          name: p.name.trim(), role: p.role, pin: p.pin,
          ...(p.role !== 'CASHIER' && p.opensTill ? { ...loginOf(p.login), password: p.password } : {})
        }))
      }
      const { data } = await axios.post(`${API}/platform/shops`, body, { headers: { 'x-platform-key': key.trim() }, timeout: 60_000 })
      setDone(data.data)
      // What was typed has done its job; it is not kept around.
      setOwner(EMPTY_OWNER); setStaff([]); setKey('')
    } catch (err) {
      const status = err?.response?.status
      const said = err?.response?.data?.message
      const message =
        status === 404 ? 'Shop setup is switched off on this server.'
          : said && status && status < 500 ? said
            : err?.code === 'ECONNABORTED' ? 'The server took too long. Check whether the shop was made before trying again.'
              : 'The server could not be reached. Check the connection and try again.'
      const to = stepOf(message, staff)
      setStep(to)
      setRefusal(message)
    } finally {
      setBusy(false)
    }
  }

  function startAgain() {
    setDone(null); setShop(EMPTY_SHOP); setStep(0); setReached(0); setTried([false, false, false]); setRefusal(null)
  }

  if (done) return <Ready done={done} onAnother={startAgain} />

  const Current = STEPS[step]
  return (
    <div style={s.page}>
      <header style={s.brandRow}>
        <img src="/scaleezy-mark.svg" alt="" width="32" height="32" />
        <div>
          <div style={s.brandName}>New shop</div>
          <div style={s.brandSub}>For ScaleEzy staff only</div>
        </div>
      </header>

      <Stepper step={step} reached={reached} onGo={go} />

      <form style={s.card} onSubmit={step < 3 ? next : (e) => { e.preventDefault(); if (key.trim() && !busy) create() }} aria-label={`Step ${step + 1} of 4: ${Current.title}`} noValidate>
        <div style={s.cardHead} tabIndex={-1} ref={top}>
          <span style={s.stepIcon}><Current.Icon size={20} aria-hidden="true" /></span>
          <div>
            <div style={s.stepCount}>Step {step + 1} of 4</div>
            <h1 style={s.title}>{['The shop', 'The owner', 'Staff', 'Check and create'][step]}</h1>
          </div>
        </div>

        {refusal && <p style={s.refusal} role="alert">{refusal}</p>}

        {step === 0 && (
          <>
            <Field label="Shop id" hint="The same id Inventory uses for this shop" error={show(0).clientId}>
              <input value={shop.clientId} onChange={e => setShop({ ...shop, clientId: e.target.value.replace(/\s/g, '') })} aria-label="Shop id" placeholder="sphl" autoFocus />
            </Field>
            <Field label="Name on the bill" error={show(0).shopName}>
              <input value={shop.shopName} onChange={e => setShop({ ...shop, shopName: e.target.value })} aria-label="Name on the bill" placeholder="SPHL" />
            </Field>
            <Field label="Address on the bill" optional>
              <input value={shop.address} onChange={e => setShop({ ...shop, address: e.target.value })} aria-label="Address" />
            </Field>
            <Field label="GSTIN" optional error={show(0).gstin}>
              <input value={shop.gstin} onChange={e => setShop({ ...shop, gstin: e.target.value.toUpperCase().replace(/\s/g, '') })} aria-label="GSTIN" maxLength={15} />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <p style={s.lead}>The owner opens the till with the email or phone and password, then works with the PIN.</p>
            <Field label="Name" error={show(1).name}>
              <input value={owner.name} onChange={e => setOwner({ ...owner, name: e.target.value })} aria-label="Owner name" autoFocus />
            </Field>
            <Field label="Email or 10-digit phone" error={show(1).login}>
              <input value={owner.login} onChange={e => setOwner({ ...owner, login: e.target.value })} aria-label="Owner email or phone" autoComplete="off" />
            </Field>
            <Field label="Password" hint="8 or more characters" error={show(1).password}>
              <Secret value={owner.password} onChange={v => setOwner({ ...owner, password: v })} label="Owner password" />
            </Field>
            <Field label="4-digit PIN" error={show(1).pin}>
              <PinBoxes value={owner.pin} onChange={v => setOwner({ ...owner, pin: v })} label="Owner PIN" />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <p style={s.lead}>Optional. The owner can add people later on the Staff screen. A cashier only needs a PIN.</p>
            {staff.length === 0 && <div style={s.empty}>No staff added yet.</div>}
            {staff.map((p, i) => {
              const e = show(2)[i] ?? {}
              const who = `Person ${i + 1}`
              return (
                <fieldset key={i} style={s.person} aria-label={who}>
                  <div style={s.personHead}>
                    <span style={s.avatar} aria-hidden="true">{(p.name.trim()[0] ?? String(i + 1)).toUpperCase()}</span>
                    <b style={{ flex: 1 }}>{p.name.trim() || who}</b>
                    <button type="button" style={s.iconBtn} aria-label={`Remove ${who}`} onClick={() => setStaff(list => list.filter((_, j) => j !== i))}><X size={18} /></button>
                  </div>
                  <Field label="Name" error={e.name}>
                    <input value={p.name} onChange={ev => setPerson(i, { name: ev.target.value })} aria-label={`${who} name`} />
                  </Field>
                  <div style={s.label}>
                    <span style={s.labelText}>Role</span>
                    <div style={s.segment} role="group" aria-label={`${who} role`}>
                      {ROLES.map(([v, l]) => (
                        <button key={v} type="button" aria-pressed={p.role === v} style={p.role === v ? s.segOn : s.segOff}
                          onClick={() => setPerson(i, { role: v, ...(v === 'CASHIER' ? { opensTill: false } : {}) })}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <Field label="4-digit PIN" error={e.pin}>
                    <PinBoxes value={p.pin} onChange={v => setPerson(i, { pin: v })} label={`${who} PIN`} />
                  </Field>
                  {p.role !== 'CASHIER' && (
                    <label style={s.check}>
                      <input type="checkbox" checked={p.opensTill} onChange={ev => setPerson(i, { opensTill: ev.target.checked })} aria-label={`${who} opens the till`} />
                      <span>Opens the till in the morning <span style={s.muted}>(needs an email or phone and a password)</span></span>
                    </label>
                  )}
                  {p.role !== 'CASHIER' && p.opensTill && (
                    <div style={s.two}>
                      <Field label="Email or phone" error={e.login}>
                        <input value={p.login} onChange={ev => setPerson(i, { login: ev.target.value })} aria-label={`${who} email or phone`} autoComplete="off" />
                      </Field>
                      <Field label="Password" error={e.password}>
                        <Secret value={p.password} onChange={v => setPerson(i, { password: v })} label={`${who} password`} />
                      </Field>
                    </div>
                  )}
                </fieldset>
              )
            })}
            <button type="button" style={s.add} onClick={() => setStaff(list => [...list, blankPerson()])}><Plus size={18} aria-hidden="true" /> Add a person</button>
          </>
        )}

        {step === 3 && (
          <>
            <Summary title="Shop" onChange={() => go(0)}>
              <div style={s.sumMain}>{shop.shopName.trim()}</div>
              <div style={s.muted}>Shop id {shop.clientId.trim()} · Counter 1{shop.gstin.trim() ? ` · GSTIN ${shop.gstin.trim()}` : ''}</div>
              {shop.address.trim() && <div style={s.muted}>{shop.address.trim()}</div>}
            </Summary>
            <Summary title="People" onChange={() => go(staff.length ? 2 : 1)}>
              <ul style={s.people}>
                <PersonRow name={owner.name.trim()} role="OWNER" how={`opens the till with ${owner.login.trim()}`} />
                {staff.map((p, i) => (
                  <PersonRow key={i} name={p.name.trim()} role={p.role} how={p.role !== 'CASHIER' && p.opensTill ? `opens the till with ${p.login.trim()}` : 'PIN only'} />
                ))}
              </ul>
            </Summary>
            <Field label="ScaleEzy setup key" hint="Kept only until this page is closed">
              <div style={s.keyWrap}>
                <KeyRound size={18} style={s.keyIcon} aria-hidden="true" />
                <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} aria-label="ScaleEzy setup key" style={{ paddingLeft: 40 }} autoFocus />
              </div>
            </Field>
          </>
        )}

        <div style={s.nav}>
          {step > 0 ? <button type="button" onClick={() => go(step - 1)}><ArrowLeft size={18} aria-hidden="true" /> Back</button> : <span />}
          {step < 3 && (
            <button type="submit" style={s.primary}>
              {step === 2 && staff.length === 0 ? 'Skip — no staff' : 'Next'} <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
          {step === 3 && (
            <button type="submit" style={s.primary} disabled={busy || !key.trim()}>{busy ? 'Creating…' : 'Create the shop'}</button>
          )}
        </div>
      </form>
    </div>
  )
}

// ---- pieces -----------------------------------------------------------------------------------

function Stepper({ step, reached, onGo }) {
  return (
    <ol style={s.stepper} aria-label="Steps">
      {STEPS.map((st, i) => {
        const state = i === step ? 'now' : i < step || i <= reached ? 'done' : 'todo'
        return (
          <li key={st.title} style={s.stepItem}>
            {i > 0 && <span style={{ ...s.stepLine, background: i <= Math.max(step, reached) ? 'var(--brand-deep)' : 'var(--line-strong)' }} aria-hidden="true" />}
            <button type="button" disabled={i > reached} onClick={() => onGo(i)} aria-current={i === step ? 'step' : undefined}
              aria-label={`${st.title}${i === step ? ' (this step)' : ''}`}
              style={{ ...s.dot, ...(state === 'now' ? s.dotNow : state === 'done' ? s.dotDone : s.dotTodo) }}>
              {state === 'done' && i !== step ? <CheckCircle2 size={16} aria-hidden="true" /> : i + 1}
            </button>
            <span style={{ ...s.stepName, color: i === step ? 'var(--ink)' : 'var(--ink-soft)' }}>{st.title}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Field({ label, hint, optional, error, children }) {
  return (
    <div style={s.label}>
      <span style={s.labelText}>{label}{optional && <span style={s.muted}> (optional)</span>}</span>
      {children}
      {error ? <span style={s.fieldError}>{error}</span> : hint ? <span style={s.muted}>{hint}</span> : null}
    </div>
  )
}

/** A password with show/hide. */
function Secret({ value, onChange, label }) {
  const [seen, setSeen] = useState(false)
  return (
    <div style={s.keyWrap}>
      <input type={seen ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} aria-label={label} autoComplete="new-password" style={{ paddingRight: 48 }} />
      <button type="button" style={s.eye} onClick={() => setSeen(v => !v)} aria-label={seen ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
        {seen ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

/**
 * Four boxes for a PIN. One real input underneath (so typing, pasting, a password manager and a
 * screen reader all see a single field); the boxes are only how it looks.
 */
function PinBoxes({ value, onChange, label }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={s.pinWrap}>
      {[0, 1, 2, 3].map(i => (
        <span key={i} aria-hidden="true" style={{ ...s.pinBox, ...(focused && i === Math.min(value.length, 3) ? s.pinBoxOn : {}) }}>
          {value[i] ? '•' : ''}
        </span>
      ))}
      <input value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label={label}
        inputMode="numeric" autoComplete="off" style={s.pinInput}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    </div>
  )
}

function Summary({ title, onChange, children }) {
  return (
    <section style={s.summary} aria-label={title}>
      <div style={s.sumHead}>
        <span style={s.sumTitle}>{title}</span>
        <button type="button" style={s.link} onClick={onChange} aria-label={`Change ${title.toLowerCase()}`}>Change</button>
      </div>
      {children}
    </section>
  )
}

function PersonRow({ name, role, how }) {
  return (
    <li style={s.personRow}>
      <span style={s.avatarSm} aria-hidden="true">{(name[0] ?? '?').toUpperCase()}</span>
      <b style={{ flex: 1, minWidth: 0 }}>{name}</b>
      <span className={`chip ${role === 'OWNER' ? 'brand' : ''}`}>{ROLE_LABEL[role]}</span>
      <span style={{ ...s.muted, flexBasis: '100%', paddingLeft: 40 }}>{how}</span>
    </li>
  )
}

/** The card for the owner. Printable. Never a PIN or a password on it. */
function Ready({ done, onAnother }) {
  const address = window.location.origin
  return (
    <div style={s.page}>
      <section style={s.card} aria-label="Shop ready">
        <div style={s.readyHead}>
          <CheckCircle2 size={40} color="var(--good)" aria-hidden="true" />
          <div>
            <h1 style={s.title}>{done.shopName} is ready</h1>
            <div style={s.muted}>Shop id {done.clientId} · {done.counter}</div>
          </div>
        </div>

        <h2 style={s.heading}>Give this to the owner</h2>
        <ol style={s.steps}>
          <li>Open <b>{address}</b> on the shop's computer, tablet or phone.</li>
          <li><b>Open the till</b> with <b>{done.signInWith}</b> and the password you were given.</li>
          <li>Tap your name and type your 4-digit PIN.</li>
          <li><b>More → Staff</b>: add your managers and cashiers — a name, a role and a PIN each.</li>
          <li>In Inventory, <b>Settings → Money → POS (billing counter)</b>: create a till key. Then in the POS, <b>More → Settings → Inventory link</b>: paste it, <b>Connect</b>, then <b>Refresh items</b>.</li>
          <li><b>More → Settings</b>: your UPI ID, so customers see a QR to pay.</li>
        </ol>

        <h2 style={s.heading}>Who can use the till</h2>
        <ul style={s.people}>
          {(done.people ?? []).map((p, i) => (
            <PersonRow key={i} name={p.name} role={p.role} how={p.opensTillWith ? `opens the till with ${p.opensTillWith}` : 'PIN only'} />
          ))}
        </ul>
        <p style={s.muted}>Passwords and PINs are not shown here. Tell each person theirs yourself.</p>

        <div style={s.nav} className="no-print">
          <button type="button" onClick={() => window.print()}><Printer size={18} aria-hidden="true" /> Print</button>
          <button type="button" style={s.primary} onClick={onAnother}>Set up another shop</button>
        </div>
      </section>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 40px', display: 'grid', justifyItems: 'center', alignContent: 'start', gap: 18 },
  brandRow: { width: 560, maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 12 },
  brandName: { fontWeight: 800, fontSize: 17 },
  brandSub: { fontSize: 12, color: 'var(--ink-soft)' },

  stepper: { width: 560, maxWidth: '100%', listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' },
  stepItem: { position: 'relative', display: 'grid', justifyItems: 'center', gap: 6 },
  stepLine: { position: 'absolute', top: 17, right: '50%', width: '100%', height: 2, zIndex: 0 },
  dot: { position: 'relative', zIndex: 1, width: 36, height: 36, minHeight: 36, padding: 0, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 },
  dotNow: { background: 'var(--brand-deep)', color: '#fff', borderColor: 'var(--brand-deep)', boxShadow: '0 0 0 4px var(--brand-tint-strong)' },
  dotDone: { background: 'var(--brand-tint)', color: 'var(--brand-deep)', borderColor: 'var(--brand-tint-strong)' },
  dotTodo: { background: 'var(--panel)', color: 'var(--ink-soft)', borderColor: 'var(--line-strong)' },
  stepName: { fontSize: 12, fontWeight: 600 },

  card: { width: 560, maxWidth: '100%', display: 'grid', gap: 16, padding: 22, border: '1px solid var(--line)', borderRadius: 18, background: 'var(--panel)', boxShadow: 'var(--shadow-lift)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 12, outline: 'none' },
  stepIcon: { width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand-deep)', flexShrink: 0 },
  stepCount: { fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 },
  title: { margin: 0, fontSize: 21 },
  lead: { margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 },
  refusal: { margin: 0, padding: '10px 12px', borderRadius: 10, background: 'var(--bad-tint)', color: 'var(--bad)', fontSize: 14, fontWeight: 600 },

  label: { display: 'grid', gap: 6, minWidth: 0 },
  labelText: { fontSize: 13, fontWeight: 600, color: 'var(--ink)' },
  fieldError: { fontSize: 12.5, color: 'var(--bad)', fontWeight: 600 },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 400 },
  two: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' },

  keyWrap: { position: 'relative' },
  keyIcon: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', pointerEvents: 'none' },
  eye: { position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 40, minHeight: 40, height: 40, padding: 0, border: 'none', background: 'transparent', color: 'var(--ink-soft)', display: 'grid', placeItems: 'center' },

  pinWrap: { position: 'relative', display: 'flex', gap: 10, width: 'max-content' },
  // Border in longhands: React clearing the active box's borderColor would otherwise wipe the shorthand's colour too.
  pinBox: { width: 52, height: 56, borderRadius: 12, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--line-strong)', background: 'var(--panel)', display: 'grid', placeItems: 'center', fontSize: 28, lineHeight: 1 },
  pinBoxOn: { borderColor: 'var(--brand-deep)', boxShadow: '0 0 0 3px rgba(166, 217, 43, 0.35)' },
  pinInput: { position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0, opacity: 0, padding: 0, border: 'none', cursor: 'text' },

  empty: { padding: 16, borderRadius: 12, border: '1px dashed var(--line-strong)', color: 'var(--ink-soft)', fontSize: 14, textAlign: 'center' },
  person: { display: 'grid', gap: 12, border: '1px solid var(--line)', borderRadius: 14, padding: 14, margin: 0, minWidth: 0, background: 'var(--panel-soft)' },
  personHead: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 999, background: 'var(--brand-tint-strong)', color: 'var(--brand-deep)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 },
  iconBtn: { width: 40, minHeight: 40, height: 40, padding: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-soft)' },
  segment: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  segOn: { background: 'var(--brand-deep)', color: '#fff', borderColor: 'var(--brand-deep)' },
  segOff: { background: 'var(--panel)' },
  check: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.4 },
  add: { justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6 },

  summary: { display: 'grid', gap: 6, padding: 14, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--panel-soft)' },
  sumHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sumTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft)' },
  sumMain: { fontWeight: 700, fontSize: 16 },
  link: { minHeight: 32, padding: '0 10px', border: 'none', background: 'transparent', color: 'var(--brand-deep)', fontWeight: 600, textDecoration: 'underline' },
  people: { listStyle: 'none', margin: 0, padding: 0, display: 'grid' },
  personRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 },
  avatarSm: { width: 30, height: 30, borderRadius: 999, background: 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 },

  nav: { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 },

  readyHead: { display: 'flex', alignItems: 'center', gap: 12 },
  heading: { margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  steps: { margin: 0, paddingLeft: 20, display: 'grid', gap: 6, lineHeight: 1.5 }
}
