import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * WHERE A DROP-DOWN'S LIST OR A DATE FIELD'S CALENDAR GOES (17 Nov).
 *
 * The panel is drawn on document.body, fixed to the screen, so no card, sheet or scrolling list can
 * clip it. It sits under its button, or above when there is more room there, never off the side of a
 * phone, and never taller than the room it has (it scrolls inside instead).
 *
 * It closes when the person presses anywhere else or presses Escape. When the page behind it moves
 * it FOLLOWS its button, and closes only once the button has gone off the screen. (Closing on any
 * scroll lost the list whenever the page was still gliding as it opened -- a flick, then a tap.)
 */
export function usePopover(open, anchorRef, panelRef, close, { minWidth = 0, matchWidth = true, maxHeight = 320, watch } = {}) {
  const [style, setStyle] = useState({ position: 'fixed', left: 0, top: 0, visibility: 'hidden' })
  const again = useRef(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect()
      const panel = panelRef.current
      if (!a || !panel) return
      const vw = document.documentElement.clientWidth, vh = window.innerHeight
      const gap = 6, edge = 8
      const width = Math.min(Math.max(matchWidth ? a.width : 0, minWidth), vw - edge * 2)
      // Its height depends on its width (a calendar's days are squares), so the width goes on first
      // and the height is read after. Measured the other way round, the last week was cut off.
      panel.style.width = `${width}px`
      panel.style.maxHeight = 'none'
      const natural = Math.min(panel.scrollHeight + 2, maxHeight)
      const below = vh - a.bottom - gap - edge, above = a.top - gap - edge
      const up = below < Math.min(natural, 200) && above > below
      const height = Math.max(120, Math.min(natural, up ? above : below))
      // Put back by hand as well: React only rewrites a style it believes has changed.
      panel.style.maxHeight = `${height}px`
      const left = Math.max(edge, Math.min(a.left, vw - width - edge))
      setStyle({
        position: 'fixed', left, width, maxHeight: height, visibility: 'visible',
        ...(up ? { bottom: vh - a.top + gap } : { top: a.bottom + gap })
      })
    }
    let frame = 0
    const follow = e => {
      if (e?.target && panelRef.current?.contains(e.target)) return   // the list's own scrolling
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const a = anchorRef.current?.getBoundingClientRect()
        if (!a || a.bottom < 0 || a.top > window.innerHeight) return close()
        place()
      })
    }
    place()
    again.current = place
    const onDown = e => {
      if (anchorRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      again.current = null
      document.removeEventListener('pointerdown', onDown, true)
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // What is inside changed size (a calendar turned to its years): measure and place it again.
  useLayoutEffect(() => { again.current?.() }, [watch])

  // Closed: forget the old place, so the next opening is measured before it is seen.
  useEffect(() => { if (!open) setStyle({ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }) }, [open])

  return style
}
