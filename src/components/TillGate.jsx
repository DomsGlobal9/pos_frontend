import { useEffect, useRef, useState } from 'react'
import { openTill, loadTillStaff, switchPerson, closeThisTill, messageFor } from '../lib/api.js'
import { tillOpened, personIn, tillClosed } from '../lib/session.js'
import { deviceId } from '../lib/device.js'

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
  const [shops, setShops] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e, shopId) {
    e?.preventDefault()
    if (!login.trim() || !password) { setError('Enter your email or phone, and your password.'); return }
    setBusy(true); setError(null)
    try {
      const r = await openTill({ login: login.trim(), password, deviceId: deviceId(), ...(shopId ? { shopId } : {}) })
      if (r.chooseShop) { setShops(r.chooseShop); return }
      tillOpened(r)
      onDone?.()
    } catch (err) { setError(messageFor(err)) } finally { setBusy(false) }
  }

  return (
    <div style={s.page}>
      <form style={s.card} onSubmit={submit} aria-label="Open the till">
        <img src="/scaleezy-mark.svg" alt="" width="40" height="40" style={{ justifySelf: 'center' }} />
        <h1 style={s.title}>Open the till</h1>
        <p style={s.muted}>An owner or manager signs in on this device. It stays open until someone closes it.</p>
        {shops ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Which shop?</p>
            {shops.map(sh => <button type="button" key={sh.id} style={s.primary} disabled={busy} onClick={() => submit(null, sh.id)}>{sh.name}</button>)}
          </div>
        ) : (
          <>
            <label style={s.label}>Email or phone
              <input value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" aria-label="Email or phone" autoFocus />
            </label>
            <label style={s.label}>Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" aria-label="Password" />
            </label>
            {error && <p style={s.bad} role="alert">{error}</p>}
            <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Opening…' : 'Open the till'}</button>
          </>
        )}
      </form>
    </div>
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
    if (!window.confirm('Close the till on this device? An owner or manager will need to open it again.')) return
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
        <button type="button" style={s.link} onClick={close}>Close the till on this device</button>
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
  link: { background: 'none', border: 'none', boxShadow: 'none', color: 'var(--ink-soft)', fontSize: 13, textDecoration: 'underline', justifySelf: 'center' }
}
