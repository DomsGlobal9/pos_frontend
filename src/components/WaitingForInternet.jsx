import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { WifiOff } from 'lucide-react'

/**
 * WHY A SCREEN IS STILL LOADING, WITH THE INTERNET OFF (17 Nov).
 *
 * Offline, a screen whose figures were never fetched shows its own "Loading..." (lib/query.js) and
 * fills in by itself when the line is back. On its own that line looks stuck. So whenever the screen
 * now showing is waiting on the internet for something it has nothing of, this says so once, above
 * it, in the same words everywhere -- and that selling does not wait for it.
 *
 * Not on Sell: selling works in full offline, and what it waits for there (the staff list for "Who
 * served?") is a nicety. The header already says "No connection. Sales are kept on this till."
 */
const WORKS_OFFLINE = ['/sell']
export default function WaitingForInternet() {
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    const cache = queryClient.getQueryCache()
    const check = () => setWaiting(cache.findAll({ type: 'active' }).some(q => q.state.fetchStatus === 'paused' && q.state.data === undefined))
    check()
    return cache.subscribe(check)
  }, [queryClient])

  if (!waiting || WORKS_OFFLINE.includes(pathname)) return null
  return (
    <div className="waiting-internet no-print" role="status">
      <WifiOff size={16} aria-hidden="true" />
      <span>No internet. This screen fills in by itself when it is back. Selling carries on as usual.</span>
    </div>
  )
}
