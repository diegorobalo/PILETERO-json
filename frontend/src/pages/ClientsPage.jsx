import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'
import ClientForm from '../components/ClientForm'

export default function ClientsPage() {
  const [clientes, setClientes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [panelCliente, setPanelCliente] = useState(null)
  const [panelTab, setPanelTab] = useState('visitas')
  const [loadingPanel, setLoadingPanel] = useState(false)
  const [showConsumo, setShowConsumo] = useState(false)
  const [consumoMes, setConsumoMes] = useState(new Date().toISOString().slice(0, 7))
  const [consumoData, setConsumoData] = useState(null)
  const [consumoLoading, setConsumoLoading] = useState(false)

  useEffect(() => {
    loadClientes()
  }, [])

  const loadClientes = async () => {
    try {
      setLoading(true)
      setError(null)
      const clientesList = await apiClient.getClientes()
      setClientes(clientesList)
    } catch (err) {
      setError('No se pudo conectar al servidor. ¿Está corriendo el backend?')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCliente = async (formData) => {
    try {
      if (editingId) {
        await apiClient.updateCliente(editingId, formData)
      } else {
        await apiClient.createCliente(formData)
      }
      setShowForm(false)
      setEditingId(null)
      await loadClientes()
      alert('✓ Cliente guardado correctamente')
    } catch (err) {
      alert('Error al guardar: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleEditCliente = (cliente) => {
    setEditingId(cliente.id)
    setShowForm(true)
  }

  const handleDeleteCliente = async (id) => {
    if (confirm('¿Eliminar este cliente?')) {
      try {
        await apiClient.updateCliente(id, { activo: 0, estado: 'eliminado' })
        await loadClientes()
      } catch (err) {
        alert('Error al eliminar: ' + (err.response?.data?.error || err.message))
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
  }

  async function cargarConsumo(mes, listaClientes) {
    setConsumoLoading(true)
    setConsumoData(null)
    try {
      const [todasVisitas, inventario] = await Promise.all([
        apiClient.getVisitas(),
        apiClient.getInventario(),
      ])
      const clientesTodoInc = listaClientes.filter(c => c.tipo_abono === 'todo_incluido')
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

  async function abrirPanel(cliente) {
    setLoadingPanel(true)
    setPanelTab('visitas')
    try {
      const [visitas, pagos] = await Promise.all([
        apiClient.getVisitasByCliente(cliente.id),
        apiClient.getPagosByCliente(cliente.id),
      ])
      setPanelCliente({ cliente, visitas, pagos: pagos || [] })
    } catch {
      alert('No se pudo cargar el historial')
    } finally {
      setLoadingPanel(false)
    }
  }

  const initialData = editingId
    ? clientes.find((c) => c.id === editingId) || null
    : null

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">👥 Clientes</h1>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowConsumo(true); cargarConsumo(consumoMes, clientes) }}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded flex items-center gap-2"
          >
            📊 Consumo Todo Incluido
          </button>
          <button
            onClick={() => {
              if (showForm) { setShowForm(false); setEditingId(null) }
              else setShowForm(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded"
          >
            {showForm ? 'Cerrar' : '+ Nuevo Cliente'}
          </button>
        </div>
      </div>

      {showForm && (
        <ClientForm
          initialData={initialData}
          onSubmit={handleSaveCliente}
          onCancel={handleCancel}
        />
      )}

      {loading && (
        <div className="p-8 text-center text-gray-500">Cargando clientes...</div>
      )}

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
          <button onClick={loadClientes} className="ml-4 underline">Reintentar</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {clientes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No hay clientes. ¡Crea el primero!</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Dirección</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Teléfono</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Volumen</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{cliente.nombre}</td>
                    <td className="px-6 py-4 text-gray-600">{cliente.direccion || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{cliente.telefono || '-'}</td>
                    <td className="px-6 py-4 text-gray-900">
                      {cliente.volumen_litros ? `${cliente.volumen_litros}L` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        cliente.estado === 'suspendido' ? 'bg-amber-100 text-amber-700' :
                        cliente.estado === 'eliminado' ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {cliente.estado === 'suspendido' ? 'Suspendido' :
                         cliente.estado === 'eliminado' ? 'Eliminado' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => abrirPanel(cliente)}
                        className="px-2 py-1 text-xs bg-sky-50 text-sky-700 rounded hover:bg-sky-100 mr-4"
                      >
                        Historial
                      </button>
                      <button
                        onClick={() => handleEditCliente(cliente)}
                        className="text-blue-600 hover:underline mr-4"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteCliente(cliente.id)}
                        className="text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showConsumo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6" onClick={() => setShowConsumo(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-black text-gray-900">📊 Consumo — Todo Incluido</h2>
                <p className="text-sm text-gray-400 mt-0.5">Insumos usados por cliente en el período</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  value={consumoMes}
                  onChange={e => { setConsumoMes(e.target.value); cargarConsumo(e.target.value, clientes) }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button onClick={() => setShowConsumo(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {consumoLoading && <p className="text-center text-gray-400 py-12">Calculando...</p>}

              {!consumoLoading && consumoData?.error && (
                <p className="text-center text-red-400 py-12">Error: {consumoData.error}</p>
              )}

              {!consumoLoading && Array.isArray(consumoData) && consumoData.length === 0 && (
                <p className="text-center text-gray-400 py-12">No hay clientes con abono "Todo Incluido" registrados.</p>
              )}

              {!consumoLoading && Array.isArray(consumoData) && consumoData.map(({ cliente, productos, totalCosto, nVisitas }) => (
                <div key={cliente.id} className="mb-6 pb-6 border-b border-gray-100 last:border-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{cliente.nombre}</p>
                      <p className="text-xs text-gray-400">{cliente.direccion} · {nVisitas} visita{nVisitas !== 1 ? 's' : ''}</p>
                    </div>
                    {totalCosto > 0 && (
                      <span className="text-base font-black text-sky-700 bg-sky-50 px-4 py-1.5 rounded-full">
                        ${totalCosto.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                  {productos.length === 0 ? (
                    <p className="text-sm text-gray-300 italic">Sin insumos registrados en este período</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                          <th className="text-left pb-2 font-semibold">Producto</th>
                          <th className="text-right pb-2 font-semibold">Cantidad</th>
                          <th className="text-right pb-2 font-semibold">Costo est.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.map((p, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 font-medium text-gray-800">{p.nombre}</td>
                            <td className="py-2 text-right text-gray-600">
                              {p.cantidad % 1 === 0 ? p.cantidad : p.cantidad.toFixed(2)} {p.unidad}
                            </td>
                            <td className="py-2 text-right font-semibold text-gray-700">
                              {p.costo !== null ? `$${p.costo.toLocaleString('es-AR')}` : <span className="text-gray-300 text-xs">sin precio</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loadingPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg px-6 py-4 text-gray-600">Cargando historial...</div>
        </div>
      )}

      {panelCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={() => setPanelCliente(null)}>
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{panelCliente.cliente.nombre}</h2>
                <p className="text-sm text-gray-500">{panelCliente.cliente.direccion}</p>
              </div>
              <button onClick={() => setPanelCliente(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>

            <div className="flex border-b border-gray-100">
              {[['visitas', 'Visitas'], ['agua', 'Agua'], ['pagos', 'Pagos']].map(([id, label]) => (
                <button key={id} onClick={() => setPanelTab(id)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${panelTab === id ? 'text-sky-700 border-b-2 border-sky-600' : 'text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {panelTab === 'visitas' && (
                <div className="space-y-3">
                  {panelCliente.visitas.length === 0 ? (
                    <p className="text-gray-400">Sin visitas registradas.</p>
                  ) : panelCliente.visitas.slice(0, 20).map(v => (
                    <div key={v.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-gray-800 text-sm">
                          {new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <div className="flex gap-2 text-xs">
                          {v.cloro_ppm && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Cl {v.cloro_ppm} ppm</span>}
                          {v.ph && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">pH {v.ph}</span>}
                        </div>
                      </div>
                      {v.observaciones && <p className="text-sm text-gray-600">{v.observaciones}</p>}
                    </div>
                  ))}
                </div>
              )}

              {panelTab === 'pagos' && (
                <div className="space-y-3">
                  {panelCliente.pagos.length === 0 ? (
                    <p className="text-gray-400">Sin pagos registrados.</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 mb-1">Total: <strong>${panelCliente.pagos.reduce((s, p) => s + (p.monto || 0), 0).toLocaleString('es-AR')}</strong> en {panelCliente.pagos.length} pago(s)</p>
                      {panelCliente.pagos.map(p => (
                        <div key={p.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800 text-sm">
                              {new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-gray-500">{p.metodo_pago || 'efectivo'}{p.mes ? ` · ${p.mes}` : ''}</p>
                          </div>
                          <p className="font-black text-green-700">${(p.monto || 0).toLocaleString('es-AR')}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {panelTab === 'agua' && (
                <div>
                  {(() => {
                    const datos = panelCliente.visitas
                      .filter(v => v.cloro_ppm || v.ph)
                      .slice(0, 20)
                      .reverse()
                      .map(v => ({
                        fecha: v.fecha?.slice(5), // MM-DD
                        cloro: v.cloro_ppm ? parseFloat(v.cloro_ppm) : null,
                        ph: v.ph ? parseFloat(v.ph) : null,
                      }))
                    if (datos.length < 2) return <p className="text-gray-400 text-sm">Se necesitan al menos 2 visitas con mediciones para mostrar el gráfico.</p>
                    return (
                      <div>
                        <p className="text-sm text-gray-500 mb-4">Últimas {datos.length} mediciones</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={datos}>
                            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="cloro" domain={[0, 5]} tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="ph" orientation="right" domain={[6, 9]} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Line yAxisId="cloro" type="monotone" dataKey="cloro" stroke="#0284c7" name="Cloro (ppm)" dot={{ r: 3 }} connectNulls />
                            <Line yAxisId="ph" type="monotone" dataKey="ph" stroke="#16a34a" name="pH" dot={{ r: 3 }} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-blue-500 mb-1">Cloro ideal</p>
                            <p className="text-sm font-bold text-blue-700">1.0 – 3.0 ppm</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-green-500 mb-1">pH ideal</p>
                            <p className="text-sm font-bold text-green-700">7.2 – 7.6</p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
