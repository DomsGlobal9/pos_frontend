import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X } from 'lucide-react'
import useEscape from '../lib/useEscape.js'

/**
 * Scanning a barcode with the phone's own camera. POS-SELL-004.
 *
 * For the salesperson walking the floor with a phone, not the counter: a USB scanner is still the
 * fast path there, and CHG-002 says so -- this makes no 150 ms promise. It reads the same barcodes
 * the scanner does (EAN-13 on a saree's tag, Code 128 on a shelf label) and hands the code to the
 * same search, so a camera scan and a scanner scan end up in exactly the same place.
 *
 * ZXing rather than the browser's own BarcodeDetector: that one is missing on Windows and on most
 * desktop browsers, and a feature that works on some phones only is a support call.
 *
 * The camera is released the moment a code is read or the sheet closes -- a phone left holding its
 * camera is a phone whose camera app will not open.
 */
export default function CameraScan({ onCode, onClose }) {
  useEscape(onClose)
  const video = useRef(null)
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls = null
    let done = false

    // Started one tick later, and cancelled if this effect is torn down first. React (in
    // development) sets an effect up, tears it down and sets it up again; starting the camera
    // straight away let the first run's stop() clear the video the second run had just attached --
    // a black box that never scans. Found by the fake-camera test.
    const start = setTimeout(() => {
    reader.decodeFromVideoDevice(undefined, video.current, (result, _error, ctl) => {
      controls = ctl
      if (result && !done) {
        done = true
        ctl.stop()
        if (navigator.vibrate) navigator.vibrate(60)
        onCode(result.getText())
      }
    })
      .then(ctl => { controls = ctl; if (done) ctl.stop() })
      .catch(err => {
        const denied = err?.name === 'NotAllowedError'
        setProblem(denied
          ? 'The camera is blocked for this site. Allow it in the browser\'s settings, or type the code.'
          : 'No camera could be opened on this device. Type the code instead.')
      })
    }, 0)

    return () => { clearTimeout(start); done = true; controls?.stop() }
  }, [onCode])

  return (
    <div style={s.backdrop} role="dialog" aria-label="Scan with camera">
      <div style={s.sheet}>
        <div style={s.head}>
          <b>Point the camera at the barcode</b>
          <button onClick={onClose} style={s.close} aria-label="Close camera"><X size={18} /></button>
        </div>
        {problem
          ? <p style={s.problem}>{problem}</p>
          : (
            <div style={s.frame}>
              <video ref={video} style={s.video} muted playsInline />
              <div style={s.guide} aria-hidden="true" />
            </div>
          )}
        <p style={s.muted}>It adds the item as soon as it reads the code.</p>
      </div>
    </div>
  )
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(16,24,14,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 20 },
  sheet: { background: 'var(--panel)', borderRadius: 20, boxShadow: 'var(--shadow-lift)', padding: 18, width: 460, maxWidth: '100%', display: 'grid', gap: 12 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  close: { minHeight: 40, minWidth: 40, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 999 },
  frame: { position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  guide: { position: 'absolute', left: '12%', right: '12%', top: '35%', bottom: '35%', border: '3px solid var(--brand)', borderRadius: 12, boxShadow: '0 0 0 999px rgba(0,0,0,0.25)' },
  problem: { margin: 0, color: 'var(--bad)' },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 13 }
}
