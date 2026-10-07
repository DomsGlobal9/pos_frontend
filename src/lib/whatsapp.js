/**
 * A WhatsApp message the cashier sends from their own phone or WhatsApp Web, with the words ready.
 *
 * wa.me needs digits with the country code and no plus. Nothing to set up, no daily cap, no linked
 * number to get banned -- the shop's own WhatsApp, the way every Indian shop already talks to its
 * customers. Null when there is no number to send to, so a screen simply shows no button.
 */
export function waLink(phone, text) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  // A bare ten-digit Indian mobile gets its country code; anything else is taken as given.
  const full = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`
}
