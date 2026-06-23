import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'
import { toastSuccess, toastError } from '../utils/toast'

const CAMPOS = [
  { clave: 'nombre_tecnico', label: 'Nombre del técnico', placeholder: 'Ej: Federico Tenca' },
  { clave: 'telefono', label: 'Teléfono', placeholder: 'Ej: 2323 545583' },
  { clave: 'email', label: 'Email (opcional)', placeholder: 'Ej: fede@mail.com' },
  { clave: 'notas_pie_recibo', label: 'Nota al pie del recibo (opcional)', placeholder: 'Ej: Gracias por su confianza' },
]

export default function ConfiguracionPage() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(null)

  useEffect(() => {
    apiClient.getConfiguracion()
      .then(setConfig)
      .catch(() => toastError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  async function guardar(clave, valor) {
    setGuardando(clave)
    try {
      await apiClient.setConfiguracion(clave, valor)
      toastSuccess('Guardado')
    } catch {
      toastError('Error al guardar')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
      <p className="text-gray-500 text-sm mb-6">Estos datos aparecen en los recibos y reportes PDF.</p>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-4">
          {CAMPOS.map(({ clave, label, placeholder }) => (
            <div key={clave}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
                  value={config[clave] || ''}
                  placeholder={placeholder}
                  onChange={e => setConfig(c => ({ ...c, [clave]: e.target.value }))}
                />
                <button
                  onClick={() => guardar(clave, config[clave] || '')}
                  disabled={guardando === clave}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-sky-700">
                  {guardando === clave ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
