/**
 * THE PANEL'S SCENES (25 Nov, owner: "add animation-like things for what you did"). One per sign-in screen,
 * each showing what that screen does. Decoration only: hidden from screen readers, still under reduced motion.
 *
 *   mail   "Reset your password"     a letter goes into an envelope, the flap closes, it flies off
 *   sent   "Check your email"        the envelope has arrived: a tick draws itself, a ring goes out
 *   shop   a new owner's welcome     the shutter rolls up and the Open sign lights
 *   lock   "Choose a new password"   a key turns and the padlock opens
 *   shut   a link that cannot be used: the padlock stays shut and gives one shake
 *
 * The receipt (opening the till) lives in AuthFrame.
 */

function Envelope({ children, flapClass = 'sc-flap' }) {
  return (
    <div className="sc-env">
      <div className="sc-env-back" />
      {children}
      <div className="sc-env-front" />
      <div className={flapClass} />
    </div>
  )
}

function Mail() {
  return (
    <div className="sc sc-mail">
      <Envelope>
        <div className="sc-letter">
          <i style={{ width: '62%' }} /><i style={{ width: '88%' }} /><i style={{ width: '74%' }} />
          <b>Choose a new password</b>
        </div>
      </Envelope>
    </div>
  )
}

function Sent() {
  return (
    <div className="sc sc-sent">
      <div className="sc-float">
        <Envelope flapClass="sc-flap sc-flap-shut" />
        <span className="sc-ring" />
        <span className="sc-badge">
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
      </div>
    </div>
  )
}

function Shop() {
  return (
    <div className="sc sc-shop">
      <div className="sc-awning" />
      <div className="sc-front">
        <div className="sc-window">
          <span className="sc-glow" />
          <span className="sc-open">Open</span>
          <span className="sc-till" />
          <span className="sc-shutter" />
        </div>
        <span className="sc-door" />
      </div>
    </div>
  )
}

function Lock({ shut = false }) {
  return (
    <div className={`sc sc-lock${shut ? ' sc-lock-shut' : ''}`}>
      <div className="sc-padlock">
        <span className="sc-shackle" />
        <span className="sc-body"><span className="sc-hole" /></span>
        {!shut && <span className="sc-key"><span className="sc-key-bow" /><span className="sc-key-blade" /></span>}
      </div>
    </div>
  )
}

export default function Scene({ kind }) {
  return (
    <div className="af-stage af-stage-scene" aria-hidden="true">
      <style>{CSS}</style>
      {kind === 'mail' && <Mail />}
      {kind === 'sent' && <Sent />}
      {kind === 'shop' && <Shop />}
      {kind === 'lock' && <Lock />}
      {kind === 'shut' && <Lock shut />}
    </div>
  )
}

const CSS = `
.sc { position: relative; width: 260px; height: 230px; display: grid; place-items: center; }

/* ---- envelope ---- */
.sc-env { position: relative; width: 220px; height: 138px; margin-top: 54px; }
.sc-env-back { position: absolute; inset: 0; border-radius: 10px; background: #dfe6d9; }
.sc-env-front { position: absolute; inset: 0; z-index: 3; border-radius: 10px; background: #f4f7f0;
  clip-path: polygon(0 0, 50% 54%, 100% 0, 100% 100%, 0 100%); }
.sc-flap { position: absolute; left: 0; right: 0; top: 0; height: 80px; z-index: 1; background: #e8eee3; border-radius: 10px 10px 0 0;
  clip-path: polygon(0 0, 100% 0, 50% 100%); transform-origin: top; transform: perspective(500px) rotateX(180deg); }
.sc-flap-shut { z-index: 4; transform: none; background: #e3eadd; }
.sc-letter { position: absolute; left: 16px; right: 16px; top: -40px; height: 118px; z-index: 2; padding: 14px 14px 0; border-radius: 6px;
  background: #fffdf6; display: grid; align-content: start; gap: 7px; box-shadow: 0 6px 14px -8px rgba(0,0,0,.35); }
.sc-letter i { display: block; height: 6px; border-radius: 3px; background: #d5dbd1; }
.sc-letter b { justify-self: start; margin-top: 4px; padding: 6px 10px; border-radius: 6px; background: var(--brand-deep); color: #fff;
  font: 700 10.5px/1 system-ui, sans-serif; white-space: nowrap; }

.sc-mail .sc-env { animation: sc-fly 7s cubic-bezier(.45,0,.3,1) infinite; }
.sc-mail .sc-letter { animation: sc-letter 7s ease-in-out infinite; }
.sc-mail .sc-flap { animation: sc-flap 7s ease-in-out infinite; }
@keyframes sc-letter {
  0%        { transform: translateY(-30px); opacity: 0; }
  7%        { transform: translateY(-30px); opacity: 1; }
  30%, 64%  { transform: translateY(40px); opacity: 1; }
  65%, 100% { transform: translateY(-30px); opacity: 0; }
}
@keyframes sc-flap {
  0%, 32%   { transform: perspective(500px) rotateX(180deg); z-index: 1; }
  33%       { transform: perspective(500px) rotateX(180deg); z-index: 5; }
  42%, 64%  { transform: perspective(500px) rotateX(0deg); z-index: 5; }
  65%, 100% { transform: perspective(500px) rotateX(180deg); z-index: 1; }
}
@keyframes sc-fly {
  0%, 46%   { transform: none; opacity: 1; }
  50%       { transform: scale(1.04); opacity: 1; }
  64%       { transform: translate(170px, -110px) rotate(-14deg) scale(.5); opacity: 0; }
  65%       { transform: translateY(18px); opacity: 0; }
  80%, 100% { transform: none; opacity: 1; }
}

/* ---- sent ---- */
.sc-float { position: relative; animation: sc-float 3.2s ease-in-out infinite alternate; }
.sc-sent .sc-env { margin-top: 0; }
.sc-badge { position: absolute; right: -14px; top: -20px; z-index: 6; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center;
  background: var(--brand); box-shadow: 0 8px 20px -6px rgba(0,0,0,.45); animation: sc-pop .55s .25s cubic-bezier(.3,1.6,.5,1) both; }
.sc-badge path { fill: none; stroke: var(--brand-deep); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 24; stroke-dashoffset: 24; animation: sc-draw .45s .7s ease-out forwards; }
.sc-ring { position: absolute; right: -14px; top: -20px; z-index: 5; width: 52px; height: 52px; border-radius: 50%; border: 2px solid var(--brand);
  opacity: 0; animation: sc-ring 2.6s 1.2s ease-out infinite; }
@keyframes sc-float { from { transform: translateY(-4px); } to { transform: translateY(5px); } }
@keyframes sc-pop { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes sc-draw { to { stroke-dashoffset: 0; } }
@keyframes sc-ring { 0% { transform: scale(1); opacity: .9; } 100% { transform: scale(2.3); opacity: 0; } }

/* ---- shop ---- */
.sc-shop { align-content: center; gap: 0; }
.sc-awning { width: 250px; height: 34px; border-radius: 8px 8px 3px 3px; position: relative; z-index: 1;
  background: repeating-linear-gradient(90deg, var(--brand) 0 25px, #fffdf6 25px 50px); box-shadow: 0 8px 12px -8px rgba(0,0,0,.5); }
.sc-front { width: 232px; height: 168px; padding: 16px 14px 0; background: #e6ece1; border-radius: 0 0 6px 6px;
  display: grid; grid-template-columns: 1fr 52px; gap: 12px; align-items: end; }
.sc-window { position: relative; height: 112px; align-self: start; border-radius: 6px; overflow: hidden; background: #0b2a10;
  border: 4px solid #cfd8ca; }
.sc-glow { position: absolute; inset: 0; background: radial-gradient(80% 90% at 50% 30%, rgba(166,217,43,.45), transparent 70%); opacity: 0;
  animation: sc-sign 8s linear infinite; }
.sc-open { position: absolute; left: 50%; top: 22px; transform: translateX(-50%); padding: 3px 12px 4px; border: 2px solid var(--brand); border-radius: 999px;
  color: var(--brand); font: 800 17px/1 system-ui, sans-serif; letter-spacing: .02em;
  text-shadow: 0 0 8px var(--brand); box-shadow: 0 0 12px rgba(166,217,43,.6), inset 0 0 8px rgba(166,217,43,.4); opacity: 0;
  animation: sc-sign 8s linear infinite; }
.sc-till { position: absolute; left: 16px; right: 16px; bottom: 0; height: 22px; border-radius: 4px 4px 0 0; background: #164b1e; }
.sc-till::after { content: ''; position: absolute; right: 12px; top: -14px; width: 26px; height: 16px; border-radius: 3px; background: #2b6b33; }
.sc-shutter { position: absolute; inset: 0; z-index: 2; background: repeating-linear-gradient(#cfd6cc 0 8px, #aeb8aa 8px 10px);
  animation: sc-shutter 8s cubic-bezier(.5,0,.3,1) infinite; }
.sc-door { height: 140px; border-radius: 4px 4px 0 0; background: #2f6a36; border: 4px solid #cfd8ca; border-bottom: 0; position: relative; }
.sc-door::after { content: ''; position: absolute; left: 8px; top: 64px; width: 6px; height: 6px; border-radius: 50%; background: var(--brand); }
@keyframes sc-shutter {
  0%, 8%    { transform: translateY(0); }
  34%, 84%  { transform: translateY(-100%); }
  96%, 100% { transform: translateY(0); }
}
@keyframes sc-sign {
  0%, 34%   { opacity: 0; }
  36%       { opacity: 1; }
  38%       { opacity: .25; }
  41%, 84%  { opacity: 1; }
  88%, 100% { opacity: 0; }
}

/* ---- lock ---- */
.sc-padlock { position: relative; width: 150px; height: 190px; }
.sc-shackle { position: absolute; left: 31px; top: 6px; width: 88px; height: 92px; border: 15px solid #cfd8ca; border-bottom: 0; border-radius: 44px 44px 0 0;
  animation: sc-shackle 6s cubic-bezier(.3,1.5,.5,1) infinite; }
.sc-body { position: absolute; left: 0; right: 0; bottom: 0; height: 112px; border-radius: 20px; display: grid; place-items: center;
  background: linear-gradient(#eef2ea, #c7d0c2); box-shadow: 0 16px 30px -14px rgba(0,0,0,.6), inset 0 1px 0 #fff;
  animation: sc-unlocked 6s ease-in-out infinite; }
.sc-hole { position: relative; width: 20px; height: 20px; border-radius: 50%; background: #10301a; margin-bottom: 12px; }
.sc-hole::after { content: ''; position: absolute; left: 6px; top: 14px; width: 8px; height: 18px; border-radius: 0 0 4px 4px; background: #10301a; }
.sc-key { position: absolute; left: 75px; top: 118px; width: 0; height: 0; animation: sc-key 6s cubic-bezier(.4,0,.2,1) infinite; }
.sc-key-bow { position: absolute; left: -2px; top: -15px; width: 30px; height: 30px; border-radius: 50%; border: 7px solid var(--brand); box-sizing: border-box;
  box-shadow: 0 4px 10px rgba(0,0,0,.35); }
.sc-key-blade { position: absolute; left: -30px; top: -4px; width: 30px; height: 8px; border-radius: 3px; background: var(--brand); }
.sc-key-blade::after { content: ''; position: absolute; left: 4px; top: 6px; width: 7px; height: 7px; background: var(--brand); }
@keyframes sc-key {
  0%        { transform: translate(70px, 50px) rotate(0); opacity: 0; }
  10%       { transform: translate(70px, 50px) rotate(0); opacity: 1; }
  30%       { transform: translate(0, 0) rotate(0); opacity: 1; }
  42%, 80%  { transform: translate(0, 0) rotate(90deg); opacity: 1; }
  90%, 100% { transform: translate(0, 0) rotate(90deg); opacity: 0; }
}
@keyframes sc-shackle {
  0%, 44%   { transform: translateY(0); }
  52%, 84%  { transform: translateY(-36px); }
  94%, 100% { transform: translateY(0); }
}
@keyframes sc-unlocked {
  0%, 46%   { box-shadow: 0 16px 30px -14px rgba(0,0,0,.6), inset 0 1px 0 #fff; }
  54%, 84%  { box-shadow: 0 16px 30px -14px rgba(0,0,0,.6), inset 0 1px 0 #fff, 0 0 0 4px rgba(166,217,43,.7), 0 0 34px rgba(166,217,43,.45); }
  94%, 100% { box-shadow: 0 16px 30px -14px rgba(0,0,0,.6), inset 0 1px 0 #fff; }
}
.sc-lock-shut .sc-shackle, .sc-lock-shut .sc-body { animation: none; }
.sc-lock-shut .sc-padlock { animation: sc-shake .6s .4s ease-in-out both; }
@keyframes sc-shake { 0%, 100% { transform: none; } 20% { transform: rotate(-7deg); } 45% { transform: rotate(6deg); } 70% { transform: rotate(-3deg); } }

@media (prefers-reduced-motion: reduce) {
  .sc *, .sc, .sc-float { animation: none !important; }
  .sc-mail .sc-letter { transform: translateY(40px); }
  .sc-badge path { stroke-dashoffset: 0; }
  .sc-shutter { transform: translateY(-100%); }
  .sc-open, .sc-glow { opacity: 1; }
  .sc-shackle { transform: translateY(-36px); }
  .sc-key { transform: rotate(90deg); }
}
`
