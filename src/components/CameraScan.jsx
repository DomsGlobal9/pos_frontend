import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { X, Flashlight, Check, Undo2 } from 'lucide-react'
import useEscape from '../lib/useEscape.js'

/**
 * Scanning barcodes with the phone's own camera. POS-SELL-004.
 *
 * REDONE 25 Nov (owner: "it opens small, it is not instant, real selling it becomes a problem; even with text
 * in the scanning area it should scan fast"):
 *
 *   FULL SCREEN, the camera fills the phone; a wide aiming box shaped for a shelf barcode.
 *   ONLY THE BOX IS READ. Each frame is cropped to the box before reading: the price-tag text, the logo, a QR
 *     or a second barcode beside it are never looked at -- which is also what makes each try fast.
 *   ONLY SHOP BARCODES: EAN-13/8, UPC, Code 128, Code 39 (tags and the till's own labels). No QR.
 *   FAST: Android's own BarcodeDetector where the phone has it (the phone's chip does the work); else ZXing,
 *     tried every 60 ms on the cropped box (it used to wait 500 ms between tries and searched every format).
 *     The rear camera at 1280 x 720 with continuous focus; a torch button where the phone has one.
 *   KEEPS SCANNING: each code is added with a beep and a buzz, and the camera stays open for the next item.
 *     The same code held in view is not added twice (scan it again after moving away, or after 1.5 s). An item
 *     that needs a choice -- a size, a length of cloth -- closes the camera so the choice can be made.
 *
 * The camera is released the moment the sheet closes -- a phone left holding its camera is a phone whose
 * camera app will not open.
 *
 * `onCode(code)` answers { added: true, name, id } to keep scanning, { added: false, message } to say so and keep
 * scanning, or { close: true } to close (a choice is needed).
 *
 * UNDO (25 Nov, owner: "what if I scanned the wrong one?"): each add is remembered; Undo takes the last one back
 * off the bill (`onUndo(id)`), and again for the one before -- without leaving the camera.
 */
const FORMATS_NATIVE = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
const FORMATS_ZXING = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]
const EVERY_MS = 60
const SAME_CODE_MS = 1500
// The aiming box, as fractions of the visible picture: wide and short, as a barcode is.
const BOX = { left: 0.08, right: 0.92, top: 0.36, bottom: 0.6 }

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = beep.ctx ?? (beep.ctx = new Ctx())
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.frequency.value = 1760; g.gain.value = 0.08
    o.connect(g); g.connect(ctx.destination)
    o.start(); o.stop(ctx.currentTime + 0.08)
  } catch { /* no sound: the buzz and the line on screen still say it */ }
}

export default function CameraScan({ onCode, onClose, onUndo }) {
  useEscape(onClose)
  const video = useRef(null)
  const [problem, setProblem] = useState(null)
  const [torch, setTorch] = useState(null)        // null: this camera has none
  const [last, setLast] = useState(null)          // { text, ok }
  const [count, setCount] = useState(0)
  const [added, setAdded] = useState([])          // what this camera put on the bill, newest last: { id, name }
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const trackRef = useRef(null)

  useEffect(() => {
    let stopped = false
    let stream = null
    let timer = null
    let busy = false
    let lastCode = ''
    let lastAt = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let detector = null
    let reader = null

    // The part of the camera picture inside the aiming box, in the video's own pixels (object-fit: cover).
    function boxInVideo(v) {
      const vw = v.videoWidth, vh = v.videoHeight, ew = v.clientWidth, eh = v.clientHeight
      const scale = Math.max(ew / vw, eh / vh)
      const ox = (vw * scale - ew) / 2, oy = (vh * scale - eh) / 2
      const x = (BOX.left * ew + ox) / scale, y = (BOX.top * eh + oy) / scale
      const w = ((BOX.right - BOX.left) * ew) / scale, h = ((BOX.bottom - BOX.top) * eh) / scale
      return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(vw, w), h: Math.min(vh, h) }
    }

    async function readOnce() {
      const v = video.current
      if (!v || v.readyState < 2 || !v.videoWidth) return null
      const b = boxInVideo(v)
      // Only the box, at most 960 px wide: enough for a barcode's bars, and quick to read.
      const scale = Math.min(1, 960 / b.w)
      canvas.width = Math.round(b.w * scale); canvas.height = Math.round(b.h * scale)
      ctx.drawImage(v, b.x, b.y, b.w, b.h, 0, 0, canvas.width, canvas.height)
      if (detector) {
        const found = await detector.detect(canvas)
        return found[0]?.rawValue ?? null
      }
      try { return reader.decodeFromCanvas(canvas).getText() } catch { return null }
    }

    async function tick() {
      if (stopped) return
      if (!busy) {
        busy = true
        try {
          const code = (await readOnce())?.trim()
          const now = Date.now()
          if (code && !(code === lastCode && now - lastAt < SAME_CODE_MS)) {
            lastCode = code; lastAt = now
            if (navigator.vibrate) navigator.vibrate(50)
            beep()
            const answer = await onCodeRef.current(code)
            if (stopped) return
            if (answer?.close) { stopped = true; return }
            if (answer?.added) {
              setCount(c => c + 1)
              if (answer.id) setAdded(list => [...list, { id: answer.id, name: answer.name ?? code }])
              setLast({ text: answer.name ? `Added: ${answer.name}` : `Added ${code}`, ok: true })
            }
            else setLast({ text: answer?.message ?? `Nothing found for ${code}`, ok: false })
          } else if (code) lastAt = now   // still in view: keep it from being added again
        } catch { /* one bad frame is nothing: the next one is 60 ms away */ }
        busy = false
      }
      timer = setTimeout(tick, EVERY_MS)
    }

    async function start() {
      try {
        if ('BarcodeDetector' in window) {
          const supported = await window.BarcodeDetector.getSupportedFormats?.().catch(() => []) ?? []
          const use = FORMATS_NATIVE.filter(f => supported.includes(f))
          if (use.length) detector = new window.BarcodeDetector({ formats: use })
        }
        if (!detector) {
          const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, FORMATS_ZXING]])
          reader = new BrowserMultiFormatReader(hints)
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] }
        })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        const track = stream.getVideoTracks()[0]
        trackRef.current = track
        try { if (track.getCapabilities?.().torch) setTorch(false) } catch { /* no torch */ }
        video.current.srcObject = stream
        await video.current.play().catch(() => {})
        tick()
      } catch (err) {
        if (stopped) return
        const denied = err?.name === 'NotAllowedError'
        setProblem(denied
          ? 'The camera is blocked for this site. Allow it in the browser\'s settings, or type the code.'
          : 'No camera could be opened on this device. Type the code instead.')
      }
    }

    // Started one tick later and cancelled if torn down first: React (in development) sets an effect up, tears
    // it down and sets it up again, and a camera started at once could be stopped under the second run.
    const begin = setTimeout(start, 0)
    return () => {
      stopped = true
      clearTimeout(begin); clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
      trackRef.current = null
    }
  }, [])

  function undo() {
    const item = added[added.length - 1]
    if (!item) return
    onUndo?.(item.id)
    setAdded(list => list.slice(0, -1))
    setCount(c => Math.max(0, c - 1))
    setLast({ text: `Removed: ${item.name}`, ok: true })
    if (navigator.vibrate) navigator.vibrate([30, 40, 30])
  }

  async function toggleTorch() {
    const t = trackRef.current
    if (!t) return
    try { await t.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch) } catch { setTorch(null) }
  }

  return (
    <div style={s.screen} role="dialog" aria-label="Scan with camera">
      {problem ? (
        <div style={s.problemBox}>
          <p style={s.problem}>{problem}</p>
          <button type="button" onClick={onClose} style={s.done}>Close</button>
        </div>
      ) : (
        <>
          <video ref={video} style={s.video} muted playsInline autoPlay />
          {/* Everything outside the box is dimmed: only what is inside is read. */}
          <div style={s.box} aria-hidden="true"><span style={s.laser} className="scan-laser" /></div>
          <div style={s.top}>
            <b style={s.title}>Point at the barcode</b>
            <div style={{ display: 'flex', gap: 8 }}>
              {torch !== null && (
                <button type="button" onClick={toggleTorch} style={{ ...s.round, ...(torch ? s.roundOn : null) }} aria-label={torch ? 'Torch off' : 'Torch on'} aria-pressed={torch}>
                  <Flashlight size={20} aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={onClose} style={s.round} aria-label="Close camera"><X size={22} aria-hidden="true" /></button>
            </div>
          </div>
          <div style={s.bottom}>
            <div style={s.statusRow}>
              <p style={{ ...s.status, ...(last && !last.ok ? s.statusBad : null) }} role="status" aria-live="polite">
                {last ? last.text : 'Only the barcode inside the box is read. Keep scanning: each item is added.'}
              </p>
              {onUndo && added.length > 0 && (
                <button type="button" onClick={undo} style={s.undo} aria-label={`Undo: take ${added[added.length - 1].name} off the bill`}>
                  <Undo2 size={18} aria-hidden="true" /> Undo
                </button>
              )}
            </div>
            <button type="button" onClick={onClose} style={s.done}>
              <Check size={20} aria-hidden="true" /> Done{count ? ` · ${count} added` : ''}
            </button>
          </div>
          <style>{`
            .scan-laser { animation: scan-laser 1.6s ease-in-out infinite alternate; }
            @keyframes scan-laser { from { top: 12%; } to { top: 84%; } }
            @media (prefers-reduced-motion: reduce) { .scan-laser { animation: none; top: 50% !important; } }
          `}</style>
        </>
      )}
    </div>
  )
}

const s = {
  screen: { position: 'fixed', inset: 0, zIndex: 40, background: '#000', color: '#fff', overflow: 'hidden' },
  video: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  box: {
    position: 'absolute', left: `${BOX.left * 100}%`, right: `${(1 - BOX.right) * 100}%`, top: `${BOX.top * 100}%`, bottom: `${(1 - BOX.bottom) * 100}%`,
    border: '3px solid var(--brand)', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)'
  },
  laser: { position: 'absolute', left: 10, right: 10, height: 2, background: 'var(--brand)', boxShadow: '0 0 10px var(--brand)', borderRadius: 2 },
  top: {
    position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px', background: 'linear-gradient(rgba(0,0,0,.6), transparent)'
  },
  title: { fontSize: 17 },
  round: { minHeight: 46, minWidth: 46, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 999, background: 'rgba(255,255,255,.16)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', boxShadow: 'none' },
  roundOn: { background: 'var(--brand)', color: 'var(--brand-deep)', borderColor: 'var(--brand)' },
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, display: 'grid', gap: 12, justifyItems: 'center',
    padding: '20px 16px calc(18px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(transparent, rgba(0,0,0,.75))'
  },
  statusRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: 'min(420px, 100%)', minHeight: 44 },
  status: { margin: 0, textAlign: 'center', fontSize: 15, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  undo: { flex: 'none', minHeight: 44, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, fontWeight: 700, fontSize: 15, background: 'rgba(255,255,255,.16)', color: '#fff', border: '1px solid rgba(255,255,255,.35)', boxShadow: 'none' },
  statusBad: { color: '#ffb4a8' },
  done: { minHeight: 52, width: 'min(420px, 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 700, borderRadius: 14, background: 'var(--brand)', color: 'var(--brand-deep)', border: 'none' },
  problemBox: { position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', gap: 16, padding: 24, textAlign: 'center' },
  problem: { margin: 0, fontSize: 16, maxWidth: 360 }
}
