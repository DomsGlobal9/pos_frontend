import { AlertCircle } from 'lucide-react'
import Scene from './AuthScenes.jsx'

/**
 * THE FRAME AROUND SIGNING IN (25 Nov). POS's own look, not Inventory's (owner: "be unique, add the side
 * animation"): a deep-green counter panel where a receipt prints out of a till printer, bill lines, total, a
 * "Paid" stamp, then it is torn off and the next one prints. It is the one moving thing on the page; the form
 * beside it is quiet, left-aligned, no card.
 *
 *   laptop / desktop / tablet (>= 760px)   panel on the left (sticky), form on the right
 *   short or landscape windows             the printer scales down, the caption drops
 *   phone (< 760px)                        the panel becomes a band at the top, the receipt printing into it,
 *                                          and the form follows; nothing is wider than the screen
 *   reduced motion                         the finished receipt, still
 *
 * Used by opening the till, "Forgot your password?", and the welcome / reset link pages.
 */

/** One field. 52px tall: a thumb is about 45px. POS's own 12px corners. */
export const afField = {
  width: '100%', height: 52, padding: '0 16px', background: 'var(--panel)', border: '1px solid var(--line-strong)',
  borderRadius: 12, color: 'var(--ink)', fontSize: 16, fontFamily: 'inherit'
}
export const afLabel = { display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }

/** The one green button on the page, so there is never a question which one goes ahead. */
export const afPrimary = (busy) => ({
  width: '100%', height: 54, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 700,
  cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1
})

/** A quiet text button: "Forgot your password?", "Back to sign in". */
export const afQuiet = {
  justifySelf: 'start', minHeight: 44, padding: '0 2px', display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none', border: 'none', boxShadow: 'none', color: 'var(--brand-deep)', fontWeight: 600, fontSize: 14.5
}

/** A problem, above the button: below it, it sits under the thumb and off the bottom of a short window. */
export function AfProblem({ children }) {
  if (!children) return null
  return <ProblemBox key={String(children)}>{children}</ProblemBox>
}
function ProblemBox({ children }) {
  return (
    <div role="alert" className="af-problem" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--bad-tint)', border: '1px solid color-mix(in srgb, var(--bad) 28%, transparent)', color: 'var(--bad)', fontSize: 14, lineHeight: 1.5 }}>
      <AlertCircle size={17} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  )
}

/** The receipt in the panel. Decoration only: hidden from screen readers. */
function Receipt() {
  return (
    <div className="af-stage" aria-hidden="true">
      <div className="af-printer"><span className="af-led" /><span className="af-slot" /></div>
      <div className="af-clip">
        <div className="af-shade">
          <div className="af-receipt">
            <div className="af-r-head"><strong>Counter 1</strong><span>Bill 0428 &nbsp; 11:42</span></div>
            <div className="af-r-rule" />
            <div className="af-r-line"><span>Cotton kurta</span><span>1,299</span></div>
            <div className="af-r-line"><span>Silk dupatta x2</span><span>1,580</span></div>
            <div className="af-r-line"><span>Linen shirt</span><span>899</span></div>
            <div className="af-r-rule" />
            <div className="af-r-line af-r-total"><span>Total</span><span>₹3,778</span></div>
            <div className="af-r-paid"><span className="af-stamp">Paid<small>by UPI</small></span></div>
            <div className="af-r-thanks">Thank you, visit again</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthFrame({ title, subtitle, caption = 'Bills, payments and receipts, right at the counter.', scene = 'receipt', children, footer }) {
  return (
    <div className="af-page">
      <style>{`
        /* Its own scroll container, with dvh: on a phone 100vh hides the last lines under the address bar. */
        .af-page { height: 100vh; height: 100dvh; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
          display: grid; grid-template-columns: minmax(0, min(44vw, 680px)) minmax(0, 1fr); background: var(--bg); }

        /* ---- the counter panel ---- */
        .af-panel { position: sticky; top: 0; height: 100vh; height: 100dvh; min-width: 0; overflow: hidden;
          display: grid; grid-template-rows: auto 1fr auto; gap: 16px; padding: clamp(20px, 3vw, 40px);
          color: #fff; background:
            radial-gradient(70% 45% at 50% 100%, color-mix(in srgb, var(--brand) 26%, transparent) 0%, transparent 70%),
            radial-gradient(55% 40% at 0% 0%, rgba(255,255,255,.07) 0%, transparent 70%),
            var(--brand-deep); }
        .af-logo { --h: 24px; display: block; position: relative; overflow: hidden; height: var(--h); width: calc(var(--h) * 926 / 142); }
        .af-logo img { position: absolute; max-width: none; width: auto; height: calc(var(--h) * 422 / 142); left: calc(var(--h) * -49 / 142); top: calc(var(--h) * -150 / 142); }
        .af-brand { display: flex; align-items: center; gap: 10px; }
        .af-tag { font-size: 12.5px; font-weight: 700; color: var(--brand-deep); background: var(--brand); padding: 2px 9px; border-radius: 6px; }
        .af-caption { margin: 0; max-width: 24ch; font-size: clamp(19px, 1.9vw, 26px); line-height: 1.3; font-weight: 600; letter-spacing: -.01em; }

        /* ---- the printer and the receipt ---- */
        .af-stage { align-self: center; justify-self: center; width: 280px; max-width: 100%; display: grid; justify-items: center; }
        .af-printer { position: relative; z-index: 1; width: 100%; height: 30px; border-radius: 10px 10px 6px 6px;
          background: linear-gradient(#0c2e12, #082409); box-shadow: 0 10px 24px -8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08); }
        .af-slot { position: absolute; left: 18px; right: 18px; bottom: 7px; height: 4px; border-radius: 4px; background: #020a03; }
        .af-led { position: absolute; right: 12px; top: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--brand);
          box-shadow: 0 0 8px var(--brand); animation: af-led 9s ease-in-out infinite; }
        .af-clip { width: 236px; height: 318px; margin-top: -9px; overflow: hidden; }
        .af-shade { filter: drop-shadow(0 14px 18px rgba(0,0,0,.28)); }
        .af-receipt { --paper: #fffdf6; position: relative; padding: 20px 16px 26px; background: var(--paper); color: #1f2420;
          font: 12.5px/1.65 ui-monospace, 'Cascadia Mono', Consolas, 'SFMono-Regular', Menlo, monospace;
          -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 12px 100%;
                  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 12px 100%;
          animation: af-print 9s cubic-bezier(.3,.7,.4,1) infinite; }
        .af-r-head { display: grid; justify-items: center; gap: 1px; }
        .af-r-head strong { font-size: 13.5px; }
        .af-r-head span { color: #66706a; font-size: 11.5px; }
        .af-r-rule { margin: 9px 0; border-top: 1.5px dashed #b9c0b9; }
        .af-r-line { display: flex; justify-content: space-between; gap: 10px; }
        .af-r-total { font-weight: 700; font-size: 14px; }
        .af-r-paid { display: grid; place-items: center; height: 70px; }
        .af-stamp { display: grid; justify-items: center; padding: 4px 16px 5px; border: 2.5px solid #2f7d32; border-radius: 8px; color: #2f7d32;
          font: 800 22px/1 system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; transform: rotate(-8deg);
          animation: af-stamp 9s ease-out infinite; }
        .af-stamp small { font-size: 10.5px; letter-spacing: .04em; margin-top: 2px; font-weight: 700; }
        .af-r-thanks { text-align: center; color: #66706a; font-size: 11.5px; }

        /* One 9-second loop, all parts on the same clock: print out (0-30%), stamp (36%), hold, tear off (86-94%). */
        @keyframes af-print {
          0%   { transform: translateY(-101%); opacity: 1; }
          30%  { transform: translateY(0); }
          86%  { transform: translateY(0); opacity: 1; }
          94%  { transform: translateY(46px) rotate(2deg); opacity: 0; }
          100% { transform: translateY(-101%); opacity: 0; }
        }
        @keyframes af-stamp {
          0%, 33% { opacity: 0; transform: rotate(-8deg) scale(1.7); }
          37%     { opacity: 1; transform: rotate(-8deg) scale(.96); }
          40%, 100% { opacity: 1; transform: rotate(-8deg) scale(1); }
        }
        @keyframes af-led { 0%, 30% { opacity: 1; } 15% { opacity: .35; } 31%, 100% { opacity: 1; } }

        /* ---- the form side ---- */
        .af-main { min-width: 0; display: grid; justify-items: center; align-content: center; align-content: safe center;
          padding: clamp(28px, 5vw, 72px) clamp(16px, 5vw, 64px); }
        .af-col { width: 100%; max-width: 400px; min-width: 0; display: grid; gap: 26px; }
        .af-title { margin: 0; font-size: clamp(28px, 2.8vw, 36px); line-height: 1.12; font-weight: 700; letter-spacing: -.025em; color: var(--ink); overflow-wrap: anywhere; }
        .af-sub { margin: 10px 0 0; color: var(--ink-soft); font-size: 15.5px; line-height: 1.55; }
        .af-body { display: grid; gap: 18px; min-width: 0; }
        .af-foot { margin: 0; padding-top: 16px; border-top: 1px solid var(--line); font-size: 13.5px; line-height: 1.5; color: var(--ink-soft); }
        .af-body input:focus { border-color: var(--brand-deep); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 35%, transparent); outline: none; }
        .af-body .spin { animation: af-spin .9s linear infinite; }
        /* Motion that answers what someone did: the next view slides in, a problem shakes once, the arrow leans on hover. */
        .af-col { animation: af-in .34s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes af-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .af-problem { animation: af-shake .38s ease-in-out; }
        @keyframes af-shake { 0%, 100% { transform: none; } 25% { transform: translateX(-6px); } 55% { transform: translateX(5px); } 80% { transform: translateX(-2px); } }
        .af-go svg:last-child { transition: transform .18s ease; }
        .af-go:hover:not(:disabled) svg:last-child { transform: translateX(3px); }
        .af-pop { animation: af-pop .5s .15s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes af-pop { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes af-spin { to { transform: rotate(360deg); } }

        /* Big screens: a bigger printer, so it does not float in the panel. */
        @media (min-width: 1400px) and (min-height: 860px) { .af-stage { transform: scale(1.25); } }

        /* Short windows (a landscape phone, a laptop with toolbars): the printer gets smaller, the caption drops. */
        @media (min-width: 760px) and (max-height: 620px) {
          .af-stage { transform: scale(.72); transform-origin: center; margin: -50px 0; }
          .af-caption { display: none; }
        }
        @media (min-width: 760px) and (max-height: 430px) { .af-stage { transform: scale(.56); margin: -80px 0; } }

        /* Phones: the panel is a band at the top, the receipt printing into it; then the form. */
        @media (max-width: 759px) {
          .af-page { grid-template-columns: minmax(0, 1fr); align-content: start; }
          .af-panel { position: relative; height: 196px; grid-template-rows: auto 1fr; gap: 10px; padding: 16px 16px 0; }
          .af-logo { --h: 20px; }
          .af-caption { display: none; }
          /* The paper runs on past the band: a fade, not a hard cut. */
          .af-panel::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 44px; z-index: 2; pointer-events: none;
            background: linear-gradient(to bottom, transparent, var(--brand-deep)); }
          .af-stage { align-self: start; transform: scale(.78); transform-origin: top center; }
          .af-stage-scene { transform: scale(.62); margin-top: 10px; }
          .af-main { align-content: start; padding: 26px 16px 40px; }
          .af-col { gap: 22px; }
        }
        @media (max-width: 759px) and (max-height: 640px) { .af-panel { height: 150px; } .af-stage { transform: scale(.64); } .af-stage-scene { transform: scale(.5); } }

        @media (prefers-reduced-motion: reduce) {
          .af-receipt, .af-stamp, .af-led, .af-body .spin, .af-col, .af-problem, .af-pop { animation: none; }
          .af-go:hover svg:last-child { transform: none; }
        }
      `}</style>

      <aside className="af-panel" aria-label="ScaleEzy POS">
        <div className="af-brand">
          <span className="af-logo" role="img" aria-label="ScaleEzy"><img src="/scaleezy-logo-dark.png" alt="" /></span>
          <span className="af-tag">POS</span>
        </div>
        {scene === 'receipt' ? <Receipt /> : <Scene kind={scene} />}
        <p className="af-caption">{caption}</p>
      </aside>

      <main className="af-main">
        <div className="af-col" key={title}>
          <div>
            <h1 className="af-title">{title}</h1>
            {subtitle && <p className="af-sub">{subtitle}</p>}
          </div>
          <div className="af-body">{children}</div>
          {footer && <p className="af-foot">{footer}</p>}
        </div>
      </main>
    </div>
  )
}
