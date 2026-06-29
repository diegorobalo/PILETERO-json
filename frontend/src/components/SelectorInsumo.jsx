import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'

export default function SelectorInsumo({ onAgregarInsumo }) {
  const [insumos, setInsumos] = useState([])
  const [seleccionado, setSeleccionado] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargarInsumos()
  }, [])

  async function cargarInsumos() {
    try {
      setLoading(true)
      const lista = await apiClient.getInventario()
      // Excluir agua
      const filtrada = lista.filter(i => i.nombre.toLowerCase() !== 'agua')
      setInsumos(filtrada)
    } catch (e) {
      console.error('cargarInsumos error:', e)
      const msg = e.message?.includes('Network')
        ? 'Sin conexión al servidor'
        : 'Error al cargar insumos'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleAgregar() {
    if (!seleccionado || !cantidad) {
      alert('Seleccioná insumo y cantidad')
      return
    }

    const insumo = insumos.find(i => i.id === parseInt(seleccionado, 10))
    if (!insumo) {
      alert('El insumo seleccionado ya no está disponible')
      setSeleccionado('')
      return
    }

    onAgregarInsumo({
      insumo_id: insumo.id,
      nombre: insumo.nombre,
      cantidad: parseFloat(cantidad),
      unidad: insumo.unidad || 'g',
    })

    setSeleccionado('')
    setCantidad('')
  }

  if (loading) return <div className="text-sm text-gray-400">Cargando insumos...</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>

  // Optimización: calcular insumo seleccionado una sola vez
  const insumoSeleccionado = insumos.find(i => i.id === parseInt(seleccionado, 10))
  const unidadActual = insumoSeleccionado?.unidad || 'g'

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-xs text-gray-500 uppercase">Insumo</label>
        <select
          value={seleccionado}
          onChange={(e) => setSeleccionado(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">-- Seleccioná insumo --</option>
          {insumos.map(i => (
            <option key={i.id} value={i.id}>
              {i.nombre} ({i.stock} {i.unidad || 'g'} disponible)
            </option>
          ))}
        </select>
      </div>

      <div className="w-32">
        <label className="text-xs text-gray-500 uppercase">
          Cantidad {seleccionado && `(${unidadActual})`}
        </label>
        <input
          type="number"
          step="0.01"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      <button
        onClick={handleAgregar}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
      >
        Agregar
      </button>
    </div>
  )
}
