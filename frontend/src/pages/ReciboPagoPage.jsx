import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'

function formatFechaLarga(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMes(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function buildWhatsAppText(pago, cliente, tecnico) {
  return `🏊 *RECIBO DE PAGO - PILETERO*
================
*Cliente:* ${pago.cliente_nombre || cliente?.nombre || ''}
*Dirección:* ${pago.cliente_direccion || cliente?.direccion || ''}
*Fecha:* ${formatFechaLarga(pago.fecha)}

💰 *PAGO RECIBIDO*
• Monto: $${(pago.monto || 0).toLocaleString('es-AR')}
• Método: ${capitalize(pago.metodo_pago || 'efectivo')}
• Concepto: Abono mantenimiento de piscina — ${capitalize(formatMes(pago.fecha))}

✅ *PAGADO*
Recibo N° ${String(pago.id || '').padStart(4, '0')}

— *${tecnico.nombre_tecnico}* · Mantenimiento de piscinas
📞 ${tecnico.telefono}`
}

export default function ReciboPagoPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { pago, cliente } = location.state || {}
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [tecnico, setTecnico] = useState({ nombre_tecnico: 'Federico Tenca', telefono: '2323 545583' })

  useEffect(() => {
    apiClient.getConfiguracion().then(c => { if (c.nombre_tecnico) setTecnico(t => ({ ...t, ...c })) }).catch(() => {})
  }, [])

  if (!pago) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No hay datos de pago.</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 rounded">← Volver</button>
        </div>
      </div>
    )
  }

  const whatsappText = buildWhatsAppText(pago, cliente, tecnico)
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`
  const reciboNum = String(pago.id || '').padStart(4, '0')

  async function compartirPDF() {
    setGenerandoPDF(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const element = document.getElementById('recibo-body')
      const nombre = (pago.cliente_nombre || cliente?.nombre || 'cliente').replace(/\s+/g, '-')
      const filename = `PILETERO-Recibo-${nombre}-${pago.fecha}.pdf`
      const opt = {
        margin: [15, 15, 15, 15],
        filename,
        image: { type: 'jpeg', quality: 0.9 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' },
      }
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob')
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' })
      if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: 'Recibo de pago PILETERO' })
      } else {
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url; a.download = filename
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Error generando PDF:', err)
      window.open(whatsappUrl, '_blank')
    } finally { setGenerandoPDF(false) }
  }

  return (
    <>
      <style>{`
        @media print { .no-print { display: none !important; } }
        @media screen { .recibo-page { max-width: 600px; margin: 0 auto; } }
      `}</style>

      {/* Barra de acciones */}
      <div className="no-print bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-600 font-medium">← Volver</button>
        <div className="flex-1" />
        <button onClick={compartirPDF} disabled={generandoPDF}
          className={`flex items-center gap-2 text-white font-bold px-4 py-2 rounded-lg transition-colors ${generandoPDF ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}>
          {generandoPDF ? '⏳ Generando...' : '📤 Compartir PDF'}
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg">
          🖨️ Imprimir
        </button>
      </div>

      {/* Recibo */}
      <div id="recibo-body" className="recibo-page px-8 py-8">
        {/* Header */}
        <div className="border-b-2 border-blue-600 pb-5 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-blue-700">🏊 PILETERO</h1>
            <p className="text-gray-500 text-sm">Sistema de mantenimiento de piscinas</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Recibo de pago</p>
            <p className="text-2xl font-black text-gray-700">N° {reciboNum}</p>
            <p className="text-sm text-gray-500 mt-1">{formatFechaLarga(pago.fecha)}</p>
          </div>
        </div>

        {/* Cliente */}
        <div className="bg-blue-50 rounded-xl p-5 mb-6">
          <p className="text-xs text-blue-500 uppercase tracking-wide font-bold mb-2">Cliente</p>
          <p className="text-2xl font-black text-gray-900">{pago.cliente_nombre || cliente?.nombre}</p>
          {(pago.cliente_direccion || cliente?.direccion) && (
            <p className="text-gray-600 mt-1">📍 {pago.cliente_direccion || cliente?.direccion}</p>
          )}
        </div>

        {/* Concepto */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-3">Concepto</p>
          <p className="text-gray-700">Abono de mantenimiento de piscina</p>
          <p className="text-gray-500 text-sm mt-1">Período: {capitalize(formatMes(pago.fecha))}</p>
        </div>

        {/* Monto — protagonista */}
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mb-6 text-center">
          <p className="text-sm text-green-600 uppercase tracking-wide font-bold mb-2">Total pagado</p>
          <p className="text-5xl font-black text-green-700">${(pago.monto || 0).toLocaleString('es-AR')}</p>
          <p className="text-gray-500 mt-2">{capitalize(pago.metodo_pago || 'efectivo')}</p>
        </div>

        {/* Sello PAGADO */}
        <div className="flex justify-center mb-8">
          <div className="border-4 border-green-500 text-green-600 font-black text-3xl px-8 py-3 rounded-lg rotate-[-3deg] tracking-widest">
            ✅ PAGADO
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
          <p className="font-semibold text-gray-700">{tecnico.nombre_tecnico}</p>
          <p>Mantenimiento de piscinas · {tecnico.telefono}</p>
          <p className="text-gray-400 mt-1">Generado por PILETERO · {new Date().toLocaleDateString('es-AR')}</p>
        </div>
      </div>
    </>
  )
}
