/**
 * Code 128 (set B), for the labels a shop sticks on new stock.
 *
 * Written here rather than added as a library: the zxing package the camera scanner already uses can
 * READ Code 128 but its writer is commented out, and the encoding is one fixed table and a checksum.
 * Proven against zxing's own reader in scripts/check-code128.mjs -- a bar wrong anywhere fails there.
 *
 * Set B covers every printable ASCII character, which is every item code and barcode the till holds.
 * A label printer at 203 dpi draws 8 dots per mm, so a module of 0.25 mm and up scans reliably.
 */

// Bar and space widths for symbols 0..106 (103/104/105 start A/B/C, 106 stop), as the standard lists them.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
]
const START_B = 104
const STOP = 106

/** True when every character can be written in set B (printable ASCII). */
export const encodable = (text) => typeof text === 'string' && text.length > 0 && /^[\x20-\x7E]+$/.test(text)

/**
 * The bars, as alternating widths in modules, starting with a bar. Throws for text set B cannot hold.
 */
export function code128Widths(text) {
  if (!encodable(text)) throw new Error('Only plain letters, digits and punctuation can go in a barcode.')
  const values = [...text].map(c => c.charCodeAt(0) - 32)
  const checksum = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103
  return [START_B, ...values, checksum, STOP].flatMap(v => [...PATTERNS[v]].map(Number))
}

/** An SVG of the barcode, `height` modules tall, with the quiet zone the standard asks for (10 modules). */
export function code128Svg(text, { height = 40, quiet = 10 } = {}) {
  const widths = code128Widths(text)
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2
  let x = quiet
  const rects = []
  widths.forEach((w, i) => {
    if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`)
    x += w
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="${total}" height="${height}" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`
}
