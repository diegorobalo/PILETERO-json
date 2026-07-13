import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import storageService from '../services/storage'
import ClientForm from '../components/ClientForm'
import { toastSuccess, toastError, toastOffline } from '../utils/toast'

function parseQuimicos(raw) {
  if (!raw) return []
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw }
  catch { return [] }
}

function formatFecha(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function MobileClientesPage() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [historial, setHistorial] = useState(null)
  const [showConsumo, setShowConsumo] = useState(false)
  const [consumoMes, setConsumoMes] = useState(new Date().toISOString().slice(0, 7))
  const [consumoData, setConsumoData] = useState(null)
  const [consumoLoading, setConsumoLoading] = useState(false)

  async function verHistorial(cliente) {
    setHistorial({ cliente, visitas: [], pagos: [], loading: true, tab: 'insumos' })
    try {
      const [visitas, pagos] = await Promise.all([
        apiClient.getVisitasByCliente(cliente.id).catch(() => []),
        apiClient.getPagosByCliente(cliente.id).catch(() => []),
      ])
      const visitasOrd = visitas.sort((a, b) => b.fecha.localeCompare(a.fecha))
      const pagosOrd = pagos.sort((a, b) => b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes)
      setHistorial(h => ({ ...h, visitas: visitasOrd, pagos: pagosOrd, loading: false }))
    } catch {
      setHistorial(h => ({ ...h, loading: false, error: 'No se pudo cargar el historial' }))
    }
  }

  async function cargarConsumo(mes, listaClientes) {
    setConsumoLoading(true)
    setConsumoData(null)
    try {
      const [todasVisitas, inventario] = await Promise.all([
        apiClient.getVisitas(),
        apiClient.getInventario(),
      ])
      const clientesTodoInc = listaClientes.filter(c =>
        c.tipo_abono === 'todo_incluido'
      )
      const result = clientesTodoInc.map(cliente => {
        const visitasMes = todasVisitas.filter(v =>
          v.cliente_id === cliente.id && v.fecha?.startsWith(mes)
        )
        const productMap = {}
        for (const v of visitasMes) {
          try {
            const quimicos = Array.isArray(v.quimicos_usados)
              ? v.quimicos_usados : JSON.parse(v.quimicos_usados || '[]')
            for (const q of quimicos) {
              const nombre = q.nombre || q.name || 'Desconocido'
              const cantidad = parseFloat(q.cantidad_usada ?? q.cantidad ?? 0)
              if (!productMap[nombre]) productMap[nombre] = { nombre, cantidad: 0, unidad: q.unidad || '' }
              productMap[nombre].cantidad += cantidad
            }
          } catch {}
        }
        const productos = Object.values(productMap).map(p => {
          const inv = inventario.find(i => i.nombre.toLowerCase() === p.nombre.toLowerCase())
          let costo = null
          if (inv?.precio_unitario) {
            // precio_unitario se ingresa por kg (si unidad='g') o por litro (si unidad='ml')
            const divisor = (p.unidad === 'g' || p.unidad === 'ml') ? 1000 : 1
            costo = Math.round(p.cantidad * inv.precio_unitario / divisor)
          }
          return { ...p, costo }
        })
        const totalCosto = productos.reduce((s, p) => s + (p.costo || 0), 0)
        return { cliente, productos, totalCosto, nVisitas: visitasMes.length }
      })
      setConsumoData(result)
    } catch (err) {
      setConsumoData({ error: err.message || 'Error al cargar datos' })
    } finally {
      setConsumoLoading(false)
    }
  }

  useEffect(() => { loadClientes() }, [])

  const loadClientes = async () => {
    try {
      setLoading(true)
      setError(null)
      const lista = await apiClient.getClientes()
      setClientes(lista.filter(c => c.activo !== 0))
    } catch {
      let cargado = false
      try {
        await storageService.initPromise
        const local = await storageService.getAllClientes()
        if (local.length > 0) {
          setClientes(local.filter(c => c.activo !== 0))
          setError('Sin conexión — mostrando datos locales')
          cargado = true
        }
      } catch {}

      if (!cargado) {
        try {
          const cached = JSON.parse(localStorage.getItem('piletero_clientes_cache') || '[]')
          setClientes(cached.filter(c => c.activo !== 0))
          setError(cached.length > 0 ? 'Sin conexión — mostrando datos locales' : 'Sin conexión. Sincronizá cuando vuelvas a conectar.')
        } catch {
          setError('Sin conexión al servidor.')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const guardarOffline = async (formData) => {
    await storageService.initPromise
    await storageService.saveCliente({
      ...formData,
      id: -Date.now(),
      pendiente_sync: true,
      activo: 1,
      created_at: new Date().toISOString(),
    })
    setShowForm(false)
    setEditingCliente(null)
    await loadClientes()
    toastOffline('Guardado localmente\nSe sincronizará cuando vuelvas a conectar')
  }

  const handleSave = async (formData) => {
    if (!navigator.onLine) {
      if (editingCliente) {
        toastError('Sin conexión — los cambios se guardan solo cuando estás conectado.')
        return
      }
      await guardarOffline(formData)
      return
    }

    try {
      if (editingCliente) {
        await apiClient.updateCliente(editingCliente.id, formData)
      } else {
        await apiClient.createCliente(formData)
      }
      setShowForm(false)
      setEditingCliente(null)
      await loadClientes()
      toastSuccess('Cliente guardado')
    } catch (err) {
      const esTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.sinConexion
      if (esTimeout && !editingCliente) {
        await guardarOffline(formData)
      } else {
        toastError('Error: ' + (err.response?.data?.error || err.message))
      }
    }
  }

  const handleDelete = async (cliente) => {
    if (confirm(`¿Eliminar a ${cliente.nombre}?`)) {
      try {
        await apiClient.updateCliente(cliente.id, { activo: 0 })
        await loadClientes()
      } catch (err) {
        toastError('Error al eliminar: ' + (err.response?.data?.error || err.message))
      }
    }
  }

  const handleEdit = (cliente) => { setEditingCliente(cliente); setShowForm(true) }
  const handleNuevo = () => { setEditingCliente(null); setShowForm(true) }
  const handleCancel = () => { setShowForm(false); setEditingCliente(null) }

  const clientesFiltrados = busqueda.trim()
    ? clientes.filter(c =>
        c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.direccion?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : clientes

  if (showForm) {
    return (
      <div className="min-h-screen bg-sky-50 pb-24">
        <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 py-4 flex items-center gap-3">
          <button onClick={handleCancel} className="text-white/80 text-lg font-medium">← Volver</button>
          <h1 className="text-xl font-bold text-white">
            {editingCliente ? 'Editar cliente' : 'Nuevo cliente'}
          </h1>
        </div>
        <div className="p-4">
          <ClientForm initialData={editingCliente} onSubmit={handleSave} onCancel={handleCancel} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sky-50 pb-24">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          <div className="flex gap-2">
            <button onClick={() => { setShowConsumo(true); cargarConsumo(consumoMes, clientes) }}
              className="bg-white/20 text-white font-bold py-2 px-3 rounded-xl text-sm">
              📊
            </button>
            <button onClick={handleNuevo}
              className="bg-white text-sky-700 font-bold py-2 px-4 rounded-xl text-sm">
              + Nuevo
            </button>
          </div>
        </div>
        <input
          type="search"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o dirección..."
          className="w-full px-4 py-2.5 bg-white rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none"
        />
      </div>

      <div className="p-4">
        {loading && <p className="text-center text-gray-500 py-12">Cargando clientes...</p>}

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">{error}</p>
            <button onClick={loadClientes} className="text-yellow-700 underline text-sm mt-2">Reintentar</button>
          </div>
        )}

        {!loading && clientesFiltrados.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">👥</div>
            <p className="text-gray-500 font-medium">
              {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay clientes aún.'}
            </p>
            {!busqueda && (
              <button onClick={handleNuevo}
                className="mt-6 bg-sky-600 text-white font-bold py-3 px-8 rounded-xl">
                + Agregar primer cliente
              </button>
            )}
          </div>
        )}

        {!loading && clientesFiltrados.length > 0 && (
          <div className="space-y-3">
            {clientesFiltrados.map((cliente) => (
              <div key={cliente.id} className={`bg-white rounded-xl shadow-sm border-l-4 px-4 py-4 ${
                  cliente.estado === 'suspendido' ? 'border-l-amber-400 bg-amber-50/40' : 'border-l-sky-400'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 truncate">{cliente.nombre}</p>
                      {cliente.estado === 'suspendido' ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap font-semibold">
                          ⏸ Suspendido
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap font-semibold">
                          Activo
                        </span>
                      )}
                      {cliente.pendiente_sync && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ⏳ sync pendiente
                        </span>
                      )}
                    </div>
                    {cliente.direccion && <p className="text-gray-500 text-sm mt-1 truncate">{cliente.direccion}</p>}
                    <div className="flex flex-wrap gap-x-3 mt-1">
                      {cliente.telefono   && <p className="text-gray-400 text-xs">{cliente.telefono}</p>}
                      {cliente.volumen_litros && <p className="text-gray-400 text-xs">💧 {cliente.volumen_litros} L</p>}
                      {cliente.dias_visita    && <p className="text-gray-400 text-xs">📅 {cliente.dias_visita}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => verHistorial(cliente)}
                    className="flex-1 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-xl text-sm">
                    📋 Historial
                  </button>
                  <button onClick={() => handleEdit(cliente)}
                    className="flex-1 py-2 bg-sky-50 text-sky-700 font-semibold rounded-xl text-sm">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(cliente)}
                    className="flex-1 py-2 bg-red-50 text-red-600 font-semibold rounded-xl text-sm">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal historial */}
      {historial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setHistorial(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[82vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-lg font-black text-gray-900">Historial</h2>
                <p className="text-sm text-gray-500">{historial.cliente.nombre}</p>
              </div>
              <button onClick={() => setHistorial(null)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5">
              {[['insumos', '📋 Insumos'], ['pagos', '💰 Pagos']].map(([key, label]) => (
                <button key={key}
                  onClick={() => setHistorial(h => ({ ...h, tab: key }))}
                  className={`py-2 px-4 text-sm font-semibold border-b-2 transition-colors ${
                    historial.tab === key ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              {historial.loading && <p className="text-center text-gray-400 py-8">Cargando...</p>}
              {historial.error && <p className="text-center text-red-400 py-8">{historial.error}</p>}

              {/* Tab insumos */}
              {!historial.loading && historial.tab === 'insumos' && (
                historial.visitas.length === 0
                  ? <p className="text-center text-gray-400 py-8">Sin visitas registradas</p>
                  : historial.visitas.map(v => {
                      const quimicos = parseQuimicos(v.quimicos_usados)
                      return (
                        <div key={v.id} className="mb-4 pb-4 border-b border-gray-100 last:border-0">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{formatFecha(v.fecha)}</p>
                          <div className="flex gap-3 text-xs mb-2">
                            {v.cloro_ppm != null && <span className="text-blue-600">🔵 Cl {v.cloro_ppm} ppm</span>}
                            {v.ph != null && <span className="text-green-600">🟢 pH {v.ph}</span>}
                          </div>
                          {quimicos.length > 0 ? (
                            <div className="space-y-1">
                              {quimicos.map((q, i) => (
                                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                                  <span className="text-sm text-gray-800">{q.nombre || q.name}</span>
                                  <span className="text-sm font-semibold text-sky-700">
                                    {q.cantidad_usada ?? q.cantidad ?? ''} {q.unidad || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-300 italic">Sin insumos registrados</p>
                          )}
                        </div>
                      )
                    })
              )}

              {/* Tab pagos */}
              {!historial.loading && historial.tab === 'pagos' && (
                historial.pagos.length === 0
                  ? <p className="text-center text-gray-400 py-8">Sin pagos registrados</p>
                  : (() => {
                      return historial.pagos.map(p => {
                        const fechaPago = p.fecha ? new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
                        return (
                          <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{p.mes || '—'}</p>
                              {fechaPago && <p className="text-xs text-gray-400">Pagado el {fechaPago} · {p.metodo_pago || 'efectivo'}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900 text-sm">${(p.monto || 0).toLocaleString('es-AR')}</p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                p.estado === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {p.estado === 'pagado' ? '✓ Pagado' : 'Pendiente'}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal consumo Todo Incluido */}
      {showConsumo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowConsumo(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-lg font-black text-gray-900">📊 Consumo</h2>
                <p className="text-xs text-gray-400">Clientes Todo Incluido</p>
              </div>
              <button onClick={() => setShowConsumo(false)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>

            <div className="px-5 pb-3">
              <input
                type="month"
                value={consumoMes}
                onChange={e => { setConsumoMes(e.target.value); cargarConsumo(e.target.value, clientes) }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div className="overflow-y-auto flex-1 px-5 pb-6">
              {consumoLoading && <p className="text-center text-gray-400 py-8">Calculando...</p>}

              {!consumoLoading && consumoData?.error && (
                <p className="text-center text-red-400 py-8">Error: {consumoData.error}</p>
              )}

              {!consumoLoading && Array.isArray(consumoData) && consumoData.length === 0 && (
                <p className="text-center text-gray-400 py-8">No hay clientes con abono "Todo Incluido" registrados.</p>
              )}

              {!consumoLoading && Array.isArray(consumoData) && consumoData.map(({ cliente, productos, totalCosto, nVisitas }) => (
                <div key={cliente.id} className="mb-5 pb-5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-gray-900">{cliente.nombre}</p>
                      <p className="text-xs text-gray-400">{nVisitas} visita{nVisitas !== 1 ? 's' : ''} en el período</p>
                    </div>
                    {totalCosto > 0 && (
                      <span className="text-sm font-black text-sky-700 bg-sky-50 px-3 py-1 rounded-full">
                        ${totalCosto.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>

                  {productos.length === 0 ? (
                    <p className="text-xs text-gray-300 italic">Sin insumos registrados en este período</p>
                  ) : (
                    <div className="space-y-1">
                      {productos.map((p, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm text-gray-800 font-medium">{p.nombre}</p>
                            <p className="text-xs text-gray-400">{p.cantidad % 1 === 0 ? p.cantidad : p.cantidad.toFixed(2)} {p.unidad}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-700 shrink-0 ml-3">
                            {p.costo !== null ? `$${p.costo.toLocaleString('es-AR')}` : <span className="text-gray-300 text-xs">sin precio</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
