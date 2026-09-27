import { useEffect, useState } from 'react'

/**
 * One place decides which device this is. POS-CORE-001.
 *
 * Every screen owes phone, tablet and desktop behaviour now that the 768 px hide rule is retired
 * (CHG-001), and the fastest way to get that wrong is for each component to invent its own
 * breakpoint. They live here.
 *
 *   phone    below 768    bottom nav, one column, sticky primary action
 *   tablet   768-1023     bottom nav, wider targets, more context visible
 *   desktop  1024 and up  left rail, keyboard-first, scanner speed
 *
 * Read with matchMedia rather than a resize listener: matchMedia fires only when the answer
 * actually changes, so rotating a tablet does not re-render the basket thirty times.
 */
const QUERIES = {
  phone: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  desktop: '(min-width: 1024px)'
}

function read() {
  // Server-side or a browser without matchMedia: assume the counter, because that is the device
  // this product is fastest on and the one a wrong guess hurts least.
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop'
  if (window.matchMedia(QUERIES.phone).matches) return 'phone'
  if (window.matchMedia(QUERIES.tablet).matches) return 'tablet'
  return 'desktop'
}

export function useDevice() {
  const [device, setDevice] = useState(read)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const lists = Object.values(QUERIES).map(q => window.matchMedia(q))
    const onChange = () => setDevice(read())
    lists.forEach(l => l.addEventListener('change', onChange))
    return () => lists.forEach(l => l.removeEventListener('change', onChange))
  }, [])

  return device
}

export const isTouchFirst = (device) => device === 'phone' || device === 'tablet'
