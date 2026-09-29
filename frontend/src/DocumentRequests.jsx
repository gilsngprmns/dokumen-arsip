import { useEffect, useMemo, useState } from 'react'
import api from './api'
import './DocumentRequests.css'

const statusLabels = { requested: 'Requested', processed: 'Processed', completed: 'Completed' }
const dateLabel = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'

function StatusTimeline({ status }) {
  const statuses = ['requested', 'processed', 'completed']
  const currentIndex = statuses.indexOf(status)
  return <div className="request-timeline">{statuses.map((item, index) => <div className={`request-step ${index <= currentIndex ? 'done' : ''} ${item === status ? 'current' : ''}`} key={item}><span>{index < currentIndex ? '✓' : index + 1}</span><small>{statusLabels[item]}</small></div>)}</div>
}

export default function DocumentRequests({ user }) {
  const [requests, setRequests] = useState([])
  const [sections, setSections] = useState([])
  const [documents, setDocuments] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [processTarget, setProcessTarget] = useState(null)
  const [form, setForm] = useState({ target_seksi_id: '', judul_permintaan: '', detail_permintaan: '' })
  const [processForm, setProcessForm] = useState({ dokumen_id: '', response_note: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [requestResponse, sectionResponse, documentResponse] = await Promise.all([api.get('/document-requests'), api.get('/seksi'), api.get('/dokumen', { params: { limit: 100 } })])
      setRequests(requestResponse.data.data || [])
      setSections(sectionResponse.data.data || [])
      setDocuments(documentResponse.data.data || [])
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Permintaan dokumen belum dapat dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const availableSections = useMemo(() => sections.filter((section) => String(section.id) !== String(user.seksi_id)), [sections, user.seksi_id])
  const submitRequest = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/document-requests', form)
      setForm({ target_seksi_id: '', judul_permintaan: '', detail_permintaan: '' })
      setShowForm(false)
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Permintaan belum dapat dibuat.')
    } finally {
      setSaving(false)
    }
  }

  const processRequest = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.patch(`/document-requests/${processTarget.id}/process`, processForm)
      setProcessTarget(null)
      setProcessForm({ dokumen_id: '', response_note: '' })
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Permintaan belum dapat diproses.')
    } finally {
      setSaving(false)
    }
  }

  const completeRequest = async (request) => {
    setSaving(true)
    setError('')
    try {
      await api.patch(`/document-requests/${request.id}/complete`)
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Permintaan belum dapat diselesaikan.')
    } finally {
      setSaving(false)
    }
  }

  const canProcess = (request) => user.role === 'admin' || String(request.target_seksi_id) === String(user.seksi_id)
  const canComplete = (request) => user.role === 'admin' || request.requested_by === user.id

  return <section className="request-page">
    <div className="request-heading"><div><p className="eyebrow">Koordinasi antar-seksi</p><h1>Permintaan dokumen</h1><p className="subheading">Minta berkas dari seksi lain dan pantau penyelesaiannya dalam satu alur.</p></div><button className="primary-button" onClick={() => setShowForm(true)}>＋ Buat permintaan</button></div>
    {error && <div className="alert error">{error}<button onClick={loadData}>Coba lagi</button></div>}
    <div className="request-summary"><div><strong>{requests.length}</strong><span>Total permintaan</span></div><div><strong>{requests.filter((item) => item.status === 'requested').length}</strong><span>Menunggu diproses</span></div><div><strong>{requests.filter((item) => item.status === 'processed').length}</strong><span>Menunggu konfirmasi</span></div></div>
    <section className="request-list">{loading ? <div className="request-empty">Memuat permintaan...</div> : requests.length ? requests.map((request) => <article className="request-card" key={request.id}><div className="request-card-top"><div><span className={`request-status ${request.status}`}>{statusLabels[request.status]}</span><h2>{request.judul_permintaan}</h2><p>{request.requester_name} · {request.requester_section} → {request.target_section}</p></div><small>{dateLabel(request.created_at)}</small></div><StatusTimeline status={request.status} />{request.detail_permintaan && <p className="request-detail">{request.detail_permintaan}</p>}{request.dokumen_id && <div className="request-document">Dokumen tersedia: <strong>{request.nomor_dokumen ? `${request.nomor_dokumen} · ` : ''}{request.dokumen_judul}</strong></div>}{request.response_note && <div className="request-response"><strong>Catatan seksi tujuan</strong><span>{request.response_note}</span></div>}<div className="request-meta"><span>{request.status === 'requested' ? 'Menunggu tanggapan seksi tujuan' : request.status === 'processed' ? `Diproses oleh ${request.processor_name || 'petugas'}` : `Selesai ${dateLabel(request.completed_at)}`}</span><div>{canProcess(request) && request.status === 'requested' && <button className="secondary-button" onClick={() => { setProcessTarget(request); setProcessForm({ dokumen_id: '', response_note: '' }) }}>Proses permintaan</button>}{canComplete(request) && request.status === 'processed' && <button className="primary-button" disabled={saving} onClick={() => completeRequest(request)}>Tandai selesai</button>}</div></div></article>) : <div className="request-empty"><strong>Belum ada permintaan dokumen</strong><span>Ajukan permintaan ke seksi lain untuk memulai koordinasi.</span></div>}</section>
    {showForm && <div className="modal-backdrop"><section className="modal request-modal"><button className="modal-close" onClick={() => setShowForm(false)}>×</button><p className="eyebrow">Request dokumen</p><h2>Ajukan permintaan baru</h2><p className="modal-intro">Permintaan akan diteruskan ke petugas pada seksi tujuan.</p><form className="admin-form" onSubmit={submitRequest}><label>Seksi tujuan<select required value={form.target_seksi_id} onChange={(event) => setForm({ ...form, target_seksi_id: event.target.value })}><option value="">Pilih seksi tujuan</option>{availableSections.map((section) => <option key={section.id} value={section.id}>{section.nama_seksi}</option>)}</select></label><label>Judul atau jenis dokumen<input required value={form.judul_permintaan} onChange={(event) => setForm({ ...form, judul_permintaan: event.target.value })} placeholder="Contoh: Data penerima bantuan 2025" /></label><label>Keperluan atau rincian<textarea rows="4" value={form.detail_permintaan} onChange={(event) => setForm({ ...form, detail_permintaan: event.target.value })} placeholder="Jelaskan berkas yang dibutuhkan dan keperluannya" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Mengirim...' : 'Kirim permintaan'}</button></div></form></section></div>}
    {processTarget && <div className="modal-backdrop"><section className="modal request-modal"><button className="modal-close" onClick={() => setProcessTarget(null)}>×</button><p className="eyebrow">Tindak lanjut request</p><h2>Proses permintaan</h2><p className="modal-intro">{processTarget.judul_permintaan}</p><form className="admin-form" onSubmit={processRequest}><label>Dokumen yang tersedia<select value={processForm.dokumen_id} onChange={(event) => setProcessForm({ ...processForm, dokumen_id: event.target.value })}><option value="">Belum melampirkan dokumen</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.nomor_dokumen} · {document.judul}</option>)}</select></label><label>Catatan untuk peminta<textarea rows="4" value={processForm.response_note} onChange={(event) => setProcessForm({ ...processForm, response_note: event.target.value })} placeholder="Contoh: Berkas tersedia dan dapat digunakan." /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setProcessTarget(null)}>Batal</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Menyimpan...' : 'Tandai processed'}</button></div></form></section></div>}
  </section>
}
