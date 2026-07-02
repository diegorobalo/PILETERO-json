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
  const [panelCliente, setPanelCliente] = useState(null) // { cliente, visitas, pagos }
  const [panelTab, setPanelTab] = useState('visitas') // 'visitas' | 'agua' | 'pagos'
  const [loadingPanel, setLoadingPanel] = useState(false)

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
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false)
              setEditingId(null)
            } else {
              setShowForm(true)
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded"
        >
          {showForm ? 'Cerrar' : '+ Nuevo Cliente'}
        </button>
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
