import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import storageService from '../services/storage'
import { apiClient } from '../services/api'

const TASK_LABELS = {
  limpiafondo: 'Pasado de limpiafondo',
  cepillado: 'Cepillado de paredes y fondo',
  superficie: 'Limpieza de superficie (hojas)',
  canastos: 'Limpieza de canastos y skimmer',
  retrolavado: 'Retrolavado y enjuague del filtro',
}

function parseTareas(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

function parseQuimicos(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

function formatFechaLarga(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function buildWhatsAppText(visita, tareas, quim, fotos, tecnico) {
  const q = quim || {}
  const quimLineas = [
    q.cloroGranulado ? `• Cloro granulado: ${q.cloroGranulado}g` : '',
    q.cloroLiquido ? `• Cloro líquido: ${q.cloroLiquido}ml` : '',
    q.phMas ? `• pH+: ${q.phMas}g` : '',
    q.phMenos ? `• pH−: ${q.phMenos}ml` : '',
    q.algicida ? `• Algicida: ${q.algicida}ml` : '',
    q.floculante ? `• Floculante: ${q.floculante}ml` : '',
    q.otros ? `• ${q.otros}` : '',
  ].filter(Boolean).join('\n')

  const tareasLineas = tareas.map(t => `• ${TASK_LABELS[t] || t}`).join('\n')

  return `🏊 *REPORTE DE VISITA*
================
*Cliente:* ${visita.cliente_nombre || visita.nombre || ''}
*Dirección:* ${visita.cliente_direccion || visita.direccion || ''}
*Fecha:* ${formatFechaLarga(visita.fecha)}

✅ *TAREAS REALIZADAS*
${tareasLineas || '• No registradas'}

📊 *MEDICIONES DEL AGUA*
• Cloro: ${visita.cloro_ppm ?? '-'} ppm
• pH: ${visita.ph ?? '-'}

🧪 *QUÍMICOS APLICADOS*
${quimLineas || '• Sin registro'}

📝 *OBSERVACIONES*
${visita.observaciones || 'Sin observaciones'}

${fotos.length > 0 ? `📷 ${fotos.length} foto(s) adjunta(s)` : ''}
— *${tecnico.nombre_tecnico}* · Mantenimiento de piscinas
📞 ${tecnico.telefono}`
}

export default function ReporteVisitaPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { visita, fotos: fotosState } = location.state || {}

  const [fotos, setFotos] = useState(fotosState || [])
  const [loadingFotos, setLoadingFotos] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [tecnico, setTecnico] = useState({ nombre_tecnico: 'Federico Tenca', telefono: '2323 545583' })

  useEffect(() => {
    apiClient.getConfiguracion().then(c => { if (c.nombre_tecnico) setTecnico(t => ({ ...t, ...c })) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!visita || fotos.length > 0 || !visita.id) return
    setLoadingFotos(true)

    // Run IndexedDB (mobile path) and API (desktop path) in parallel
    const idbPromise = storageService.initPromise
      .then(() => storageService.getFotosByVisita(visita.id))
      .catch(() => [])

    const apiPromise = apiClient.getFotosByVisita(visita.id)
      .then(apiFotos => (apiFotos || []).map(f => ({ ...f, data: f.ruta_archivo, type: f.tipo })))
      .catch(() => [])

    Promise.all([idbPromise, apiPromise])
      .then(([idbFotos, apiFotos]) => {
        if (idbFotos.length > 0) setFotos(idbFotos)
        else if (apiFotos.length > 0) setFotos(apiFotos)
      })
      .finally(() => setLoadingFotos(false))
  }, [])

  if (!visita) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No hay datos de visita.</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded">← Volver</button>
        </div>
      </div>
    )
  }

  const tareas = parseTareas(visita.tareas_realizadas)
  const quim = parseQuimicos(visita.quimicos_usados)
  const whatsappText = buildWhatsAppText(visita, tareas, quim, fotos, tecnico)
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`

  async function compartirWA() {
    setGenerandoPDF(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const element = document.getElementById('reporte-body')
      const nombre = (visita.cliente_nombre || visita.nombre || 'visita').replace(/\s+/g, '-')
      const filename = `PILETERO-${nombre}-${visita.fecha}.pdf`

      const opt = {
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.88 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' },
      }

      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob')
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' })

      if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: 'Reporte de visita PILETERO' })
      } else {
        // Desktop fallback: download the PDF
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Error generando PDF:', err)
      window.open(whatsappUrl, '_blank')
    } finally {
      setGenerandoPDF(false)
    }
  }

  function imprimirPDF() {
    window.print()
  }

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
          .print-page { max-width: 100%; padding: 0; }
        }
        @media screen {
          .print-page { max-width: 700px; margin: 0 auto; }
        }
      `}</style>

      {/* Action bar — hidden when printing */}
      <div className="no-print bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-600 font-medium">← Volver</button>
        <div className="flex-1" />
        <button
          onClick={compartirWA}
          disabled={generandoPDF}
          className={`flex items-center gap-2 text-white font-bold px-4 py-2 rounded-lg transition-colors ${generandoPDF ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {generandoPDF ? '⏳ Generando...' : '📤 Compartir PDF'}
        </button>
        <button
          onClick={imprimirPDF}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg"
        >
          🖨️ PDF
        </button>
      </div>

      {/* Report body */}
      <div id="reporte-body" className="print-page px-6 py-6">
        {/* Header */}
        <div className="border-b-2 border-blue-600 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-blue-700">🏊 PILETERO</h1>
              <p className="text-gray-500 text-sm">Sistema de mantenimiento de piscinas</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Informe de visita</p>
              <p className="text-lg font-bold text-gray-700">{formatFechaLarga(visita.fecha)}</p>
            </div>
          </div>
        </div>

        {/* Client info */}
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <h2 className="text-xs text-blue-500 uppercase tracking-wide font-bold mb-2">Cliente</h2>
          <p className="text-2xl font-black text-gray-900">{visita.cliente_nombre || visita.nombre}</p>
          {(visita.cliente_direccion || visita.direccion) && (
            <p className="text-gray-600 mt-1">📍 {visita.cliente_direccion || visita.direccion}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Measurements */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-3">📊 Mediciones del agua</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cloro</span>
                <span className="text-2xl font-black text-blue-700">{visita.cloro_ppm ?? '—'} <span className="text-sm font-normal text-gray-400">ppm</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">pH</span>
                <span className="text-2xl font-black text-blue-700">{visita.ph ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-3">✅ Tareas realizadas</h2>
            {tareas.length > 0 ? (
              <ul className="space-y-1">
                {tareas.map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-green-500 font-bold">✓</span>
                    {TASK_LABELS[t] || t}
                  </li>
                ))}
              </ul>
            ) : <p className="text-gray-400 text-sm">No registradas</p>}
          </div>
        </div>

        {/* Chemicals */}
        {quim && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <h2 className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-3">🧪 Químicos aplicados</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {quim.cloroGranulado > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Cloro granulado</span><strong>{quim.cloroGranulado} g</strong></div>}
              {quim.cloroLiquido > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Cloro líquido</span><strong>{quim.cloroLiquido} ml</strong></div>}
              {quim.phMas > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">pH+</span><strong>{quim.phMas} g</strong></div>}
              {quim.phMenos > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">pH−</span><strong>{quim.phMenos} ml</strong></div>}
              {quim.algicida > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Algicida</span><strong>{quim.algicida} ml</strong></div>}
              {quim.floculante > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Floculante</span><strong>{quim.floculante} ml</strong></div>}
              {quim.otros && <div className="flex justify-between text-sm col-span-2"><span className="text-gray-600">Otros</span><strong>{quim.otros}</strong></div>}
            </div>
          </div>
        )}

        {/* Observations */}
        {visita.observaciones && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <h2 className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-2">📝 Observaciones</h2>
            <p className="text-gray-700 text-sm leading-relaxed">{visita.observaciones}</p>
          </div>
        )}

        {/* Photos */}
        {loadingFotos && <p className="text-gray-400 text-sm mb-4">Cargando fotos...</p>}
        {fotos.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-3">📷 Fotos</h2>
            <div className="grid grid-cols-2 gap-4">
              {fotos.map((f, i) => {
                const tipoFoto = f.tipo || f.type
                return (
                  <div key={i} className="rounded-xl overflow-hidden border border-gray-200">
                    <img src={f.data || f.ruta_archivo} alt={tipoFoto} className="w-full object-cover" style={{ maxHeight: '180px' }} />
                    <p className="text-center text-xs text-gray-500 py-1 bg-gray-50">
                      {tipoFoto === 'antes' ? '📸 Antes' : tipoFoto === 'despues' ? '📸 Después' : tipoFoto}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-6 text-center text-xs text-gray-500">
          <p className="font-semibold text-gray-700">{tecnico.nombre_tecnico}</p>
          <p>Mantenimiento de piscinas · {tecnico.telefono}</p>
          <p className="text-gray-400 mt-1">Generado por PILETERO · {new Date().toLocaleDateString('es-AR')}</p>
        </div>
      </div>
    </>
  )
}
