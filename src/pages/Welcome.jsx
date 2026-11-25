import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { tillOpened } from '../lib/session.js'
import { deviceId } from '../lib/device.js'
import { messageFor } from '../lib/api.js'

/**
 * A BOUTIQUE OWNER'S WELCOME (25 Nov). When the Boutique app's super admin switches POS on for a boutique,
 * POS makes its shop and a one-time link to this page: the owner chooses a password and a PIN, and the till
 * opens. From then on they sign in at POS's address like any shop. Outside the till: no sign-in needed.
 *
 * The link's token rides after the "#", so it never reaches a server log; it is taken off the address at once.
 */
const API = import.meta.env.VITE_API_BASE || '/api/v1'
const post = (path, body) => axios.post(`${API}${path}`, body).then(r => r.data.data)

export default function Welcome() {
  const navigate = useNavigate()
  const [token] = useState(() => window.location.hash.replace(/^#/, ''))
  const [info, setInfo] = useState(null)
  const [problem, setProblem] = useState(null)
  const [form, setForm] = useState({ password: '', again: '', pin: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Off the address bar and out of the history straight away.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    if (!token) { setProblem('Open the link you were sent. This page needs it.'); return }
    post('/auth/welcome/info', { token }).then(setInfo, err => setProblem(messageFor(err)))
  }, [token])

  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 8) return setProblem('Use a password of at least 8 characters.')
    if (form.password !== form.again) return setProblem('The two passwords are not the same.')
    if (!/^\d{4}$/.test(form.pin)) return setProblem('The PIN is 4 numbers.')
    setBusy(true); setProblem(null)
    try {
      const done = await post('/auth/welcome', { token, password: form.password, pin: form.pin })
      const opened = await post('/auth/open', { login: done.signInWith, password: form.password, shopId: done.shopId, deviceId: deviceId() })
      tillOpened(opened)
      navigate('/sell', { replace: true })
    } catch (err) {
      setProblem(messageFor(err))
    } finally { setBusy(false) }
  }

  return (
    <div style={s.page}>
      <div style={s.brandRow}>
        <img src="/scaleezy-mark.svg" alt="" width="32" height="32" />
        <div><div style={s.brandName}>ScaleEzy POS</div><div style={s.brandSub}>Your shop's billing counter</div></div>
      </div>
      <main style={s.card}>
        {!info && !problem && <p style={s.muted}>Checking your link…</p>}
        {info && (
          <>
            <div>
              <h1 style={s.h1}>Welcome, {info.name}</h1>
              <p style={s.muted}>{info.shop.name} is ready on ScaleEzy POS. Choose a password to sign in with, and a 4-number PIN for approving at the counter.</p>
            </div>
            <form onSubmit={submit} style={s.form}>
              <div style={s.label}><span>You sign in with</span><strong style={s.login}>{info.signInWith}</strong></div>
              <label style={s.label}>Password
                <span style={s.withButton}>
                  <input type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" aria-label="Password" autoFocus />
                  <button type="button" style={s.iconButton} onClick={() => setShow(!show)} aria-label={show ? 'Hide the password' : 'Show the password'}>{show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
                </span>
              </label>
              <label style={s.label}>The same password again
                <input type={show ? 'text' : 'password'} value={form.again} onChange={e => setForm({ ...form, again: e.target.value })} autoComplete="new-password" aria-label="The same password again" />
              </label>
              <label style={s.label}>PIN
                <input value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" autoComplete="off" aria-label="PIN" />
                <span style={s.muted}>4 numbers, not easy to guess (not 1234 or 1111).</span>
              </label>
              {problem && <p style={s.problem} role="alert">{problem}</p>}
              <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Opening the till…' : 'Save and open the till'}</button>
            </form>
          </>
        )}
        {!info && problem && (
          <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
            <h1 style={s.h1}>This link cannot be used</h1>
            <p style={s.problem} role="alert">{problem}</p>
            <p style={s.muted}>If you have set your password already, sign in at the POS. Otherwise ask for a new link.</p>
            <button style={s.primary} onClick={() => navigate('/', { replace: true })}>Go to sign in</button>
          </div>
        )}
      </main>
    </div>
  )
}

const s = {
  // One column, never wider than the screen (a fixed-width child would size the column and run off a phone).
  page: { minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 40px', display: 'grid', gridTemplateColumns: 'minmax(0, 480px)', justifyContent: 'center', alignContent: 'start', gap: 18, boxSizing: 'border-box' },
  brandRow: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  brandName: { fontWeight: 800, fontSize: 17 },
  brandSub: { fontSize: 12, color: 'var(--ink-soft)' },
  card: { minWidth: 0, display: 'grid', gap: 16, padding: 22, border: '1px solid var(--line)', borderRadius: 18, background: 'var(--panel)', boxShadow: 'var(--shadow-lift)', boxSizing: 'border-box' },
  h1: { margin: '0 0 6px', fontSize: 20 },
  form: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 6, minWidth: 0 },
  login: { overflowWrap: 'anywhere' },
  withButton: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, minWidth: 0 },
  iconButton: { flex: '0 0 auto', width: 44, padding: 0, display: 'grid', placeItems: 'center' },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 400 },
  problem: { margin: 0, color: 'var(--bad)', fontSize: 14 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', justifySelf: 'start' }
}
