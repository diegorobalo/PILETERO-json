/**
 * ClientForm - Reusable form for client creation and editing
 * Supports create mode (initialData=null) and edit mode (initialData=object)
 */

import { useEffect, useState } from 'react'

export default function ClientForm({ initialData, onSubmit, onCancel }) {
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
    dias_visita: '',
    notas_acceso: '',
  })

  // Populate form with initial data if in edit mode
  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    }
  }, [initialData])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Validation: nombre and direccion are required
    if (!formData.nombre.trim() || !formData.direccion.trim()) {
      alert('Por favor completa nombre y dirección')
      return
    }

    onSubmit(formData)
  }

  return (
    <div className="mb-8 bg-white p-6 rounded-lg shadow">
      <form onSubmit={handleSubmit}>
        {/* Nombre * */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre *
          </label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Nombre del cliente"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dirección * */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección *
          </label>
          <input
            type="text"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            placeholder="Dirección completa"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Teléfono */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teléfono
          </label>
          <input
            type="tel"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            placeholder="+54 9 11 xxxx-xxxx"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Volumen (litros) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Volumen (litros)
          </label>
          <input
            type="number"
            name="volumen_litros"
            value={formData.volumen_litros}
            onChange={handleChange}
            placeholder="Ej: 10000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tipo de Construcción */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Construcción
          </label>
          <select
            name="tipo_construccion"
            value={formData.tipo_construccion}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            <option value="fibra">Fibra</option>
            <option value="material">Material</option>
            <option value="pintada">Pintada</option>
          </select>
        </div>

        {/* Equipamiento */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Equipamiento
          </label>
          <select
            name="equipamiento"
            value={formData.equipamiento}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            <option value="con_filtro">Con Filtro</option>
            <option value="sin_filtro">Sin Filtro</option>
          </select>
        </div>

        {/* Modelo Filtro */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Modelo Filtro
          </label>
          <input
            type="text"
            name="modelo_filtro"
            value={formData.modelo_filtro}
            onChange={handleChange}
            placeholder="Ej: Pentair 1.5hp"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tipo de Abono */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Abono
          </label>
          <select
            name="tipo_abono"
            value={formData.tipo_abono}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            <option value="mano_de_obra">Mano de Obra</option>
            <option value="todo_incluido">Todo Incluido</option>
          </select>
        </div>

        {/* Precio Abono Mensual */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Abono Mensual ($)
          </label>
          <input
            type="number"
            name="precio_abono"
            value={formData.precio_abono}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Días de Visita */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Días de Visita
          </label>
          <input
            type="text"
            name="dias_visita"
            value={formData.dias_visita}
            onChange={handleChange}
            placeholder="Ej: Lunes, Miércoles"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Notas de Acceso */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas de Acceso
          </label>
          <input
            type="text"
            name="notas_acceso"
            value={formData.notas_acceso}
            onChange={handleChange}
            placeholder="Ej: Portón azul, llave en maceta"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Guardar Cliente
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
