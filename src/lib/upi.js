/**
 * A UPI payment link with the amount already in it. POS-PAY-012.
 *
 * The NPCI "upi://pay" format every UPI app reads: payee address (pa), payee name (pn), amount (am,
 * rupees with two decimals), currency (cu) and a note (tn). Scanning it opens the customer's app on
 * the right shop, for the right amount -- no typing, no wrong number.
 *
 * It does NOT tell the till the money arrived. That needs a payment provider (the other half of
 * PAY-012, not built), so the cashier still enters the UPI reference -- or marks it "not confirmed
 * yet" -- exactly as for any UPI payment.
 */
export function upiLink({ upiId, name, amountPaise, note }) {
  if (!upiId || !(amountPaise > 0)) return null
  const q = [
    ['pa', upiId],
    ['pn', (name ?? '').slice(0, 50)],
    ['am', (amountPaise / 100).toFixed(2)],
    ['cu', 'INR'],
    ...(note ? [['tn', note.slice(0, 50)]] : [])
  ].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return `upi://pay?${q}`
}
