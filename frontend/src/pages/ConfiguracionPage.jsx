import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'
import { toastSuccess, toastError, toastInfo } from '../utils/toast'
import { interpolateMensaje } from '../utils/messageInterpolation'

const CAMPOS = [
  { clave: 'nombre_tecnico', label: 'Nombre del técnico', placeholder: 'Ej: Federico Tenca' },
  { clave: 'telefono', label: 'Teléfono', placeholder: 'Ej: 2323 545583' },
  { clave: 'email', label: 'Email (opcional)', placeholder: 'Ej: fede@mail.com' },
  { clave: 'notas_pie_recibo', label: 'Nota al pie del recibo (opcional)', placeholder: 'Ej: Gracias por su confianza' },
]

// WhatsApp message templates
const MENSAJES_WHATSAPP = [
  {
    clave: 'mensaje_whatsapp_visita',
    label: 'Mensaje para visita (cuando vas a hacer el servicio)',
    placeholder: 'Ej: Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!',
    defaultValue: 'Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!'
  },
  {
    clave: 'mensaje_whatsapp_reprogramado',
    label: 'Mensaje para reprogramación',
    placeholder: 'Ej: Hola {nombre_cliente}, el servicio va a ser reprogramado para otro día. Te aviso cuando.',
    defaultValue: 'Hola {nombre_cliente}, el servicio va a ser reprogramado para otro día. Te aviso cuando.'
  }
]

export default function ConfiguracionPage() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(null)
  const [descargandoBackup, setDescargandoBackup] = useState(false)

  async function descargarBackup() {
    try {
      setDescargandoBackup(true)
      const response = await fetch('/api/backup')

      let data
      const text = await response.text()
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 200)}`)
      }

      if (!response.ok) {
        throw new Error(data?.error || `Error ${response.status}`)
      }

      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const fecha = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `piletero-backup-${fecha}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      if (data.advertencias?.length) {
        toastError(`Backup parcial — tablas con error: ${data.advertencias.join(', ')}`)
      } else {
        toastSuccess('Backup descargado correctamente')
      }
    } catch (e) {
      toastError(`Error al descargar el backup: ${e.message}`)
    } finally {
      setDescargandoBackup(false)
    }
  }

  useEffect(() => {
    apiClient.getConfiguracion()
      .then(cfg => {
        // Initialize defaults if not set
        const withDefaults = { ...cfg };
        MENSAJES_WHATSAPP.forEach(({ clave, defaultValue }) => {
          if (!withDefaults[clave]) {
            withDefaults[clave] = defaultValue;
          }
        });
        setConfig(withDefaults);
      })
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
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
      <p className="text-gray-500 text-sm mb-6">Estos datos aparecen en los recibos y reportes PDF.</p>
      {loading ? <p className="text-gray-400">Cargando...</p> : (
        <div className="space-y-4">
          {/* Original campos */}
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

          {/* NEW: WhatsApp Messages Section */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💬 Mensajes WhatsApp</h2>
            <p className="text-gray-500 text-sm mb-6">
              Personaliza los mensajes que se envían por WhatsApp. Puedes usar:
              <br />
              <code className="text-xs bg-gray-100 px-1 rounded">{`{nombre_cliente}`}</code>
              {` — `}
              <code className="text-xs bg-gray-100 px-1 rounded">{`{fecha_hoy}`}</code>
              {` — `}
              <code className="text-xs bg-gray-100 px-1 rounded">{`{hora}`}</code>
            </p>

            {MENSAJES_WHATSAPP.map(({ clave, label, placeholder, defaultValue }) => (
              <div key={clave} className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 resize-vertical"
                  rows="3"
                  value={config[clave] || ''}
                  placeholder={placeholder}
                  onChange={e => setConfig(c => ({ ...c, [clave]: e.target.value }))}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => guardar(clave, config[clave] || defaultValue)}
                    disabled={guardando === clave}
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-sky-700">
                    {guardando === clave ? '...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => {
                      const interpolated = interpolateMensaje(
                        config[clave] || defaultValue,
                        { nombre_cliente: 'Casa A' }
                      );
                      toastInfo(`Preview: ${interpolated}`);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-400">
                    Preview
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Copia de Seguridad */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-2">💾 Copia de Seguridad</h2>
            <p className="text-gray-500 text-sm mb-4">
              Descargá todos tus datos (clientes, visitas, pagos, inventario) en un archivo JSON. Guardalo en un lugar seguro como respaldo.
            </p>
            <button
              onClick={descargarBackup}
              disabled={descargandoBackup}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-colors">
              {descargandoBackup ? 'Descargando...' : '📥 Descargar Backup'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
