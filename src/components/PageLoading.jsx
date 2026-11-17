/**
 * What a screen shows while its own file loads: the outline of a page, not a blank one. It appears
 * only after 150 ms (CSS), so a screen already on the device opens without a flicker.
 */
export default function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="skel" style={{ width: '42%', height: 26 }} />
      <div className="skel" style={{ width: '68%', height: 14 }} />
      <div className="skel" style={{ height: 120, borderRadius: 16 }} />
      <div className="skel" style={{ height: 72, borderRadius: 16 }} />
      <div className="skel" style={{ height: 72, borderRadius: 16 }} />
    </div>
  )
}
