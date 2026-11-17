import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * THE WAY BACK, AND THE WAY ON (17 Nov, owner: "← All bills" and "rehann →" read as bare text).
 *
 * BackLink: the one way back to a list, the same on every screen -- a chevron and the list's name.
 * LinkChip: a person, bill or order this screen points to, as a tinted pill that says it opens.
 * BackButton: for a screen reached from More or Home (Reports, Settings, Shift...). The till is
 *   installed as an app, so there is no browser bar and, on an iPhone or a laptop window, no back
 *   button at all (17 Nov, owner: "do we need back buttons?"). It goes back to wherever the person
 *   came from; opened directly -- a refresh, a bookmark -- it goes to More, where these screens live.
 * Styles in index.css (.back-link, .link-chip).
 */
export function BackLink({ to, children }) {
  return (
    <Link to={to} className="back-link">
      <ChevronLeft size={17} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  )
}

export function BackButton({ fallback = '/more', children = 'Back' }) {
  const navigate = useNavigate()
  // React Router gives the first screen of a visit the key 'default': nothing of ours to go back to.
  const cameFromInside = useLocation().key !== 'default'
  return (
    <button type="button" className="back-link page-back" onClick={() => (cameFromInside ? navigate(-1) : navigate(fallback, { replace: true }))}>
      <ChevronLeft size={17} aria-hidden="true" />
      <span>{children}</span>
    </button>
  )
}

export function LinkChip({ to, Icon, tone, children, ...rest }) {
  return (
    <Link to={to} className={`link-chip${tone ? ` ${tone}` : ''}`} {...rest}>
      {Icon && <Icon size={15} aria-hidden="true" />}
      <span>{children}</span>
      <ChevronRight size={15} aria-hidden="true" className="link-chip-chev" />
    </Link>
  )
}
