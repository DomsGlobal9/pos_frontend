import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { rupees } from '../lib/api.js'
import { upiLink } from '../lib/upi.js'

/** The QR the customer scans to pay this amount by UPI. POS-PAY-012. */
export default function UpiQr({ upiId, name, amountPaise, note }) {
  const link = upiLink({ upiId, name, amountPaise, note })
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let live = true
    if (link) QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then(u => live && setSrc(u)).catch(() => setSrc(null))
    return () => { live = false }
  }, [link])

  if (!link) return null
  return (
    <div style={s.box} data-upi={link}>
      {src && <img src={src} alt={`UPI QR for ${rupees(amountPaise)}`} style={s.img} />}
      <div style={s.text}>
        <b>Scan to pay {rupees(amountPaise)}</b>
        <div style={s.muted}>Any UPI app. Pays {upiId}.</div>
        <div style={s.muted}>Then type the reference from the customer's screen below.</div>
      </div>
    </div>
  )
}

const s = {
  box: { display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, background: 'var(--brand-tint)', border: '1px solid var(--brand-tint-strong)' },
  img: { width: 120, height: 120, borderRadius: 8, background: '#fff', imageRendering: 'pixelated', flex: 'none' },
  text: { display: 'grid', gap: 4, fontSize: 14, color: 'var(--brand-deep)' },
  muted: { fontSize: 12, color: 'var(--ink-soft)' }
}
