/**
 * What a bill IS under GST (backend services/shop/gst-document.ts; Inventory's own words, verbatim).
 * Fixed on the bill when it was issued -- a later change of registration never rewrites it.
 */
export const HEADING = { TAX_INVOICE: 'TAX INVOICE', BILL_OF_SUPPLY: 'BILL OF SUPPLY', RECEIPT: 'RECEIPT' }
export const COMPOSITION_DECLARATION = 'Composition taxable person, not eligible to collect tax on supplies.'
export const kindOf = (doc) => doc?.documentKind ?? 'TAX_INVOICE'

/** GST state codes (a GSTIN's first two digits) to names -- the same list as backend services/shop/gst-states.ts. */
const GST_STATES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory'
}
/** "Telangana (36)" from the shop's GSTIN, or null. */
export const stateOf = (gstin) => {
  const code = (gstin ?? '').trim().slice(0, 2)
  return GST_STATES[code] ? `${GST_STATES[code]} (${code})` : null
}

/** Rule 46: an unregistered customer's name and address are needed on a tax invoice of this taxable value or more. */
export const LARGE_B2C_PAISE = 5_000_000
