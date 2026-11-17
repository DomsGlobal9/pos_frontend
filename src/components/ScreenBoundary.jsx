import { Component } from 'react'
import { TriangleAlert } from 'lucide-react'

/**
 * NO SCREEN MAY TAKE THE TILL DOWN WITH IT (17 Nov).
 *
 * When a screen failed while drawing, the router replaced the WHOLE till -- header, nav and all --
 * with its own page: "Unexpected Application Error!" and a line of code. Ten screens did exactly
 * that with the internet off. Those are mended (lib/query.js), but the next mistake in any one
 * screen must not be able to do it again.
 *
 * ScreenBoundary sits around the screen only: the header and the nav stay, the person is told in
 * plain words, and Sell is one press away. AppShell gives it the address as its key, so going to
 * another screen clears it. ScreenProblem is the same message for the few pages outside the till's
 * frame (the customer's own bill, shop setup, the guide), used as the router's errorElement.
 *
 * "Try again" must really try again: the answer the screen choked on is still in memory, and drawing
 * it a second time fails a second time. AppShell passes onRetry, which throws away what the failed
 * screen had fetched, so it asks the server afresh.
 */
export function ScreenProblem({ onRetry }) {
  return (
    <div className="screen-unavailable" role="alert">
      <span className="screen-unavailable-icon" aria-hidden="true"><TriangleAlert size={22} /></span>
      <h1>This screen ran into a problem</h1>
      <p>Nothing you entered is lost. The basket and any sales not yet sent are kept on this till.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="btn-quiet" onClick={onRetry ?? (() => window.location.reload())}>Try again</button>
        <a className="btn-like" href="/sell" style={{ marginTop: 0 }}>Go to Sell</a>
      </div>
    </div>
  )
}

export default class ScreenBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // For whoever looks at the console afterwards; the person at the till is not shown code.
    console.error('[screen]', error, info?.componentStack)
  }

  render() {
    if (this.state.failed) return <ScreenProblem onRetry={() => { this.props.onRetry?.(); this.setState({ failed: false }) }} />
    return this.props.children
  }
}
