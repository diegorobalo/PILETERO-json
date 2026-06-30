import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'

const UNIDADES = ['g', 'kg', 'ml', 'L', 'unidad']

const INSUMOS_DEFECTO = [
  { nombre: 'Cloro granulado', unidad: 'g', stock_actual: 0, stock_minimo: 500 },
  { nombre: 'Cloro líquido', unidad: 'ml', stock_actual: 0, stock_minimo: 2000 },
  { nombre: 'pH+', unidad: 'g', stock_actual: 0, stock_minimo: 300 },
  { nombre: 'pH−', unidad: 'ml', stock_actual: 0, stock_minimo: 500 },
  { nombre: 'Algicida', unidad: 'ml', stock_actual: 0, stock_minimo: 500 },
  { nombre: 'Floculante', unidad: 'ml', stock_actual: 0, stock_minimo: 500 },
]

function StockBar({ actual, minimo }) {
  if (!minimo) return null
  const pct = Math.min(100, Math.round((actual / minimo) * 100))
  const color = actual <= 0 ? 'bg-red-500' : actual < minimo ? 'bg-yellow-400' : 'bg-green-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function badge(actual, minimo) {
  if (actual <= 0) return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-bold">Sin stock</span>
  if (actual < minimo) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-bold">Stock bajo</span>
  return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-bold">OK</span>
}

export default function InventarioPage() {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [ajuste, setAjuste] = useState({ id: null, tipo: null, cantidad: '' })
  const [form, setForm] = useState({ nombre: '', unidad: 'g', stock_actual: '', stock_minimo: '', precio_unitario: '' })
  const [historialModal, setHistorialModal] = useState(null) // { insumo, movimientos }

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const lista = await apiClient.getInventario()
      setInsumos(lista)
    } catch { setError('No se pudo conectar al servidor.') }
    finally { setLoading(false) }
  }

  async function inicializarDefecto() {
    for (const ins of INSUMOS_DEFECTO) {
      try { await apiClient.createInsumo(ins) } catch {}
    }
    await cargar()
  }

  function abrirNuevo() {
    setForm({ nombre: '', unidad: 'g', stock_actual: '', stock_minimo: '', precio_unitario: '' })
    setEditando(null)
    setShowForm(true)
  }

  function abrirEditar(ins) {
    setForm({ nombre: ins.nombre, unidad: ins.unidad, stock_actual: ins.stock_actual, stock_minimo: ins.stock_minimo, precio_unitario: ins.precio_unitario || '' })
    setEditando(ins.id)
    setShowForm(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return alert('Nombre requerido')
    const data = { ...form, stock_actual: Number(form.stock_actual) || 0, stock_minimo: Number(form.stock_minimo) || 0, precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null }
    try {
      if (editando) await apiClient.updateInsumo(editando, data)
      else await apiClient.createInsumo(data)
      setShowForm(false); await cargar()
    } catch (e) { alert('Error: ' + e.message) }
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    try { await apiClient.deleteInsumo(id); await cargar() }
    catch (e) { alert('Error: ' + e.message) }
  }

  async function confirmarAjuste() {
    const cant = Number(ajuste.cantidad)
    if (!cant) return alert('Ingresá una cantidad')
    const delta = ajuste.tipo === 'agregar' ? cant : -cant
    try {
      await apiClient.ajustarStock(ajuste.id, delta)
      setAjuste({ id: null, tipo: null, cantidad: '' })
      await cargar()
    } catch (e) { alert('Error: ' + e.message) }
  }

  async function verHistorial(insumo) {
    try {
      const movs = await apiClient.getMovimientosInsumo(insumo.id)
      setHistorialModal({ insumo, movimientos: movs })
    } catch { alert('No se pudo cargar el historial') }
  }

  const alertas = insumos.filter(i => i.stock_actual < i.stock_minimo)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">📦 Inventario</h1>
          {alertas.length > 0 && (
            <p className="text-red-600 font-medium mt-1">⚠️ {alertas.length} insumo(s) con stock bajo o sin stock</p>
          )}
        </div>
        <button onClick={abrirNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded">
          + Nuevo insumo
        </button>
      </div>

      {loading && <p className="text-gray-500">Cargando...</p>}
      {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 mb-4">{error} <button onClick={cargar} className="underline ml-2">Reintentar</button></div>}

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">{editando ? 'Editar insumo' : 'Nuevo insumo'}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Ej: Cloro granulado" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
              <select value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2">
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock actual</label>
              <input type="number" value={form.stock_actual} onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo (alerta)</label>
              <input type="number" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio por {form.unidad || 'unidad'} ($)</label>
              <input type="number" value={form.precio_unitario} onChange={e => setForm(f => ({ ...f, precio_unitario: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2" placeholder="Opcional" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={guardar} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">Guardar</button>
            <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded">Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal ajuste de stock */}
      {ajuste.id && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">
              {ajuste.tipo === 'agregar' ? '➕ Agregar stock' : '➖ Registrar consumo'}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad ({insumos.find(i => i.id === ajuste.id)?.unidad})</label>
              <input
                type="number"
                value={ajuste.cantidad}
                onChange={e => setAjuste(a => ({ ...a, cantidad: e.target.value }))}
                className="w-full border-2 border-gray-300 rounded px-3 py-3 text-center text-2xl font-bold focus:border-blue-500 focus:outline-none"
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={confirmarAjuste} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg">Confirmar</button>
              <button onClick={() => setAjuste({ id: null, tipo: null, cantidad: '' })} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de insumos */}
      {!loading && !error && (
        <>
          {insumos.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-400 mb-4">No hay insumos cargados todavía.</p>
              <button onClick={inicializarDefecto} className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">
                Cargar insumos predeterminados
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Insumo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Stock actual</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Mínimo</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map(ins => (
                    <tr key={ins.id} className={`border-b hover:bg-gray-50 ${ins.stock_actual < ins.stock_minimo ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 font-medium text-gray-900">{ins.nombre}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-lg">{ins.stock_actual}</span>
                        <span className="text-gray-400 ml-1 text-sm">{ins.unidad}</span>
                        <StockBar actual={ins.stock_actual} minimo={ins.stock_minimo} />
                      </td>
                      <td className="px-6 py-4 text-gray-500">{ins.stock_minimo} {ins.unidad}</td>
                      <td className="px-6 py-4">{badge(ins.stock_actual, ins.stock_minimo)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => setAjuste({ id: ins.id, tipo: 'agregar', cantidad: '' })} className="px-3 py-1 bg-green-100 text-green-700 rounded font-medium text-sm hover:bg-green-200">+ Compré</button>
                          <button onClick={() => setAjuste({ id: ins.id, tipo: 'consumir', cantidad: '' })} className="px-3 py-1 bg-orange-100 text-orange-700 rounded font-medium text-sm hover:bg-orange-200">− Usé</button>
                          <button onClick={() => abrirEditar(ins)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200">Editar</button>
                          <button onClick={() => eliminar(ins.id, ins.nombre)} className="px-3 py-1 bg-red-100 text-red-700 rounded font-medium text-sm hover:bg-red-200">Borrar</button>
                          <button onClick={() => verHistorial(ins)} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Historial</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal historial de movimientos */}
      {historialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Historial — {historialModal.insumo.nombre}</h2>
              <button onClick={() => setHistorialModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {historialModal.movimientos.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin movimientos registrados.</p>
            ) : (
              <div className="overflow-y-auto space-y-2">
                {historialModal.movimientos.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${
                        m.tipo === 'compra' ? 'bg-green-100 text-green-700' :
                        m.tipo === 'uso' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{m.tipo}</span>
                      <span className="text-sm text-gray-500">{m.fecha}</span>
                      {m.origen === 'visita' && m.referencia_id ? (
                        <a href={`/visita/${m.referencia_id}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline ml-2">
                          Usado en Visita #{m.referencia_id}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500 ml-2">· {m.origen}</span>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${m.cantidad > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.cantidad > 0 ? '+' : ''}{m.cantidad} {historialModal.insumo.unidad}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
