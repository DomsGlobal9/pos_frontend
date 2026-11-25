import { useEffect, useRef, useState } from 'react'
import { openTill, loadTillStaff, switchPerson, closeThisTill, messageFor, requestPasswordLink } from '../lib/api.js'
import { tillOpened, personIn, tillClosed } from '../lib/session.js'
import { deviceId } from '../lib/device.js'
import { askYesNo } from './Ask.jsx'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mail, Store } from 'lucide-react'
import AuthFrame, { AfProblem, afField, afLabel, afPrimary, afQuiet } from './AuthFrame.jsx'

/**
 * Signing in at the till. Approved layout 27 Sep.
 *
 *   OpenTill     an owner or manager opens the till on this device, once: email/phone + password
 *   WhoAtTill    staff tap their name and type their 4-digit PIN; the PIN goes in by itself at the
 *                fourth digit, and a keyboard works as well as the on-screen pad
 */
export function OpenTill({ onDone }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [shops, setShops] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // 25 Nov: "Forgot your password?" is its own view: ask for a link by email, then "check your email".
  const [view, setView] = useState('signin')   // signin | forgot | sent
  const [resetEmail, setResetEmail] = useState('')
  const [resetProblem, setResetProblem] = useState(null)
  const [sentTo, setSentTo] = useState('')
  const [wait, setWait] = useState(0)

  // "Send again" waits a minute, as the server does.
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  function openForgot() {
    setResetEmail(login.includes('@') ? login.trim() : resetEmail)
    setResetProblem(null); setView('forgot')
  }
  function backToSignIn() { setView('signin'); setError(null) }

  async function askLink(e) {
    e?.preventDefault()
    const email = resetEmail.trim()
    if (!email) { setResetProblem('Enter the email you sign in with.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setResetProblem('That does not look like an email address.'); return }
    setBusy(true); setResetProblem(null)
    try { await requestPasswordLink(email); setSentTo(email); setWait(60); setView('sent') }
    catch (err) { setResetProblem(messageFor(err)) }
    finally { setBusy(false) }
  }

  async function submit(e, shopId) {
    e?.preventDefault()
    if (!login.trim()) { setError('Enter the email or phone you sign in with.'); return }
    if (!password) { setError('Enter your password.'); return }
    setBusy(true); setError(null)
    try {
      const r = await openTill({ login: login.trim(), password, deviceId: deviceId(), ...(shopId ? { shopId } : {}) })
      if (r.chooseShop) { setShops(r.chooseShop); return }
      tillOpened(r)
      onDone?.()
    } catch (err) { setError(messageFor(err)) } finally { setBusy(false) }
  }

  const otherWays = (
    <details style={s.ways}>
      <summary style={s.waysSummary}>Can't use email?</summary>
      <ul style={s.waysList} aria-label="Other ways in">
        <li><strong>Till still open on another device?</strong> Choose your name there and enter your PIN, then <strong>More → Staff</strong>, your name, <strong>Change</strong>, and type a new password.</li>
        <li><strong>Another owner?</strong> They can set a new password for you in <strong>More → Staff</strong>.</li>
        <li><strong>Otherwise</strong>, ask ScaleEzy support, or your Boutique app's administrator, for a new sign-in link.</li>
      </ul>
    </details>
  )
  const resetCaption = 'A new password changes only the password. Your PIN, staff and bills stay as they are.'

  if (view === 'forgot') return (
    <AuthFrame scene="mail" title="Reset your password" subtitle="Enter the email you sign in with. We'll email you a link to choose a new password; your PIN, staff and bills stay as they are." caption={resetCaption}>
      <form onSubmit={askLink} aria-label="Reset your password" noValidate style={s.form}>
        <div>
          <label htmlFor="reset-email" style={afLabel}>Email address</label>
          <input id="reset-email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@yourshop.com" style={afField}
            autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" autoFocus />
        </div>
        <AfProblem>{resetProblem}</AfProblem>
        <button type="submit" className="af-go" style={afPrimary(busy)} disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}{busy ? 'Sending…' : 'Email me a link'}
        </button>
        <button type="button" style={afQuiet} onClick={backToSignIn}><ArrowLeft size={16} aria-hidden="true" /> Back to sign in</button>
        {otherWays}
      </form>
    </AuthFrame>
  )

  if (view === 'sent') return (
    <AuthFrame scene="sent" title="Check your email" subtitle="Open the link in the email to choose a new password, then sign in here with it." caption={resetCaption}>
      <div style={s.form} role="region" aria-label="Check your email">
        <p style={s.sentText} role="status">If <strong style={s.email}>{sentTo}</strong> signs in to a POS shop as an owner or manager, a link is on its way. It works once, for 30 minutes.</p>
        <p style={s.small}>Not there in a few minutes? Look in spam or promotions, and check the email above is the one you sign in with.</p>
        <button type="button" style={s.again} disabled={busy || wait > 0} onClick={askLink}>
          {wait > 0 ? `Send again in ${wait}s` : busy ? 'Sending…' : 'Send again'}
        </button>
        <div style={s.row}>
          <button type="button" style={afQuiet} onClick={backToSignIn}><ArrowLeft size={16} aria-hidden="true" /> Back to sign in</button>
          <button type="button" style={afQuiet} onClick={() => { setView('forgot'); setResetProblem(null) }}>Use a different email</button>
        </div>
        {otherWays}
      </div>
    </AuthFrame>
  )

  return (
    <AuthFrame title="Open the till" subtitle="An owner or manager signs in once on this device. It stays open until someone closes it."
      footer={shops ? null : 'Staff do not sign in here. Once the till is open they choose their name.'}>
      {shops ? (
        <div style={s.form}>
          <p style={s.lead}>This login works in more than one shop. Which one is this till for?</p>
          {shops.map(sh => (
            <button type="button" key={sh.id} style={s.shop} disabled={busy} onClick={() => submit(null, sh.id)}>
              <Store size={18} aria-hidden="true" style={{ color: 'var(--brand-deep)', flexShrink: 0 }} /><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{sh.name}</span>
            </button>
          ))}
          <button type="button" style={afQuiet} onClick={() => setShops(null)}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
        </div>
      ) : (
        <form onSubmit={submit} aria-label="Open the till" noValidate style={s.form}>
          <div>
            <label htmlFor="till-login" style={afLabel}>Email or phone</label>
            <input id="till-login" value={login} onChange={e => setLogin(e.target.value)} placeholder="you@yourshop.com" style={afField}
              autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
          </div>
          <div>
            <label htmlFor="till-password" style={afLabel}>Password</label>
            <div style={{ position: 'relative' }}>
              <input id="till-password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"
                style={{ ...afField, paddingRight: 54 }} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              <button type="button" style={s.eye} onClick={() => setShow(!show)} aria-label={show ? 'Hide the password' : 'Show the password'}>
                {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <AfProblem>{error}</AfProblem>
          <button type="submit" className="af-go" style={afPrimary(busy)} disabled={busy}>
            {busy && <Loader2 size={18} className="spin" aria-hidden="true" />}{busy ? 'Opening…' : 'Open the till'}{!busy && <ArrowRight size={18} aria-hidden="true" />}
          </button>
          <button type="button" style={afQuiet} onClick={openForgot}>Forgot your password?</button>
        </form>
      )}
    </AuthFrame>
  )
}

export function WhoAtTill({ onDone }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [chosen, setChosen] = useState(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    loadTillStaff().then(setData).catch(err => setError(messageFor(err)))
  }, [])
  useEffect(() => { if (chosen) box.current?.focus() }, [chosen])
  // A keyboard types the PIN too, wherever the focus is.
  useEffect(() => {
    if (!chosen) return
    const onKey = (e) => {
      if (document.activeElement === box.current) return
      if (/^\d$/.test(e.key)) type(e.key)
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function tryPin(value) {
    setBusy(true); setError(null)
    try {
      const r = await switchPerson({ userId: chosen.id, pin: value })
      personIn(r)
      onDone?.()
    } catch (err) {
      setError(messageFor(err)); setPin('')
    } finally { setBusy(false) }
  }
  function type(d) {
    if (busy) return
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length === 4) tryPin(next)
  }
  async function close() {
    if (!await askYesNo('Close the till on this device?', { note: 'An owner or manager will need to open it again.', confirmLabel: 'Close the till' })) return
    try { await closeThisTill() } catch { /* closing locally is what matters */ }
    tillClosed()
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Who's at the till?</h1>
        {data?.shop?.name && <p style={s.muted}>{data.shop.name}</p>}
        {!data && !error && <p style={s.muted}>Loading…</p>}
        {data && data.staff.length === 0 && <p style={s.muted}>Nobody has a PIN yet. The owner adds staff under More → Staff.</p>}
        {data && (
          <div style={s.tiles}>
            {data.staff.map(p => (
              <button key={p.id} type="button" onClick={() => { setChosen(p); setPin(''); setError(null) }}
                style={{ ...s.tile, ...(chosen?.id === p.id ? s.tileOn : {}) }} aria-pressed={chosen?.id === p.id}>
                <b>{p.name}</b><span style={s.role}>{p.role}</span>
              </button>
            ))}
          </div>
        )}
        {chosen && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ margin: 0, textAlign: 'center', fontWeight: 600 }}>{chosen.name}, enter your PIN</p>
            <input ref={box} value={pin} inputMode="numeric" autoComplete="off" aria-label="PIN"
              onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setPin(v); if (v.length === 4) tryPin(v) }}
              style={s.pinBox} type="password" disabled={busy} />
            <div style={s.dots} aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} style={{ ...s.dot, ...(i < pin.length ? s.dotOn : {}) }} />)}</div>
            <div style={s.pad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} type="button" style={s.key} onClick={() => type(d)}>{d}</button>)}
              <span />
              <button type="button" style={s.key} onClick={() => type('0')}>0</button>
              <button type="button" style={s.key} onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete">⌫</button>
            </div>
          </div>
        )}
        {error && <p style={s.bad} role="alert">{error}</p>}
        <button type="button" className="btn-quiet" style={{ justifySelf: 'center' }} onClick={close}>Close the till on this device</button>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--bg)' },
  card: { width: '100%', maxWidth: 420, display: 'grid', gap: 14, padding: '26px 22px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' },
  title: { margin: 0, fontSize: 22, textAlign: 'center' },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 14, textAlign: 'center', lineHeight: 1.5 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  primary: { minHeight: 'var(--tap)', fontSize: 16, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  bad: { margin: 0, padding: '8px 12px', borderRadius: 10, background: 'var(--bad-tint)', color: 'var(--bad)', fontSize: 14, textAlign: 'center' },
  // 25 Nov: opening the till and the forgot-password views, inside AuthFrame.
  form: { display: 'grid', gap: 18, minWidth: 0 },
  eye: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 44, minHeight: 44, padding: 0, display: 'grid', placeItems: 'center', background: 'none', border: 'none', boxShadow: 'none', color: 'var(--ink-soft)' },
  lead: { margin: 0, color: 'var(--ink-soft)', fontSize: 14.5, lineHeight: 1.6 },
  shop: { ...afField, height: 'auto', minHeight: 52, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', fontWeight: 600 },
  sentText: { margin: 0, fontSize: 15, lineHeight: 1.6 },
  email: { overflowWrap: 'anywhere' },
  small: { margin: 0, color: 'var(--ink-soft)', fontSize: 13.5, lineHeight: 1.55 },
  again: { width: '100%', height: 52, borderRadius: 999, fontSize: 15.5, fontWeight: 700 },
  row: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0 12px' },
  ways: { borderTop: '1px solid var(--line)', paddingTop: 12, fontSize: 14, color: 'var(--ink-soft)' },
  waysSummary: { cursor: 'pointer', fontWeight: 600, minHeight: 40, display: 'flex', alignItems: 'center' },
  waysList: { margin: '8px 0 0', padding: '12px 14px 12px 30px', display: 'grid', gap: 8, fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)', background: 'var(--brand-tint)', border: '1px solid var(--brand-tint-strong)', borderRadius: 12 },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 },
  tile: { display: 'grid', gap: 2, padding: '12px 8px', minHeight: 64, textAlign: 'center', borderRadius: 12 },
  tileOn: { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--brand-tint-strong)', background: 'var(--brand-tint)' },
  role: { fontSize: 12, color: 'var(--ink-soft)' },
  pinBox: { position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' },
  dots: { display: 'flex', justifyContent: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 99, border: '2px solid var(--line-strong)' },
  dotOn: { background: 'var(--brand-deep)', borderColor: 'var(--brand-deep)' },
  pad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  key: { minHeight: 52, fontSize: 20, fontWeight: 600 },
}
