/**
 * What a bill IS under GST (backend services/shop/gst-document.ts; Inventory's own words, verbatim).
 * Fixed on the bill when it was issued -- a later change of registration never rewrites it.
 */
export const HEADING = { TAX_INVOICE: 'TAX INVOICE', BILL_OF_SUPPLY: 'BILL OF SUPPLY', RECEIPT: 'RECEIPT' }
export const COMPOSITION_DECLARATION = 'Composition taxable person, not eligible to collect tax on supplies.'
export const kindOf = (doc) => doc?.documentKind ?? 'TAX_INVOICE'
