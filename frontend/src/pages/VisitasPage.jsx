import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import { parseQuimicos, quimicosTexto } from '../utils/quimicosHelper'
import TaskChecklist from '../components/TaskChecklist'
import WaterMeasurement from '../components/WaterMeasurement'
import DosisCalculadora from '../components/DosisCalculadora'
import SelectorInsumo from '../components/SelectorInsumo'

const TASK_LABELS = {
  limpiafondo: 'Limpiafondo',
  cepillado: 'Cepillado de paredes',
  superficie: 'Limpieza de superficie',
  canastos: 'Limpieza de canastos/skimmer',
  retrolavado: 'Retrolavado del filtro',
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

function formatFecha(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function parseTareas(raw) {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default function VisitasPage() {
  const navigate = useNavigate()
  const today = getTodayDate()

  const [visitas, setVisitas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vistaActual, setVistaActual] = useState('agenda') // 'agenda' | 'historial' | 'nueva'
  const [expandida, setExpandida] = useState(null)
  const [filtroFecha, setFiltroFecha] = useState('')

  // Formulario nueva visita
  const [form, setForm] = useState({ cliente_id: '', fecha: today, observaciones: '' })
  const [tasks, setTasks] = useState([])
  const [cloro, setCloro] = useState('')
  const [ph, setPh] = useState('')
  const [quimicosUsados, setQuimicosUsados] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const [vs, cs] = await Promise.all([apiClient.getVisitas(), apiClient.getClientes()])
      setVisitas(vs)
      setClientes(cs)
    } catch { setError('No se pudo conectar al servidor.') }
    finally { setLoading(false) }
  }

  async function eliminarVisita(id) {
    if (!confirm('¿Eliminar esta visita del historial? Esta acción no se puede deshacer.')) return
    try {
      await apiClient.deleteVisita(id)
      setExpandida(null)
      await cargar()
    } catch (e) {
      alert('Error al eliminar: ' + (e.response?.data?.error || e.message))
    }
  }

  function handleDosisChange(data) {
    // data = { condicion, usados (array) }
    setQuimicosUsados(data.usados || [])
  }

  function handleEditarCantidad(idx, nuevaCantidad) {
    const updated = [...quimicosUsados]
    updated[idx].cantidad = parseFloat(nuevaCantidad)
    setQuimicosUsados(updated)
  }

  function handleEliminarInsumo(idx) {
    setQuimicosUsados(quimicosUsados.filter((_, i) => i !== idx))
  }

  function handleAgregarInsumo(insumo) {
    // Evitar duplicados
    const exists = quimicosUsados.some(q => q.insumo_id === insumo.insumo_id)
    if (exists) {
      alert('Ese insumo ya está en la lista')
      return
    }
    setQuimicosUsados([...quimicosUsados, insumo])
  }

  async function guardarVisita() {
    if (!form.cliente_id) return alert('Seleccioná un cliente')
    if (cloro === '' && ph === '') return alert('Ingresá al menos una medición (cloro o pH)')
    setGuardando(true)
    try {
      const visita = {
        cliente_id: parseInt(form.cliente_id),
        fecha: form.fecha,
        hora_inicio: new Date().toISOString(),
        hora_fin: new Date().toISOString(),
        tareas_realizadas: tasks,
        cloro_ppm: cloro === '' ? null : parseFloat(cloro),
        ph: ph === '' ? null : parseFloat(ph),
        quimicos_usados: quimicosUsados,
        observaciones: form.observaciones,
      }
      const creada = await apiClient.createVisita(visita)
      await cargar()
      setVistaActual('historial')
      setExpandida(creada.id)
      // Reset form
      setForm({ cliente_id: '', fecha: today, observaciones: '' })
      setTasks([]); setCloro(''); setPh(''); setQuimicosUsados([])
      alert('✓ Visita registrada correctamente')
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message))
    } finally { setGuardando(false) }
  }

  const visitasHoy = visitas.filter(v => v.fecha === today)
  const visitasFiltradas = filtroFecha
    ? visitas.filter(v => v.fecha === filtroFecha)
    : visitas

  const clienteDelForm = clientes.find(c => c.id === parseInt(form.cliente_id))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header + tabs */}
      <div className="bg-white border-b sticky top-0 z-10 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl font-bold text-gray-900">🗓️ Visitas</h1>
          <button
            onClick={() => { setVistaActual('nueva'); setExpandida(null) }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded"
          >
            + Nueva visita
          </button>
        </div>
        <div className="flex gap-1">
          {[['agenda', '📅 Agenda hoy'], ['historial', '📋 Historial'], ['nueva', '✏️ Registrar']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setVistaActual(id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${vistaActual === id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading && <p className="text-gray-500">Cargando...</p>}
        {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>}

        {/* ── AGENDA DE HOY ── */}
        {!loading && vistaActual === 'agenda' && (
          <div>
            <p className="text-gray-500 mb-4">{formatFecha(today)} · {visitasHoy.length} visita(s) registrada(s)</p>
            {clientes.length === 0 ? (
              <p className="text-gray-400">No hay clientes cargados.</p>
            ) : (
              <div className="grid gap-3">
                {clientes.map(c => {
                  const visita = visitasHoy.find(v => v.cliente_id === c.id)
                  return (
                    <div key={c.id} className={`bg-white rounded-lg shadow-sm border p-4 flex items-center justify-between ${visita ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
                      <div>
                        <p className="font-bold text-gray-900">{c.nombre}</p>
                        <p className="text-sm text-gray-500">{c.direccion}</p>
                        {visita && (
                          <p className="text-sm text-green-700 mt-1">
                            ✓ Registrada · Cloro: {visita.cloro_ppm ?? '-'} ppm · pH: {visita.ph ?? '-'}
                          </p>
                        )}
                      </div>
                      {visita ? (
                        <button onClick={() => { setVistaActual('historial'); setExpandida(visita.id) }} className="text-sm text-blue-600 underline ml-4">Ver detalle</button>
                      ) : (
                        <button
                          onClick={() => { setVistaActual('nueva'); setForm(f => ({ ...f, cliente_id: String(c.id) })) }}
                          className="ml-4 px-3 py-1.5 bg-blue-600 text-white rounded font-medium text-sm"
                        >
                          Registrar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {!loading && vistaActual === 'historial' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <input
                type="date"
                value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
              {filtroFecha && <button onClick={() => setFiltroFecha('')} className="text-sm text-gray-500 underline">Ver todas</button>}
              <span className="text-sm text-gray-400">{visitasFiltradas.length} visita(s)</span>
            </div>

            {visitasFiltradas.length === 0 ? (
              <p className="text-gray-400">No hay visitas registradas aún.</p>
            ) : (
              <div className="space-y-2">
                {visitasFiltradas.map(v => {
                  const tareas = parseTareas(v.tareas_realizadas)
                  const quim = parseQuimicos(v.quimicos_usados)
                  const isOpen = expandida === v.id
                  return (
                    <div key={v.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setExpandida(isOpen ? null : v.id)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-bold text-gray-900">{v.cliente_nombre || `Cliente #${v.cliente_id}`}</p>
                          <p className="text-sm text-gray-500">{formatFecha(v.fecha)} · Cloro: {v.cloro_ppm ?? '-'} ppm · pH: {v.ph ?? '-'}</p>
                        </div>
                        <span className="text-gray-400 ml-4">{isOpen ? '▲' : '▼'}</span>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                          <div className="grid grid-cols-2 gap-6 mb-4">
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Mediciones</p>
                              <p>Cloro: <strong>{v.cloro_ppm ?? '-'} ppm</strong></p>
                              <p>pH: <strong>{v.ph ?? '-'}</strong></p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Tareas ({tareas.length})</p>
                              {tareas.map(t => <p key={t} className="text-sm">✓ {TASK_LABELS[t] || t}</p>)}
                              {tareas.length === 0 && <p className="text-sm text-gray-400">No registradas</p>}
                            </div>
                          </div>

                          {quim && quim.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Químicos aplicados</p>
                              <p className="text-sm text-gray-700">{quimicosTexto(quim)}</p>
                            </div>
                          )}

                          {v.observaciones && (
                            <div className="mb-4">
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
                              <p className="text-sm text-gray-700">{v.observaciones}</p>
                            </div>
                          )}

                          <div className="flex gap-3 mt-2">
                            <button
                              onClick={() => navigate('/reporte', { state: { visita: v } })}
                              className="px-4 py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700"
                            >
                              📄 Ver informe / PDF
                            </button>
                            <button
                              onClick={() => eliminarVisita(v.id)}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded font-medium text-sm hover:bg-red-100"
                            >
                              ✕ Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── NUEVA VISITA ── */}
        {vistaActual === 'nueva' && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Registrar visita</h2>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <select
                    value={form.cliente_id}
                    onChange={e => {
                      setForm(f => ({ ...f, cliente_id: e.target.value }))
                      setClienteSeleccionado(clientes.find(c => c.id === parseInt(e.target.value)) || null)
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Seleccionar...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              </div>

              <TaskChecklist tasks={tasks} onChange={setTasks} />
              <WaterMeasurement cloro={cloro} ph={ph} onChange={(k, v) => { if (k === 'cloro') setCloro(v); else setPh(v) }} />
              <DosisCalculadora
                volumenLitros={clienteDelForm?.volumen_litros}
                cloroActual={cloro}
                phActual={ph}
                onChange={handleDosisChange}
              />

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows="3"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Estado del agua, novedades, etc."
                />
              </div>

              {/* Lo que usaste (unificado) */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200 mb-6">
                <h3 className="text-sm font-bold text-blue-900 mb-3">Lo que usaste</h3>
                {quimicosUsados.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin insumos agregados aún</p>
                ) : (
                  <div className="space-y-3">
                    {quimicosUsados.map((insumo) => (
                      <div key={insumo.insumo_id} className="flex gap-3 items-center bg-white p-3 rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">{insumo.nombre}</p>
                          <div className="flex gap-2 items-center mt-1">
                            <input
                              type="number"
                              step="0.01"
                              value={insumo.cantidad}
                              onChange={(e) => {
                                const idx = quimicosUsados.findIndex(q => q.insumo_id === insumo.insumo_id)
                                handleEditarCantidad(idx, e.target.value)
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <span className="text-xs text-gray-500">{insumo.unidad}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = quimicosUsados.findIndex(q => q.insumo_id === insumo.insumo_id)
                            handleEliminarInsumo(idx)
                          }}
                          className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          ✕ Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agregar otro insumo */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                <p className="text-xs font-semibold text-gray-700 mb-3">Agregar otro insumo</p>
                <SelectorInsumo onAgregarInsumo={handleAgregarInsumo} />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={guardarVisita}
                disabled={guardando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '✅ Guardar visita'}
              </button>
              <button onClick={() => setVistaActual('agenda')} className="px-6 bg-gray-200 text-gray-700 font-bold py-3 rounded">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
