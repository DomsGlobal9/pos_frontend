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
      {/* A counter's thermal printer (25 Nov, owner: it did not look like a machine, and the bill did not tear):
          a lid, a face with the badge, a feed button and a light, and a toothed tear bar the paper leaves through. */}
      <div className="af-printer">
        <div className="af-lid"><span className="af-seam" /></div>
        <div className="af-face">
          <span className="af-badge">POS</span>
          <span className="af-feed" />
          <span className="af-led" />
        </div>
        <div className="af-mouth"><span className="af-stub" /></div>
        <div className="af-teeth" />
      </div>
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
        .af-caption { position: relative; z-index: 3; margin: 0; max-width: 24ch; font-size: clamp(19px, 1.9vw, 26px); line-height: 1.3; font-weight: 600; letter-spacing: -.01em; }

        /* ---- the printer and the receipt ---- */
        .af-stage { align-self: center; justify-self: center; width: 280px; max-width: 100%; display: grid; justify-items: center; }
        .af-printer { position: relative; z-index: 1; width: 100%; display: grid; filter: drop-shadow(0 16px 20px rgba(0,0,0,.45));
          animation: af-hum 9s linear infinite; }
        .af-lid { position: relative; height: 30px; border-radius: 16px 16px 4px 4px;
          background: linear-gradient(180deg, #3b423d 0%, #262b27 55%, #1d211e 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.14); }
        .af-seam { position: absolute; left: 14px; right: 14px; bottom: 6px; height: 2px; border-radius: 2px; background: rgba(0,0,0,.45);
          box-shadow: 0 1px 0 rgba(255,255,255,.06); }
        .af-face { position: relative; height: 36px; display: flex; align-items: center; gap: 10px; padding: 0 14px;
          background: linear-gradient(180deg, #202421, #171a18); }
        .af-badge { font: 800 10px/1 system-ui, sans-serif; letter-spacing: .16em; color: var(--brand); padding: 3px 6px 3px 7px;
          border: 1px solid color-mix(in srgb, var(--brand) 45%, transparent); border-radius: 4px; }
        .af-feed { margin-left: auto; width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #4a524c, #222723);
          box-shadow: 0 1px 0 rgba(255,255,255,.08), inset 0 -1px 2px rgba(0,0,0,.6); }
        .af-led { width: 7px; height: 7px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 9px var(--brand);
          animation: af-led 9s steps(1, end) infinite; }
        .af-mouth { position: relative; height: 12px; margin: 0 6px; border-radius: 0 0 8px 8px; background: #0b0d0c;
          box-shadow: inset 0 3px 4px rgba(0,0,0,.8); }
        /* The paper's end, always waiting in the mouth: what is left after each tear. */
        .af-stub { position: absolute; left: 22px; right: 22px; bottom: -2px; height: 7px; background: #fffdf6;
          -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 12px 100%;
                  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 12px 100%; }
        /* The tear bar: brushed metal with teeth, the edge every receipt is torn against. */
        .af-teeth { position: relative; z-index: 2; height: 7px; margin: -3px 14px 0; background: linear-gradient(180deg, #d9ddd9, #9aa19b);
          -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 8px 100%;
                  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 8px 100%; }
        /* Only above the printer's mouth is the paper hidden (25 Nov, owner: the torn bill was cut off square by
           this box). Below and to the sides it is free: the bill shows whole, and floats down when torn off. */
        .af-clip { width: 236px; margin-top: -4px; clip-path: inset(0 -400px -900px -400px); }
        .af-shade { filter: drop-shadow(0 14px 18px rgba(0,0,0,.28)); }
        /* Torn at both ends: the bottom where the last bill was torn off, the top where this one will be. */
        .af-receipt { --paper: #fffdf6; position: relative; padding: 22px 16px 26px; background: var(--paper); color: #1f2420;
          font: 12.5px/1.65 ui-monospace, 'Cascadia Mono', Consolas, 'SFMono-Regular', Menlo, monospace;
          -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% 100% / 12px 51% repeat-x,
                        conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) 50% 0 / 12px 51% repeat-x;
                  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% 100% / 12px 51% repeat-x,
                        conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) 50% 0 / 12px 51% repeat-x;
          transform-origin: 50% 0;
          animation: af-print 9s linear infinite; }
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

        /* One 9-second loop, all parts on the same clock:
             2-32%   the paper feeds out in small steps, as a thermal printer's motor drives it (and the machine hums);
             36%     the PAID stamp;
             72-77%  a hand tugs it down against the teeth, a little to one side;
             78.5%   it snaps free -- the torn top edge shows --
             79-97%  and floats down like paper, swaying and tipping, fading as it goes;
             98-100% hidden, back inside, ready for the next bill. */
        @keyframes af-print {
          0%, 2% { transform: perspective(700px) translate(0, -100%) rotate(0) rotateX(0); opacity: 1; animation-timing-function: steps(26, end); }
          32%    { transform: perspective(700px) translate(0, 0) rotate(0) rotateX(0); opacity: 1; animation-timing-function: ease-in-out; }
          72%    { transform: perspective(700px) translate(0, 0) rotate(0) rotateX(0); opacity: 1; animation-timing-function: cubic-bezier(.5,0,.8,.3); }
          /* a hand tugs it down against the teeth */
          77%    { transform: perspective(700px) translate(2px, 7px) rotate(1.4deg) rotateX(0); opacity: 1; animation-timing-function: cubic-bezier(.2,.9,.3,1); }
          /* snap: it comes free */
          78.5%  { transform: perspective(700px) translate(-4px, 22px) rotate(-3deg) rotateX(6deg); opacity: 1; animation-timing-function: ease-in-out; }
          /* and floats down like paper: drifting one way, then the other, tipping as it goes */
          84%    { transform: perspective(700px) translate(26px, 74px) rotate(-8deg) rotateX(-12deg); opacity: 1; animation-timing-function: ease-in-out; }
          89%    { transform: perspective(700px) translate(-18px, 136px) rotate(6deg) rotateX(14deg); opacity: .5; animation-timing-function: ease-in-out; }
          94%    { transform: perspective(700px) translate(14px, 200px) rotate(-4deg) rotateX(-8deg); opacity: 0; animation-timing-function: ease-in; }
          97.5%  { transform: perspective(700px) translate(-6px, 250px) rotate(3deg) rotateX(6deg); opacity: 0; }
          98%, 100% { transform: perspective(700px) translate(0, -100%) rotate(0) rotateX(0); opacity: 0; }
        }
        /* The machine hums while it prints, and gives a little as the paper is torn. */
        @keyframes af-hum {
          0%, 2%, 32%, 76%, 80%, 100% { transform: none; }
          5%, 11%, 17%, 23%, 29% { transform: translateX(.6px); }
          8%, 14%, 20%, 26% { transform: translateX(-.6px); }
          78.5% { transform: translateY(2px); }
        }
        @keyframes af-stamp {
          0%, 33% { opacity: 0; transform: rotate(-8deg) scale(1.7); }
          37%     { opacity: 1; transform: rotate(-8deg) scale(.96); }
          40%, 100% { opacity: 1; transform: rotate(-8deg) scale(1); }
        }
        /* The light blinks while printing, then stays on. */
        @keyframes af-led { 0%, 4%, 8%, 12%, 16%, 20%, 24%, 28% { opacity: 1; } 2%, 6%, 10%, 14%, 18%, 22%, 26%, 30% { opacity: .25; } 32%, 100% { opacity: 1; } }

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
          .af-receipt, .af-stamp, .af-led, .af-printer, .af-body .spin, .af-col, .af-problem, .af-pop { animation: none; }
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
