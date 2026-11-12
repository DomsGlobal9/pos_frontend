import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Lock } from 'lucide-react'
import { setIdleSignOut, messageFor } from '../lib/api.js'

/**
 * SIGN OUT WHEN IDLE (12 Nov, owner: "why it signs out, fix it").
 *
 * The till asks for a PIN again after a while with nothing happening, so somebody else at the counter
 * cannot approve, discount or write off as whoever was last signed in (9 Oct). Ten minutes suits a
 * busy counter with several people; a one-person shop may want longer. "Never" is offered, and says
 * plainly what it costs.
 */
const CHOICES = [[10, '10 minutes'], [30, '30 minutes'], [60, '1 hour'], [240, '4 hours'], [0, 'Never']]

export default function IdleSignOutSettings({ shop, owner }) {
  const queryClient = useQueryClient()
  const current = shop?.shop?.idleSignOutMinutes ?? 10
  const [busy, setBusy] = useState(false)

  async function choose(minutes) {
    setBusy(true)
    try {
      await setIdleSignOut(minutes)
      await queryClient.invalidateQueries({ queryKey: ['shop'] })
      toast.success('Saved.')
    } catch (err) { toast.error(messageFor(err)) }
    finally { setBusy(false) }
  }

  return (
    <section style={s.card} aria-label="Sign out when idle">
      <div style={s.head}><span style={s.icon}><Lock size={18} aria-hidden="true" /></span><b>Sign out when idle</b></div>
      <p style={s.muted}>
        With nothing happening for this long -- no tap, no scan, nothing in the basket -- the till asks for a name and PIN again,
        so nobody else at the counter can sell or approve as the last person.
      </p>
      <label style={s.label}>
        Ask for the PIN again after
        <select value={current} disabled={!owner || busy} onChange={e => choose(Number(e.target.value))} aria-label="Ask for the PIN again after">
          {CHOICES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </label>
      {current === 0 && <p style={s.warn}>Never: whoever signed in last stays signed in until someone presses Switch. Use this only if one person works the till.</p>}
      {!owner && <p style={s.muted}>Only the owner can change this.</p>}
    </section>
  )
}

// The Settings page's own card look.
const s = {
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' },
  head: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 },
  icon: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)', flex: 'none' },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 },
  warn: { color: 'var(--warn, #92400e)', fontSize: 13, margin: 0 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)', maxWidth: 320 }
}
