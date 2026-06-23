import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'
import ClientForm from '../components/ClientForm'

export default function ClientsPage() {
  const [clientes, setClientes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
        await apiClient.updateCliente(id, { activo: 0 })
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
    </div>
  )
}
