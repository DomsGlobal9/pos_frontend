import { useEffect } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * A SCREEN THIS TILL HAS NOT GOT YET, WITH THE INTERNET OFF (17 Nov).
 *
 * Every screen is its own file. Normally they are all on the device within seconds of the till
 * opening (lib/lazyPage.js warms them, and the installed app keeps them), but in the first moments
 * after an install or an update one may be missing just as the line drops. Reloading then would swap
 * a missing screen for the browser's own "no internet" page and take the whole till with it. So this
 * is shown instead, in the till's frame, with selling one press away -- and the screen opens by itself
 * the moment the internet is back. The basket and any unsent sales are in storage; nothing is lost.
 */
export default function ScreenUnavailable() {
  useEffect(() => {
    const again = () => window.location.reload()
    window.addEventListener('online', again)
    return () => window.removeEventListener('online', again)
  }, [])
  return (
    <div className="screen-unavailable" role="status">
      <span className="screen-unavailable-icon" aria-hidden="true"><WifiOff size={22} /></span>
      <h1>This screen is not on this till yet</h1>
      <p>The internet is off, and this screen was not opened before it went. It opens by itself when the internet is back.</p>
      <p>Selling carries on as usual. Sales made now are kept on this till and sent later.</p>
      <a className="btn-like" href="/sell">Go to Sell</a>
    </div>
  )
}
