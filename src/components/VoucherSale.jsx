import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import PaymentPanel from './PaymentPanel.jsx'
import { sellVoucher, rupees, messageFor } from '../lib/api.js'
import { newOnceKey } from '../lib/basket.js'
import { paperWidthMm } from '../lib/device.js'
import useEscape from '../lib/useEscape.js'

/**
 * SELLING A GIFT VOUCHER (16 Oct; Inventory's PLAN-gift-vouchers.md).
 *
 * Amount and (if they like) who it is from, then the money -- cash, UPI or card, taken for certain --
 * then Inventory makes the code and the slip prints. One key for the whole sale: pressing Sell again
 * after a slow answer gets the same voucher, never two. Not a bill: no GST until it is spent.
 */
export default function VoucherSale({ shop, counterId, onClose }) {
  const [step, setStep] = useState('amount') // amount | pay | done
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sold, setSold] = useState(null)
  const [qr, setQr] = useState(null)
  const onceKey = useRef(`voucher-${newOnceKey()}`)
  useEscape(() => { if (step !== 'pay') onClose() })

  const paise = Math.round(Number(String(amount).replace(/[₹,\s]/g, '')) * 100)
  // The shop's own limits, from Inventory (19 Oct): said before any money is taken, not after.
  const min = shop?.giftVouchers?.minPaise ?? 100
  const max = shop?.giftVouchers?.maxPaise ?? null
  const limitProblem = !Number.isFinite(paise) || !amount ? null
    : paise < min ? `A voucher here is at least ${rupees(min)}.`
    : max && paise > max ? `A voucher here is at most ${rupees(max)}.`
    : null
  const amountOk = Number.isFinite(paise) && paise >= 100 && !limitProblem

  useEffect(() => {
    if (sold?.code) QRCode.toDataURL(sold.code, { margin: 1, width: 200, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(null))
  }, [sold?.code])

  async function pay(payments) {
    try {
      const v = await sellVoucher({
        onceKey: onceKey.current, amountPaise: paise, counterId, payments,
        ...(name.trim() || phone.trim() ? { buyer: { ...(name.trim() ? { name: name.trim() } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}) } } : {})
      })
      setSold(v)
      setStep('done')
      toast.success(`Gift voucher ${v.code} sold.`)
    } catch (err) {
      // Stays on the payment box with everything typed: pressing again is safe (same key, same voucher).
      toast.error(messageFor(err), { duration: 8000 })
      return
    }
  }

  if (step === 'pay') {
    return (
      <PaymentPanel
        totalPaise={paise}
        enabledMethods={(shop?.enabledPaymentMethods?.length ? shop.enabledPaymentMethods : ['CASH', 'UPI', 'CARD']).filter(m => ['CASH', 'UPI', 'CARD'].includes(m))}
        heading="Gift voucher"
        confirmLabel={`Sell voucher ${rupees(paise)}`}
        onCancel={() => setStep('amount')}
        onConfirm={pay}
      />
    )
  }

  const valid = sold?.expiresAt ? new Date(sold.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  return (
    <div style={s.backdrop} role="dialog" aria-label="Gift voucher">
      <style>{`
        @media print {
          @page { size: ${paperWidthMm()}mm auto; margin: 0; }
          body * { visibility: hidden !important; }
          .voucher-slip, .voucher-slip * { visibility: visible !important; }
          .voucher-slip { position: absolute; left: 0; top: 0; width: ${paperWidthMm()}mm; padding: 4mm 3mm; }
        }
      `}</style>
      <div style={s.panel}>
        {step === 'amount' && (
          <form onSubmit={e => { e.preventDefault(); if (amountOk) setStep('pay') }} style={{ display: 'grid', gap: 12 }}>
            <b style={{ fontSize: 17 }}>Sell a gift voucher</b>
            <label style={s.label}>
              Amount
              <input autoFocus inputMode="decimal" value={amount} placeholder="5000" aria-label="Voucher amount"
                onChange={e => setAmount(e.target.value.replace(/[^0-9.,₹]/g, ''))} />
            </label>
            {limitProblem && <p style={s.problem} role="status">{limitProblem}</p>}
            <label style={s.label}>
              From (optional)
              <input value={name} placeholder="The buyer's name" aria-label="Buyer name" onChange={e => setName(e.target.value.slice(0, 80))} />
            </label>
            <label style={s.label}>
              Their phone (optional)
              <input value={phone} inputMode="tel" placeholder="10-digit mobile" aria-label="Buyer phone" onChange={e => setPhone(e.target.value.slice(0, 15))} />
            </label>
            <p style={s.muted}>Paid now in cash, UPI or card. The code comes from Inventory and works at every till of the shop. No GST now: it is charged on the goods when the voucher is used.</p>
            <div style={s.actions}>
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit" style={s.primary} disabled={!amountOk}>Take {amountOk ? rupees(paise) : 'payment'}</button>
            </div>
          </form>
        )}

        {step === 'done' && sold && (
          <>
            <div className="voucher-slip" style={s.slip}>
              <div style={{ textAlign: 'center', fontWeight: 700 }}>{shop?.shopName ?? ''}</div>
              <div style={{ textAlign: 'center', letterSpacing: 1 }}>GIFT VOUCHER</div>
              <div style={s.code}>{sold.code}</div>
              <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800 }}>{rupees(sold.amountPaise)}</div>
              {sold.buyerName && <div style={{ textAlign: 'center' }}>From {sold.buyerName}</div>}
              {qr && <img src={qr} alt={`QR for ${sold.code}`} style={{ display: 'block', width: 140, margin: '6px auto' }} />}
              <div style={{ textAlign: 'center', fontSize: 12 }}>Valid till {valid}. Use it at the counter; what is left stays on the code.</div>
            </div>
            {sold.changePaise > 0 && <p style={s.change} role="status">Change {rupees(sold.changePaise)}</p>}
            <div style={s.actions}>
              <button type="button" onClick={() => window.print()}>Print</button>
              <button type="button" style={s.primary} onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 },
  panel: { background: 'var(--panel)', borderRadius: 14, padding: 16, display: 'grid', gap: 12, maxHeight: '90vh', overflow: 'auto', width: 'min(420px, 100%)' },
  label: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 },
  muted: { color: 'var(--ink-soft)', fontSize: 12, margin: 0 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  slip: { border: '1px dashed var(--line)', borderRadius: 10, padding: 12, display: 'grid', gap: 4, background: '#fff', color: '#111' },
  code: { textAlign: 'center', fontFamily: 'ui-monospace, monospace', fontSize: 20, fontWeight: 800, letterSpacing: 2, margin: '6px 0' },
  change: { margin: 0, fontWeight: 700 },
  problem: { margin: 0, color: 'var(--bad)', fontSize: 13 }
}
