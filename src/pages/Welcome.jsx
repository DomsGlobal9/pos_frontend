import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import AuthFrame, { AfProblem, afField, afLabel, afPrimary } from '../components/AuthFrame.jsx'
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

/**
 * mode "welcome" (a new shop's owner: password and PIN) or "reset" (a forgotten password: a new password only;
 * the PIN, staff and bills are untouched). Same page, same rules.
 */
export default function Welcome({ mode = 'welcome' }) {
  const reset = mode === 'reset'
  const base = reset ? '/auth/reset' : '/auth/welcome'
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
    post(`${base}/info`, { token }).then(setInfo, err => setProblem(messageFor(err)))
  }, [token, base])

  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 8) return setProblem('Use a password of at least 8 characters.')
    if (form.password !== form.again) return setProblem('The two passwords are not the same.')
    if (!reset && !/^\d{4}$/.test(form.pin)) return setProblem('The PIN is 4 numbers.')
    setBusy(true); setProblem(null)
    try {
      const done = await post(base, { token, password: form.password, ...(reset ? {} : { pin: form.pin }) })
      const opened = await post('/auth/open', { login: done.signInWith, password: form.password, shopId: done.shopId, deviceId: deviceId() })
      tillOpened(opened)
      navigate('/sell', { replace: true })
    } catch (err) {
      setProblem(messageFor(err))
    } finally { setBusy(false) }
  }

  // The frame's words: what this link is for, or why it cannot be used.
  const side = problem && !info
    ? { title: 'This link cannot be used', subtitle: reset
        ? 'Ask for a new link with "Forgot your password?" on the sign-in screen. The newest link is the one that works.'
        : 'If you have set your password already, sign in at the POS. Otherwise ask for a new link.' }
    : reset
      ? { title: 'Choose a new password', subtitle: info ? `For ${info.name} at ${info.shop.name}. Your PIN, staff and bills stay as they are.` : 'Checking your link…',
          caption: 'Tills already open on other devices keep working while you change it.' }
      : { title: info ? `Welcome, ${info.name}` : 'Welcome', subtitle: info ? `${info.shop.name} is ready on ScaleEzy POS. Choose a password to sign in with, and a PIN for the counter.` : 'Checking your link…',
          caption: 'Your counter is ready. Add your staff later under More → Staff.' }

  return (
    <AuthFrame {...side}>
      {!info && !problem && <p style={s.muted} role="status"><Loader2 size={16} className="spin" aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />Checking your link…</p>}
      {info && (
        <form onSubmit={submit} style={s.form} noValidate aria-label={reset ? 'New password form' : 'Set up your sign-in'}>
          <div style={s.who}><span style={{ ...afLabel, marginBottom: 4 }}>You sign in with</span><strong style={s.login}>{info.signInWith}</strong></div>
          <div>
            <label htmlFor="new-password" style={afLabel}>Password</label>
            <div style={{ position: 'relative' }}>
              <input id="new-password" type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters" style={{ ...afField, paddingRight: 54 }} autoComplete="new-password" autoFocus />
              <button type="button" style={s.eye} onClick={() => setShow(!show)} aria-label={show ? 'Hide the password' : 'Show the password'}>
                {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="again-password" style={afLabel}>The same password again</label>
            <input id="again-password" type={show ? 'text' : 'password'} value={form.again} onChange={e => setForm({ ...form, again: e.target.value })} style={afField} autoComplete="new-password" />
          </div>
          {!reset && (
            <div>
              <label htmlFor="new-pin" style={afLabel}>PIN</label>
              <input id="new-pin" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="4 numbers"
                inputMode="numeric" autoComplete="off" style={{ ...afField, letterSpacing: form.pin ? '0.4em' : 'normal' }} />
              <p style={s.hint}>Not easy to guess: not 1234 or 1111.</p>
            </div>
          )}
          <AfProblem>{problem}</AfProblem>
          <button type="submit" className="af-go" style={afPrimary(busy)} disabled={busy}>
            {busy && <Loader2 size={18} className="spin" aria-hidden="true" />}{busy ? 'Opening the till…' : 'Save and open the till'}{!busy && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>
      )}
      {!info && problem && (
        <div style={s.form}>
          <AfProblem>{problem}</AfProblem>
          <button type="button" className="af-go" style={afPrimary(false)} onClick={() => navigate('/', { replace: true })}>Go to sign in<ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      )}
    </AuthFrame>
  )
}

const s = {
  form: { display: 'grid', gap: 18, minWidth: 0 },
  who: { display: 'grid', gap: 0, padding: '12px 14px', borderRadius: 14, background: 'var(--brand-tint)', border: '1px solid var(--brand-tint-strong)', minWidth: 0 },
  login: { overflowWrap: 'anywhere', fontSize: 15.5 },
  eye: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 44, minHeight: 44, padding: 0, display: 'grid', placeItems: 'center', background: 'none', border: 'none', boxShadow: 'none', color: 'var(--ink-soft)' },
  hint: { margin: '6px 0 0', color: 'var(--ink-soft)', fontSize: 13 },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 14.5 }
}
