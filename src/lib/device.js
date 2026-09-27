import { api } from './api.js'
import { pendingSummary } from './outbox.js'

/**
 * This device, as the till knows it. POS-DEV-001..004.
 *
 * A random id kept in local storage is the device's identity -- nothing to type, nothing to pair.
 * Storage can be blocked (a private window, strict site settings); then the id lives for this tab
 * only, and the till still works -- a device list that misses a private window is fine, a till that
 * will not open because it could not save an id is not.
 */
const KEY = 'pos.device.v1'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private window: this tab only */ }
}

let memo = read()
if (!memo?.id) {
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '')
  memo = { id: `d-${id}`, paperWidthMm: 80 }
  write(memo)
}

export const deviceId = () => memo.id
/** The paper this device prints on. Set by a manager on the Devices screen; 80 mm until then. */
export const paperWidthMm = () => memo.paperWidthMm ?? 80

/** What this browser can do, in the plain terms the Devices screen shows. */
export function capabilities() {
  const hasCamera = !!navigator.mediaDevices?.getUserMedia
  return {
    camera: hasCamera,
    cameraScan: hasCamera,
    touch: (navigator.maxTouchPoints ?? 0) > 0,
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`
  }
}

function guessName() {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'device'
  return `${browser} on ${os}`
}

/** Check in. Never throws: a device list that is a minute stale must never stop a sale. */
export async function checkIn({ printed = false } = {}) {
  try {
    const { data } = await api.post('/devices/heartbeat', {
      deviceId: memo.id,
      name: guessName(),
      appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined,
      userAgent: navigator.userAgent.slice(0, 300),
      capabilities: capabilities(),
      // What this till is holding that the server has not got. The day close adds these up.
      pending: pendingSummary(),
      ...(printed ? { printed: true } : {})
    })
    const d = data?.data
    if (d?.paperWidthMm && d.paperWidthMm !== memo.paperWidthMm) {
      memo = { ...memo, paperWidthMm: d.paperWidthMm }
      write(memo)
    }
  } catch { /* the next check-in will do */ }
}
