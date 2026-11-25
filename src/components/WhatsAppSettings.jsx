import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MessageCircle, Loader2, Smartphone, QrCode, RefreshCw } from 'lucide-react'
import { useQuery } from '../lib/query.js'
import { loadWhatsApp, linkWhatsApp, unlinkWhatsApp, messageFor } from '../lib/api.js'
import { askYesNo } from './Ask.jsx'

/*
 * WHATSAPP, LINKED FROM POS (25 Nov, owner): a shop links its own number here by scanning a QR -- boutique-run
 * shops have no Inventory login. One number per shop, shared with Inventory and CRM: linked here or in
 * Inventory, it shows in both.
 *
 *   Anyone signed in at the till may link it, cashiers too (the owner's word, 25 Nov); each link is in the activity log.
 *   A QR lasts about 20 s: a fresh one is fetched every 18 s while it is on screen, five times, then a button.
 *   A code is fetched only when asked (each one starts the link afresh on WhatsApp's side).
 *   While linking, the state is checked every 2.5 s; "Connected" closes the panel by itself.
 *   A person presses Send on each bill -- one bill per press, never automatic (the service's rule).
 */
const LABEL = { CONNECTED: 'Connected', LINKING: 'Being linked', DISCONNECTED: 'Disconnected', LOGGED_OUT: 'Logged out', NOT_LINKED: 'Not linked' }
const TONE = { CONNECTED: 'good', LINKING: 'brand', DISCONNECTED: 'warn', LOGGED_OUT: 'warn', NOT_LINKED: '' }
const WHY = {
  DISCONNECTED: 'The phone is offline or WhatsApp was closed on it. It usually comes back by itself; if not, link it again.',
  LOGGED_OUT: 'It was logged out on the phone. Link it again to send bills from it.'
}
const QR_ROUNDS = 5
const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null)

export default function WhatsAppSettings() {
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState(null)   // null | 'qr' | 'code'
  const { data: w, isLoading } = useQuery({ queryKey: ['whatsapp'], queryFn: () => loadWhatsApp(true), staleTime: 30_000 })
  const account = w?.account
  const status = account?.status
  const connected = status === 'CONNECTED'

  const done = (fresh) => {
    setPanel(null)
    toast.success(`WhatsApp linked${fresh?.phone ? `: ${fresh.phone}` : ''}. Bills can now go from the shop's own number.`, { duration: 6000 })
    queryClient.setQueryData(['whatsapp'], prev => (prev ? { ...prev, account: fresh } : prev))
    queryClient.invalidateQueries({ queryKey: ['shop'] })
  }

  async function linkDifferent() {
    const yes = await askYesNo(`Unlink ${account?.phone ?? 'this number'} and link a different phone?`, {
      note: "Until the new one is linked, bills are shared from the cashier's phone instead. Inventory and CRM use the same number, so they change too.",
      confirmLabel: 'Unlink and link another', danger: true
    })
    if (!yes) return
    try {
      const next = await unlinkWhatsApp()
      queryClient.setQueryData(['whatsapp'], next)
      setPanel('qr')
    } catch (err) { toast.error(messageFor(err)) }
  }

  return (
    <section style={s.card} aria-label="WhatsApp">
      <div style={s.head}><span style={s.icon}><MessageCircle size={18} aria-hidden="true" /></span><b>WhatsApp</b></div>
      {isLoading ? <p style={s.muted}>Checking…</p> : !w?.configured ? (
        <p style={s.muted}>
          This till is not connected to ScaleEzy WhatsApp yet, so cashiers share bills from their own phone
          (Share). Ask ScaleEzy to switch it on.
        </p>
      ) : (
        <>
          <div style={s.stateRow}>
            <span className={`chip ${account ? TONE[status] ?? '' : 'warn'}`}>
              {account ? `${LABEL[status] ?? status}${connected && account.phone ? ` · ${account.phone}` : ''}` : 'Could not be checked just now'}
            </span>
            {connected && account.linkedAt && <span style={s.muted}>Linked {when(account.linkedAt)}</span>}
          </div>
          {WHY[status] && <p style={s.muted}>{WHY[status]}</p>}
          <p style={s.muted}>
            The shop's own number, linked here or in Inventory, and used by every ScaleEzy app.
            {!connected && ' Until it is connected, cashiers share bills from their own phone (Share).'}
          </p>

          {panel ? (
            <LinkPanel method={panel} setMethod={setPanel} onConnected={done} onCancel={() => setPanel(null)} />
          ) : w.mayLink ? (
            <div style={s.actions}>
              {connected
                ? <button type="button" onClick={linkDifferent}>Link a different phone</button>
                : <button type="button" style={s.primary} onClick={() => setPanel('qr')}>
                    <QrCode size={16} aria-hidden="true" /> {status === 'LOGGED_OUT' || status === 'DISCONNECTED' ? 'Link again' : 'Link your WhatsApp'}
                  </button>}
            </div>
          ) : <p style={s.muted}>Sign in at the till to link the shop's WhatsApp.</p>}

          <p style={s.muted}>
            A bill goes when the cashier presses <b>WhatsApp</b> on it, one per press. A newly linked number sends
            about 40 messages a day for its first two weeks, then 200, and anyone who replies STOP gets nothing more.
          </p>
        </>
      )}
    </section>
  )
}

/** The QR (fresh every 18 s) or the code, and a check every 2.5 s until the phone is linked. */
function LinkPanel({ method, setMethod, onConnected, onCancel }) {
  const queryClient = useQueryClient()
  const [qr, setQr] = useState(null)
  const [code, setCode] = useState(null)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)
  const [rounds, setRounds] = useState(0)
  const alive = useRef(true)
  // Set on every mount, not only the first: React's development mode mounts twice, and a flag left false
  // ignored every answer (found 25 Nov in the browser test).
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const connectedRef = useRef(onConnected)
  connectedRef.current = onConnected

  // One request at a time (a QR can take ~5 s to make), and the next QR is due 18 s after the last one was
  // ASKED for -- the engine's QR lives about 20 s, so counting from the answer showed a dead one (25 Nov).
  const inFlight = useRef(false)
  const askedAt = useRef(0)
  async function fetchLink(body) {
    if (inFlight.current) return
    inFlight.current = true; askedAt.current = Date.now()
    setBusy(true); setProblem(null)
    try {
      const r = await linkWhatsApp(body)
      if (!alive.current) return
      if (r.status === 'CONNECTED') { connectedRef.current((await loadWhatsApp(true)).account); return }
      if (body.method === 'qr') { setQr(r.qr); setRounds(n => n + 1) } else setCode(r.pairingCode)
    } catch (err) {
      if (alive.current) setProblem(messageFor(err))
    } finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }

  // The QR: the first one now, then a fresh one every 18 s, five times; after that, a button.
  useEffect(() => {
    if (method !== 'qr') return undefined
    setRounds(0); setQr(null)
    fetchLink({ method: 'qr' })
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])
  useEffect(() => {
    if (method !== 'qr' || !qr || rounds >= QR_ROUNDS) return undefined
    const t = setTimeout(() => fetchLink({ method: 'qr' }), Math.max(1_000, 18_000 - (Date.now() - askedAt.current)))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, qr, rounds])

  // Linked yet? Every 2.5 s while the panel is open.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const now = await loadWhatsApp(true)
        if (!alive.current) return
        if (now?.account?.status === 'CONNECTED') connectedRef.current(now.account)
        else queryClient.setQueryData(['whatsapp'], now)   // the label above says "Being linked" meanwhile
      } catch { /* the next check tries again */ }
    }, 2500)
    return () => clearInterval(t)
  }, [queryClient])

  const qrPaused = method === 'qr' && rounds >= QR_ROUNDS && !busy

  return (
    <div style={s.panel} aria-label={method === 'qr' ? 'Link with a QR' : 'Link with a code'}>
      {method === 'qr' ? (
        <div style={s.linkGrid}>
          <div style={s.qrBox} aria-live="polite">
            {qr && !qrPaused ? <img src={qr} alt="QR to scan with WhatsApp on the shop's phone" style={s.qrImg} />
              : qrPaused ? <button type="button" onClick={() => { setRounds(0); fetchLink({ method: 'qr' }) }}><RefreshCw size={16} aria-hidden="true" /> Show a new QR</button>
              : <span style={s.waiting}><Loader2 size={20} className="spin" aria-hidden="true" /> Making the QR…</span>}
          </div>
          <ol style={s.steps}>
            <li>Open <b>WhatsApp</b> on the shop's phone.</li>
            <li>Tap <b>⋮</b> (or <b>Settings</b> on iPhone) → <b>Linked devices</b> → <b>Link a device</b>.</li>
            <li>Point the phone at this QR.</li>
            <li style={s.mutedLi}>It changes every 18 seconds; that's normal. This screen closes by itself once linked.</li>
          </ol>
        </div>
      ) : (
        <div style={s.codeGrid}>
          <label style={s.label}>
            WhatsApp number of the shop's phone
            <input inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="98765 43210" aria-label="WhatsApp number of the shop's phone" maxLength={20} />
          </label>
          <button type="button" style={s.primary} disabled={busy || phone.replace(/\D/g, '').length < 10} onClick={() => fetchLink({ method: 'code', phone })}>
            {busy ? 'Getting the code…' : code ? 'Get a new code' : 'Get the code'}
          </button>
          {code && (
            <>
              <p style={s.code} aria-label={`Code ${code.split('').join(' ')}`}>{code}</p>
              <ol style={s.steps}>
                <li>On the shop's phone: <b>WhatsApp</b> → <b>Linked devices</b> → <b>Link a device</b>.</li>
                <li>Tap <b>Link with phone number instead</b> and enter this code.</li>
              </ol>
            </>
          )}
        </div>
      )}
      {problem && <p style={s.problem} role="alert">{problem}</p>}
      <div style={s.actions}>
        <button type="button" onClick={() => setMethod(method === 'qr' ? 'code' : 'qr')} disabled={busy && method === 'code'}>
          {method === 'qr' ? <><Smartphone size={16} aria-hidden="true" /> Link with a code instead</> : <><QrCode size={16} aria-hidden="true" /> Use the QR instead</>}
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

const s = {
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' },
  head: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 },
  icon: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)', flex: 'none' },
  stateRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  panel: { display: 'grid', gap: 12, padding: 14, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--bg, #fff)' },
  linkGrid: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' },
  qrBox: { width: 232, height: 232, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 12, background: '#fff', border: '1px solid var(--line)' },
  qrImg: { width: 216, height: 216, imageRendering: 'pixelated' },
  waiting: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 14 },
  steps: { margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14, minWidth: 0, flex: '1 1 220px' },
  mutedLi: { color: 'var(--ink-soft)', fontSize: 13, listStyle: 'none', marginLeft: -20 },
  codeGrid: { display: 'grid', gap: 10, maxWidth: 420 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  code: { margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '0.18em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' },
  problem: { margin: 0, color: 'var(--bad)', fontSize: 14 }
}
