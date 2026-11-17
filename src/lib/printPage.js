import { useEffect } from 'react'
import { paperWidthMm } from './device.js'

/**
 * THE PAPER IS THE DOCUMENT'S OWN SIZE (17 Nov, found by printing every document through Chrome's
 * own print engine). Every slip asked for `@page { size: 80mm auto }` -- and "auto" beside a length
 * is not valid CSS, so the browser dropped the whole rule and printed on its default Letter page:
 * the print preview and "Save as PDF" came out 216 mm wide with the bill in a corner.
 *
 * So the page is measured instead: as wide as this device's paper (80 or 58 mm), as long as the
 * document itself, kept up to date while it grows (a line added, a duplicate banner shown) and once
 * more just before printing. One roll, one page, nothing cut and no blank tail.
 *
 * `selector` is the element that is printed (.receipt, .estimate-print, .voucher-slip).
 */
export function usePageFit(selector) {
  useEffect(() => {
    const el = document.querySelector(selector)
    if (!el) return
    let style = document.getElementById('pos-page-fit')
    if (!style) {
      style = document.createElement('style')
      style.id = 'pos-page-fit'
      document.head.appendChild(style)
    }
    const set = () => {
      // Measured on screen, where the type is a little larger than on paper: a safe upper bound.
      const lengthMm = Math.max(60, Math.ceil(el.scrollHeight * 25.4 / 96) + 8)
      style.textContent = `@media print { @page { size: ${paperWidthMm()}mm ${lengthMm}mm; margin: 0; } }`
    }
    set()
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null
    watch?.observe(el)
    window.addEventListener('beforeprint', set)
    return () => {
      watch?.disconnect()
      window.removeEventListener('beforeprint', set)
      style.textContent = ''
    }
  })
}
