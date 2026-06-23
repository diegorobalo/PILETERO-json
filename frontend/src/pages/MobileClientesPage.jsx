import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import storageService from '../services/storage'
import ClientForm from '../components/ClientForm'
import { toastSuccess, toastError, toastOffline } from '../utils/toast'

export default function MobileClientesPage() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [busqueda, setBusqueda] = useState('')

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
          <button onClick={handleNuevo}
            className="bg-white text-sky-700 font-bold py-2 px-4 rounded-xl text-sm">
            + Nuevo
          </button>
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
              <div key={cliente.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-sky-400 px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 truncate">{cliente.nombre}</p>
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
    </div>
  )
}
