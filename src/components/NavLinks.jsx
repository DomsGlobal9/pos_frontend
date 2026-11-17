import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * THE WAY BACK, AND THE WAY ON (17 Nov, owner: "← All bills" and "rehann →" read as bare text).
 *
 * BackLink: the one way back to a list, the same on every screen -- a chevron and the list's name.
 * LinkChip: a person, bill or order this screen points to, as a tinted pill that says it opens.
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

export function LinkChip({ to, Icon, tone, children, ...rest }) {
  return (
    <Link to={to} className={`link-chip${tone ? ` ${tone}` : ''}`} {...rest}>
      {Icon && <Icon size={15} aria-hidden="true" />}
      <span>{children}</span>
      <ChevronRight size={15} aria-hidden="true" className="link-chip-chev" />
    </Link>
  )
}
