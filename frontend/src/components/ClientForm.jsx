import { useEffect, useRef, useState } from 'react'
import { apiClient } from '../services/api'
import DosisRecomendadas from './DosisRecomendadas'

const DIAS_SEMANA = [
  { num: 0, label: 'Dom' },
  { num: 1, label: 'Lun' },
  { num: 2, label: 'Mar' },
  { num: 3, label: 'Mié' },
  { num: 4, label: 'Jue' },
  { num: 5, label: 'Vie' },
  { num: 6, label: 'Sáb' },
]

function parseDias(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.map(Number).filter(n => n >= 0 && n <= 6)
  } catch {}
  return []
}

function comprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function calcularLitros(largo, ancho, prof, forma) {
  const L = parseFloat(largo), A = parseFloat(ancho), P = parseFloat(prof)
  if (!L || !A || !P || L <= 0 || A <= 0 || P <= 0) return null
  const factor = forma === 'oval' ? 0.85 : 1
  return Math.round(L * A * P * 1000 * factor)
}

export default function ClientForm({ initialData, onSubmit, onCancel }) {
  const isEditMode = !!(initialData?.id)

  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    volumen_litros: '',
    tipo_construccion: '',
    equipamiento: '',
    modelo_filtro: '',
    tipo_abono: '',
    precio_abono: '',
    frecuencia_visita: 'semanal',
    grupo_semana: 'A',
    notas_acceso: '',
    fecha_inicio: '',
    fecha_fin: '',
  })
  const [diasSeleccionados, setDiasSeleccionados] = useState([])
  const [fotosCliente, setFotosCliente] = useState([])
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [customConstruccion, setCustomConstruccion] = useState('')
  const [suspending, setSuspending] = useState(false)
  const fileInputRef = useRef(null)

  // Calculadora de litros
  const [mostrarCalc, setMostrarCalc] = useState(false)
  const [calcDims, setCalcDims] = useState({ largo: '', ancho: '', profundidad: '', forma: 'rectangular' })
  const litrosCalc = calcularLitros(calcDims.largo, calcDims.ancho, calcDims.profundidad, calcDims.forma)

  useEffect(() => {
    if (initialData) {
      const { dias_visita, tipo_construccion, ...rest } = initialData

      // Detect if tipo_construccion is a custom value (not one of the predefined options)
      const OPCIONES_PREDEFINIDAS = ['fibra_vidrio', 'pintada', 'venecita', 'marmolina']
      const isCustom = tipo_construccion && !OPCIONES_PREDEFINIDAS.includes(tipo_construccion)

      setFormData({
        nombre: '',
        direccion: '',
        telefono: '',
        volumen_litros: '',
        tipo_construccion: isCustom ? 'otro' : (tipo_construccion || ''),
        equipamiento: '',
        modelo_filtro: '',
        tipo_abono: '',
        precio_abono: '',
        frecuencia_visita: 'semanal',
        grupo_semana: 'A',
        notas_acceso: '',
        ...rest,
      })

      // Set custom construction value if needed
      if (isCustom) {
        setCustomConstruccion(tipo_construccion)
      } else {
        setCustomConstruccion('')
      }

      setDiasSeleccionados(parseDias(dias_visita))
    }
  }, [initialData])

  useEffect(() => {
    if (!isEditMode) return
    apiClient.getFotosCliente(initialData.id)
      .then(fotos => setFotosCliente(fotos || []))
      .catch(() => {})
  }, [initialData?.id, isEditMode])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function toggleDia(num) {
    setDiasSeleccionados(prev =>
      prev.includes(num) ? prev.filter(d => d !== num) : [...prev, num].sort((a, b) => a - b)
    )
  }

  function aplicarCalculo() {
    if (!litrosCalc) return
    setFormData(prev => ({ ...prev, volumen_litros: litrosCalc }))
    setMostrarCalc(false)
    setCalcDims({ largo: '', ancho: '', profundidad: '', forma: 'rectangular' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.nombre.trim() || !formData.direccion.trim()) {
      alert('Por favor completa nombre y dirección')
      return
    }

    // Handle custom construction value
    let finalTipoConstruccion = formData.tipo_construccion
    if (formData.tipo_construccion === 'otro') {
      if (!customConstruccion.trim()) {
        alert('Por favor ingresa el tipo de construcción personalizado')
        return
      }
      finalTipoConstruccion = customConstruccion.trim()
    }

    onSubmit({
      ...formData,
      tipo_construccion: finalTipoConstruccion,
      dias_visita: diasSeleccionados.length ? JSON.stringify(diasSeleccionados) : '',
    })
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (fotosCliente.length >= 2) return

    setSubiendoFoto(true)
    try {
      const data = await comprimirImagen(file)
      const nueva = await apiClient.saveFotoCliente(initialData.id, { tipo: 'referencia', data })
      setFotosCliente(prev => [...prev, nueva])
    } catch (err) {
      alert('No se pudo subir la foto: ' + (err?.response?.data?.error || err.message))
    } finally {
      setSubiendoFoto(false)
    }
  }

  async function handleEliminarFoto(id) {
    if (!confirm('¿Eliminar esta foto?')) return
    try {
      await apiClient.deleteFotoCliente(id)
      setFotosCliente(prev => prev.filter(f => f.id !== id))
    } catch {
      alert('No se pudo eliminar la foto')
    }
  }

  async function handleToggleSuspend() {
    if (!initialData?.id) return

    const isSuspended = initialData.estado === 'suspendido'
    const actionFn = isSuspended ? apiClient.reactivarCliente : apiClient.suspenderCliente
    const actionLabel = isSuspended ? 'Reactivar' : 'Suspender'

    if (!confirm(`¿${actionLabel} cliente "${initialData.nombre}"?`)) return

    setSuspending(true)
    try {
      const result = await actionFn(initialData.id)
      if (result.success || result.cliente) {
        // Reload the cliente to reflect new estado
        const updated = await apiClient.getCliente(initialData.id)
        onSubmit(updated)
      }
    } catch (error) {
      console.error('Error toggling suspend:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setSuspending(false)
    }
  }

  return (
    <div className="mb-8 bg-white p-6 rounded-lg shadow">
      <form onSubmit={handleSubmit}>
        {/* Nombre * */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
          <input
            type="text" name="nombre" value={formData.nombre} onChange={handleChange}
            placeholder="Nombre del cliente"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dirección * */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Dirección *</label>
          <input
            type="text" name="direccion" value={formData.direccion} onChange={handleChange}
            placeholder="Dirección completa"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Teléfono */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
          <input
            type="tel" name="telefono" value={formData.telefono} onChange={handleChange}
            placeholder="+54 9 11 xxxx-xxxx"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Volumen con calculadora */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Volumen (litros)</label>
            <button
              type="button"
              onClick={() => setMostrarCalc(v => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {mostrarCalc ? 'Cerrar calculadora' : '🧮 Calcular por dimensiones'}
            </button>
          </div>
          <input
            type="number" name="volumen_litros" value={formData.volumen_litros} onChange={handleChange}
            placeholder="Ej: 10000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Calculadora inline */}
          {mostrarCalc && (
            <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-3">Dimensiones de la pileta (en metros)</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {['largo', 'ancho', 'profundidad'].map(dim => (
                  <div key={dim}>
                    <label className="text-xs text-gray-500 capitalize">{dim}</label>
                    <input
                      type="number" step="0.1" min="0"
                      value={calcDims[dim]}
                      onChange={e => setCalcDims(prev => ({ ...prev, [dim]: e.target.value }))}
                      placeholder="0.0"
                      className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-xs text-gray-500">Forma:</span>
                {['rectangular', 'oval'].map(f => (
                  <label key={f} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="radio" name="forma_pileta" value={f}
                      checked={calcDims.forma === f}
                      onChange={() => setCalcDims(prev => ({ ...prev, forma: f }))}
                    />
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </label>
                ))}
              </div>
              {litrosCalc && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-700">
                    = {litrosCalc.toLocaleString('es-AR')} litros
                  </span>
                  <button
                    type="button"
                    onClick={aplicarCalculo}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tipo de Construcción */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Construcción</label>
          <select name="tipo_construccion" value={formData.tipo_construccion} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar...</option>
            <option value="fibra_vidrio">Piscina Fibra de Vidrio</option>
            <option value="pintada">Piscina Pintada</option>
            <option value="venecita">Piscina Venecita</option>
            <option value="marmolina">Piscina Marmolina / Revestimiento Cementicio</option>
            <option value="otro">Otros Tipos Piscinas</option>
          </select>

          {/* Custom construction input - only show when "Otros" is selected */}
          {formData.tipo_construccion === 'otro' && (
            <div className="mt-3">
              <input
                type="text"
                value={customConstruccion}
                onChange={(e) => setCustomConstruccion(e.target.value)}
                placeholder="ej: ferrocemento, fibra de vidrio custom"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Describe el material o tipo de construcción</p>
            </div>
          )}
        </div>

        {/* Equipamiento */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Equipamiento</label>
          <select name="equipamiento" value={formData.equipamiento} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar...</option>
            <option value="con_filtro">Con Filtro</option>
            <option value="sin_filtro">Sin Filtro</option>
          </select>
        </div>

        {/* Modelo Filtro */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Modelo Filtro</label>
          <input
            type="text" name="modelo_filtro" value={formData.modelo_filtro} onChange={handleChange}
            placeholder="Ej: Pentair 1.5hp"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tipo de Abono */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Abono</label>
          <select name="tipo_abono" value={formData.tipo_abono} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar...</option>
            <option value="mano_de_obra">Mano de Obra</option>
            <option value="todo_incluido">Todo Incluido</option>
            <option value="eventual">Eventual</option>
          </select>
        </div>

        {/* Precio Abono Mensual */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Precio Abono Mensual ($)</label>
          <input
            type="number" name="precio_abono" value={formData.precio_abono} onChange={handleChange}
            placeholder="0.00" step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Primer mes de servicio */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Primer mes de servicio</label>
          <input
            type="month" name="fecha_inicio" value={formData.fecha_inicio || ''} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Indica desde qué mes este cliente tiene servicio. Los meses anteriores no figurarán como deuda.</p>
        </div>

        {/* Último mes de servicio */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Último mes de servicio</label>
          <input
            type="month" name="fecha_fin" value={formData.fecha_fin || ''} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Solo completar si el cliente dejó el servicio. A partir del mes siguiente no figurará como deuda.</p>
        </div>

        {/* Días de Visita */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Días de Visita</label>
          <div className="flex gap-2 flex-wrap">
            {DIAS_SEMANA.map(({ num, label }) => {
              const activo = diasSeleccionados.includes(num)
              return (
                <button key={num} type="button" onClick={() => toggleDia(num)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    activo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}>
                  {label}
                </button>
              )
            })}
          </div>
          {diasSeleccionados.length > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              {diasSeleccionados.map(n => DIAS_SEMANA[n].label).join(' · ')}
            </p>
          )}
        </div>

        {/* Frecuencia de visita */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Frecuencia de visita</label>
          <div className="flex gap-3">
            {[
              { value: 'semanal', label: 'Semanal' },
              { value: 'quincenal', label: 'Cada 15 días' },
            ].map(op => (
              <label key={op.value} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-colors ${
                formData.frecuencia_visita === op.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}>
                <input
                  type="radio" name="frecuencia_visita" value={op.value}
                  checked={formData.frecuencia_visita === op.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                {op.label}
              </label>
            ))}
          </div>

          {/* Grupo de semana (solo si quincenal) */}
          {formData.frecuencia_visita === 'quincenal' && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium mb-2">
                ¿En qué semana cae la visita?
              </p>
              <div className="flex gap-3">
                {['A', 'B'].map(grupo => (
                  <label key={grupo} className={`flex-1 text-center py-2 rounded-lg border cursor-pointer font-semibold text-sm transition-colors ${
                    formData.grupo_semana === grupo
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                  }`}>
                    <input
                      type="radio" name="grupo_semana" value={grupo}
                      checked={formData.grupo_semana === grupo}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    Semana {grupo}
                  </label>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                Las semanas A y B se alternan automáticamente. Asigná A o B según cuándo corresponda la primera visita.
              </p>
            </div>
          )}
        </div>

        {/* Notas de Acceso */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas de Acceso</label>
          <input
            type="text" name="notas_acceso" value={formData.notas_acceso} onChange={handleChange}
            placeholder="Ej: Portón azul, llave en maceta"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dosis recomendadas */}
        <DosisRecomendadas litros={formData.volumen_litros} />

        {/* Fotos de la pileta */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fotos de referencia (máx. 2)
          </label>
          {!isEditMode ? (
            <p className="text-sm text-gray-400 italic">
              Guardá el cliente primero para poder agregar fotos.
            </p>
          ) : (
            <div>
              {fotosCliente.length > 0 && (
                <div className="flex gap-3 flex-wrap mb-3">
                  {fotosCliente.map(foto => (
                    <div key={foto.id} className="relative group">
                      <img
                        src={foto.ruta_archivo} alt="Foto pileta"
                        className="w-32 h-24 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleEliminarFoto(foto.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar foto"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {fotosCliente.length < 2 && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={subiendoFoto}
                    className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                  >
                    {subiendoFoto ? '⏳ Subiendo...' : '＋ Agregar foto'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-4 mt-6">
          {isEditMode && (
            <button
              type="button"
              onClick={handleToggleSuspend}
              disabled={suspending}
              className={`px-4 py-2 rounded font-medium transition ${
                initialData.estado === 'suspendido'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } disabled:opacity-50`}
            >
              {suspending ? 'Procesando...' : initialData.estado === 'suspendido' ? 'Reactivar' : 'Suspender'}
            </button>
          )}
          <button type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Guardar Cliente
          </button>
          <button type="button" onClick={onCancel}
            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
