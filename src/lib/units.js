/**
 * SELLING BY LENGTH OR WEIGHT (16 Nov). A cloth line's qty is whole centimetres and its price is per
 * centimetre, exactly as Inventory sends them, so qty x price is still the line and no money is ever
 * fractional. Only what people read is in metres: "2.25 m", "₹450 / m".
 *
 * `unit` is what the server sends with an item or a bill line: { soldBy, short, factor, minCut }, or
 * null for a piece.
 */
export const isMeasured = (unit) => !!unit && unit.soldBy && unit.soldBy !== 'PIECE'

/** The step a measured line moves by: its smallest cut, else one display unit's hundredth. */
export const stepOf = (unit) => (isMeasured(unit) ? (unit.minCut > 0 ? unit.minCut : Math.max(1, Math.round(unit.factor / 100))) : 1)

const places = (unit) => (unit.factor >= 1000 ? 3 : unit.factor >= 100 ? 2 : 0)

/** "2.25 m" for 225 cm; "3" for three pieces. */
export function qtyText(qty, unit) {
  if (!isMeasured(unit)) return String(qty)
  return `${(qty / unit.factor).toFixed(places(unit))} ${unit.short}`
}

/** The price to show per display unit: 45000 paise a metre from 450 a centimetre. */
export const perUnitPaise = (pricePaise, unit) => (isMeasured(unit) ? pricePaise * unit.factor : pricePaise)

/** What was typed, in display units ("2.3"), as base units on the nearest step: 230 cm -> 225 with a 25 cm cut. */
export function fromTyped(typed, unit) {
  const n = Number(String(typed).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  const step = stepOf(unit)
  const base = Math.round(n * unit.factor)
  return Math.max(step, Math.round(base / step) * step)
}

/** Quick lengths a shop sells often, in base units, kept to steps of the cut: 0.25, 0.5, 1, 2, 2.5, 5 m. */
export function quickLengths(unit) {
  const step = stepOf(unit)
  return [0.25, 0.5, 1, 2, 2.5, 5]
    .map(m => Math.round(m * unit.factor))
    .filter(b => b >= step && b % step === 0)
}

const SHORT = { METRE: 'm', KILOGRAM: 'kg' }

/** A bill or credit-note line's unit, from the soldBy and unitFactor it was billed with. */
export const unitOfLine = (line) => (line?.soldBy && line.soldBy !== 'PIECE'
  ? { soldBy: line.soldBy, short: SHORT[line.soldBy] ?? line.soldBy.toLowerCase(), factor: line.unitFactor || 1, minCut: null }
  : null)
