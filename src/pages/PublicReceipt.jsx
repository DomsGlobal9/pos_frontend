import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { loadPublicReceipt, messageFor } from '../lib/api.js'
import Receipt from '../components/Receipt.jsx'

/**
 * The customer's digital receipt. POS-RCPT-009.
 *
 * Reached from the QR on the paper, or the link in the WhatsApp message. Outside the till's shell:
 * no navigation, no sign-in -- the token in the address is the permission, as the paper is. The same
 * Receipt component as the till, so the online copy says exactly what the paper says.
 */
export default function PublicReceipt() {
  const { token } = useParams()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-receipt', token],
    queryFn: () => loadPublicReceipt(token),
    retry: false
  })

  if (isLoading) return <p style={s.state}>Opening your bill…</p>
  if (isError) {
    return (
      <div style={s.state}>
        <b>This bill could not be opened.</b>
        <p style={{ margin: 0 }}>{messageFor(error)}</p>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <Receipt sale={data} publicView pdfHref={`${import.meta.env.VITE_API_BASE || '/api/v1'}/public/receipts/${token}/pdf`} />
      <p style={s.foot} className="no-print">Your bill from {data.shop?.shopName ?? 'the shop'}. Keep this link to see it again.</p>
    </div>
  )
}

const s = {
  page: { minHeight: '100%', background: 'var(--bg)' },
  state: { padding: 24, display: 'grid', gap: 8, maxWidth: 480, margin: '0 auto' },
  foot: { textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13, padding: '0 16px 24px', margin: 0 }
}
