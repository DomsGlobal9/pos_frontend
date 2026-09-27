import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Monitor, Smartphone, Camera, Printer, Circle } from 'lucide-react'
import { loadDevices, updateDevice, messageFor } from '../lib/api.js'
import { deviceId } from '../lib/device.js'

/**
 * WF-DEVICES-01. POS-DEV-001..004.
 *
 * Every browser the till has been opened in: where it is, who used it last, which version it runs,
 * what it can do, when it was last seen. Devices register themselves -- nothing to add by hand.
 *
 * Honest about printers: a browser cannot see paper or ink. What is shown is the paper width this
 * device prints for, and when it last printed.
 */
export default function Devices() {
  const { shop } = useOutletContext() ?? {}
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['devices'], queryFn: loadDevices, refetchInterval: 30_000 })
  const [editing, setEditing] = useState(null)

  async function save(id, body) {
    try {
      await updateDevice(id, body)
      toast.success('Saved.')
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setEditing(null)
    } catch (err) {
      toast.error(messageFor(err))
    }
  }

  if (isLoading) return <p style={s.page}>Loading…</p>
  if (isError) return <p style={{ ...s.page, color: 'var(--bad)' }}>{messageFor(error)}</p>

  const me = deviceId()

  return (
    <div style={s.page}>
      <h1 style={{ margin: 0 }}>Devices</h1>
      <p style={s.muted}>Every screen the till has been opened on. A device appears here by itself the first time it opens the till.</p>

      <ul style={s.list} className="card-list">
        {data.devices.map(d => {
          const phone = /Android|iPhone|iPad/.test(d.userAgent ?? '')
          return (
            <li key={d.id} style={s.row}>
              <span style={s.icon}>{phone ? <Smartphone size={18} aria-hidden="true" /> : <Monitor size={18} aria-hidden="true" />}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                <div style={s.title}>
                  {d.name}{d.id === me && <span className="chip brand">This device</span>}
                </div>
                <div style={s.muted}>
                  {d.counter ? d.counter.name : 'No counter'} · {d.lastUserName ?? 'Nobody yet'} · version {d.appVersion ?? '?'}
                </div>
                <div style={s.tags}>
                  <span className={`chip${d.online ? ' good' : ''}`}>
                    <Circle size={8} fill="currentColor" aria-hidden="true" /> {d.online ? 'Online' : `Last seen ${ago(d.lastSeenAt)}`}
                  </span>
                  <span className="chip"><Printer size={12} aria-hidden="true" /> {d.paperWidthMm} mm{d.lastPrintedAt ? ` · printed ${ago(d.lastPrintedAt)}` : ''}</span>
                  <span className="chip"><Camera size={12} aria-hidden="true" /> {d.capabilities?.camera ? 'Camera' : 'No camera'}</span>
                </div>
                {editing === d.id && data.mayManage && (
                  <Edit device={d} counters={shop?.counters ?? []} onSave={body => save(d.id, body)} onCancel={() => setEditing(null)} />
                )}
              </div>
              {data.mayManage && editing !== d.id && <button style={s.small} onClick={() => setEditing(d.id)}>Change</button>}
            </li>
          )
        })}
      </ul>
      {data.devices.length === 0 && <p style={s.muted}>No devices yet.</p>}
    </div>
  )
}

function Edit({ device, counters, onSave, onCancel }) {
  const [name, setName] = useState(device.name)
  const [counterId, setCounterId] = useState(device.counter?.id ?? '')
  const [paper, setPaper] = useState(device.paperWidthMm)
  return (
    <div style={s.edit}>
      <label style={s.label}>Name<input value={name} onChange={e => setName(e.target.value)} aria-label="Device name" /></label>
      <div style={s.chips} role="group" aria-label="Counter">
        {counters.map(c => (
          <button key={c.id} type="button" aria-pressed={counterId === c.id} style={s.small} onClick={() => setCounterId(c.id)}>{c.name}</button>
        ))}
      </div>
      <div style={s.chips} role="group" aria-label="Paper width">
        {[80, 58].map(w => <button key={w} type="button" aria-pressed={paper === w} style={s.small} onClick={() => setPaper(w)}>{w} mm paper</button>)}
      </div>
      <div style={s.chips}>
        <button style={s.primary} onClick={() => onSave({ name, counterId: counterId || null, paperWidthMm: paper })}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function ago(at) {
  const m = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  if (m < 60) return `${Math.max(m, 1)} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 860, alignContent: 'start' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid' },
  row: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)' },
  icon: { display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)', flex: 'none' },
  title: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, flexWrap: 'wrap' },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  edit: { display: 'grid', gap: 10, marginTop: 8, padding: 12, borderRadius: 12, background: 'var(--panel-soft)', border: '1px solid var(--line)' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  small: { minHeight: 38, padding: '0 12px', fontWeight: 500 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 }
}
