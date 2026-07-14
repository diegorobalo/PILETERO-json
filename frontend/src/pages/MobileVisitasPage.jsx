import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import storageService from '../services/storage'

function formatFecha(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatHora(isoStr) {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function MobileVisitasPage() {
  const navigate = useNavigate()
  const [visitas, setVisitas] = useState([])
  const [clientes, setClientes] = useState({}) // { id: cliente }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [abriendo, setAbriendo] = useState(null) // visitaId que está cargando

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      setLoading(true)
      setError(null)

      const [todasVisitas, todosClientes] = await Promise.all([
        apiClient.getVisitas().catch(() => null),
        apiClient.getClientes().catch(() => null),
      ])

      // Fallback a IndexedDB si no hay conexión
      let visitasList = todasVisitas
      let clientesList = todosClientes

      if (!visitasList) {
        await storageService.initPromise
        visitasList = await storageService.getAllVisitas().catch(() => [])
        setError('Sin conexión — mostrando datos locales')
      }
      if (!clientesList) {
        await storageService.initPromise
        clientesList = await storageService.getAllClientes().catch(() => [])
      }

      // Índice de clientes por id
      const clientesMap = {}
      ;(clientesList || []).forEach(c => { clientesMap[c.id] = c })
      setClientes(clientesMap)

      // Ordenar más reciente primero
      const ordenadas = (visitasList || []).sort((a, b) => {
        if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha)
        return (b.id || 0) - (a.id || 0)
      })
      setVisitas(ordenadas)
    } catch {
      setError('No se pudieron cargar las visitas')
    } finally {
      setLoading(false)
    }
  }

  async function abrirVisita(visita) {
    setAbriendo(visita.id)
    try {
      // Enriquecer con datos del cliente si no los tiene
      const cliente = clientes[visita.cliente_id] || {}
      const visitaConCliente = {
        ...visita,
        cliente_nombre: visita.cliente_nombre || cliente.nombre || 'Cliente',
        cliente_direccion: visita.cliente_direccion || cliente.direccion || '',
      }
      navigate('/reporte', { state: { visita: visitaConCliente, fotos: [] } })
    } finally {
      setAbriendo(null)
    }
  }

  // Agrupar por fecha
  const porFecha = []
  let fechaActual = null
  visitas.forEach(v => {
    if (v.fecha !== fechaActual) {
      fechaActual = v.fecha
      porFecha.push({ fecha: v.fecha, items: [] })
    }
    porFecha[porFecha.length - 1].items.push(v)
  })

  return (
    <div className="min-h-screen bg-sky-50 pb-24">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 pt-5 pb-4">
        <h1 className="text-2xl font-black text-white tracking-tight">Historial de visitas</h1>
        <p className="text-sky-100 text-sm mt-0.5">Tocá una visita para ver el reporte</p>
      </div>

      <div className="p-4">
        {loading && (
          <p className="text-center text-gray-400 py-16">Cargando visitas...</p>
        )}

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
            <p className="text-yellow-800 text-sm">{error}</p>
          </div>
        )}

        {!loading && visitas.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500 font-medium">Sin visitas registradas aún</p>
          </div>
        )}

        {porFecha.map(({ fecha, items }) => (
          <div key={fecha} className="mb-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1 capitalize">
              {formatFecha(fecha)}
            </p>
            <div className="space-y-2">
              {items.map(visita => {
                const cliente = clientes[visita.cliente_id]
                const nombre = visita.cliente_nombre || cliente?.nombre || `Cliente #${visita.cliente_id}`
                const hora = formatHora(visita.hora_fin || visita.hora_inicio)
                const cargando = abriendo === visita.id
                return (
                  <button
                    key={visita.id}
                    onClick={() => abrirVisita(visita)}
                    disabled={!!abriendo}
                    className="w-full text-left bg-white rounded-2xl shadow-card px-4 py-3.5 active:scale-[0.97] transition-transform duration-[160ms] disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-gray-900 truncate">{nombre}</p>
                      {cargando ? (
                        <span className="text-xs text-sky-500 font-semibold flex-shrink-0">Abriendo...</span>
                      ) : (
                        <span className="text-xs text-gray-400 flex-shrink-0">{hora}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {visita.cloro_ppm != null && (
                        <span className="text-xs text-blue-600">🔵 Cl {visita.cloro_ppm} ppm</span>
                      )}
                      {visita.ph != null && (
                        <span className="text-xs text-green-600">🟢 pH {visita.ph}</span>
                      )}
                      {!visita.cloro_ppm && !visita.ph && (
                        <span className="text-xs text-gray-300">Sin mediciones</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
