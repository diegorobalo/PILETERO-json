import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'
import { toastSuccess, toastError, toastOffline } from '../utils/toast'

const CACHE_KEY = 'piletero_inventario_cache'

function colorStock(actual, minimo) {
  if (actual <= 0) return { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: '❌ Sin stock' }
  if (actual < minimo) return { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', label: '⚠️ Stock bajo' }
  return { bg: 'bg-white border-gray-100', badge: 'bg-green-100 text-green-700', label: '✓ OK' }
}

export default function MobileInventarioPage() {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({ nombre: '', unidad: 'g', stock_actual: '', stock_minimo: '', precio_unitario: '' })
  const [historialModal, setHistorialModal] = useState(null) // { insumo, movimientos }

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const data = await apiClient.getInventario()
      setInsumos(data)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]')
        setInsumos(cached)
        setError(cached.length > 0 ? 'Sin conexión — mostrando datos locales' : 'Sin conexión. ¿Está encendida la compu?')
      } catch {
        setError('Sin conexión. ¿Está encendida la compu?')
      }
    }
    finally { setLoading(false) }
  }

  async function confirmarAjuste() {
    const cant = Number(cantidad)
    if (!cant || cant <= 0) return toastError('Ingresá una cantidad válida')
    const delta = modal.tipo === 'agregar' ? cant : -cant
    try {
      await apiClient.ajustarStock(modal.insumo.id, delta)
      setModal(null); setCantidad('')
      await cargar()
    } catch (err) {
      if (err.sinConexion) {
        const q = JSON.parse(localStorage.getItem('piletero_q_stock') || '[]')
        q.push({ insumo_id: modal.insumo.id, delta, timestamp: Date.now() })
        localStorage.setItem('piletero_q_stock', JSON.stringify(q))
        setInsumos(prev => prev.map(i =>
          i.id === modal.insumo.id ? { ...i, stock_actual: i.stock_actual + delta } : i
        ))
        setModal(null); setCantidad('')
        toastOffline('Guardado offline\nSe sincronizará cuando vuelvas a conectar')
      } else {
        toastError('Error al actualizar stock')
      }
    }
  }

  async function guardarNuevo() {
    if (!nuevoForm.nombre.trim()) return toastError('Escribí el nombre del insumo')
    try {
      await apiClient.createInsumo({
        ...nuevoForm,
        stock_actual: Number(nuevoForm.stock_actual) || 0,
        stock_minimo: Number(nuevoForm.stock_minimo) || 0,
        precio_unitario: nuevoForm.precio_unitario ? Number(nuevoForm.precio_unitario) : null,
      })
      setShowNuevo(false)
      setNuevoForm({ nombre: '', unidad: 'g', stock_actual: '', stock_minimo: '', precio_unitario: '' })
      await cargar()
      toastSuccess('Insumo creado')
    } catch (err) {
      toastError(err.sinConexion ? 'Sin conexión — creá el insumo cuando vuelvas a conectar' : 'Error al crear insumo')
    }
  }

  async function verHistorial(insumo) {
    try {
      const movs = await apiClient.getMovimientosInsumo(insumo.id)
      setHistorialModal({ insumo, movimientos: movs })
    } catch { toastError('No se pudo cargar el historial') }
  }

  const alertas = insumos.filter(i => i.stock_actual < i.stock_minimo)

  if (showNuevo) {
    return (
      <div className="min-h-screen bg-sky-50 pb-24">
        <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 py-4 flex items-center gap-3">
          <button onClick={() => setShowNuevo(false)} className="text-white/80 text-lg font-medium">← Volver</button>
          <h1 className="text-xl font-bold text-white">Nuevo insumo</h1>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={nuevoForm.nombre} onChange={e => setNuevoForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Cloro granulado"
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
            <select value={nuevoForm.unidad} onChange={e => setNuevoForm(f => ({ ...f, unidad: e.target.value }))}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3">
              {['g', 'kg', 'ml', 'L', 'unidad'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock inicial</label>
            <input type="number" value={nuevoForm.stock_actual}
              onChange={e => setNuevoForm(f => ({ ...f, stock_actual: e.target.value }))}
              placeholder="0"
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-bold focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alertar cuando quede menos de:</label>
            <input type="number" value={nuevoForm.stock_minimo}
              onChange={e => setNuevoForm(f => ({ ...f, stock_minimo: e.target.value }))}
              placeholder="0"
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-bold focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio por {nuevoForm.unidad === 'g' ? 'kg' : nuevoForm.unidad === 'ml' ? 'litro' : (nuevoForm.unidad || 'unidad')} ($)
            </label>
            <input type="number" value={nuevoForm.precio_unitario}
              onChange={e => setNuevoForm(f => ({ ...f, precio_unitario: e.target.value }))}
              placeholder="Opcional"
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-bold focus:border-blue-500 focus:outline-none" />
            {(nuevoForm.unidad === 'g' || nuevoForm.unidad === 'ml') && (
              <p className="text-xs text-gray-400 mt-1">
                Ej: si comprás 1 {nuevoForm.unidad === 'g' ? 'kilo' : 'litro'} por $5000, ingresá 5000
              </p>
            )}
          </div>
          <button onClick={guardarNuevo}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg mt-2">
            Guardar insumo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sky-50 pb-24">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Inventario</h1>
          <button onClick={() => setShowNuevo(true)}
            className="bg-white text-sky-700 font-bold py-2 px-4 rounded-xl text-sm">
            + Nuevo
          </button>
        </div>
        {alertas.length > 0 && (
          <p className="text-amber-200 text-sm font-medium mt-1">⚠ {alertas.length} insumo(s) con stock bajo</p>
        )}
      </div>

      <div className="p-4">
        {loading && <p className="text-center text-gray-500 py-12">Cargando...</p>}

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">{error}</p>
            <button onClick={cargar} className="text-yellow-700 underline text-sm mt-1">Reintentar</button>
          </div>
        )}

        {!loading && insumos.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 mb-2">No hay insumos cargados.</p>
            <p className="text-gray-400 text-sm mb-6">Cargalos desde la computadora o creá uno acá.</p>
            <button onClick={() => setShowNuevo(true)}
              className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl">
              + Agregar primer insumo
            </button>
          </div>
        )}

        {insumos.length > 0 && (
          <div className="space-y-3">
            {insumos.map(ins => {
              const col = colorStock(ins.stock_actual, ins.stock_minimo)
              return (
                <div key={ins.id} className={`rounded-xl border-2 ${col.bg} p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{ins.nombre}</p>
                      <p className="text-3xl font-black text-gray-800 mt-1">
                        {ins.stock_actual} <span className="text-sm font-normal text-gray-500">{ins.unidad}</span>
                      </p>
                      {ins.stock_minimo > 0 && (
                        <div className="mt-2">
                          <div className="bg-gray-200 rounded-full h-1.5 w-full">
                            <div
                              className={`rounded-full h-1.5 transition-[width] duration-500 ${
                                ins.stock_actual <= 0 ? 'bg-red-500' :
                                ins.stock_actual < ins.stock_minimo ? 'bg-amber-400' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, (ins.stock_actual / (ins.stock_minimo * 2)) * 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">Mínimo: {ins.stock_minimo} {ins.unidad}</p>
                        </div>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ml-3 flex-shrink-0 ${col.badge}`}>{col.label}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setModal({ insumo: ins, tipo: 'agregar' }); setCantidad('') }}
                      className="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-lg text-sm">
                      + Compré
                    </button>
                    <button onClick={() => { setModal({ insumo: ins, tipo: 'consumir' }); setCantidad('') }}
                      className="flex-1 py-2.5 bg-orange-500 text-white font-bold rounded-lg text-sm">
                      − Usé
                    </button>
                  </div>
                  <button onClick={() => verHistorial(ins)}
                    className="w-full mt-2 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Ver historial
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {modal.tipo === 'agregar' ? '+ Compré' : '− Usé'}
            </h3>
            <p className="text-gray-500 mb-4">{modal.insumo.nombre}</p>
            <div className="mb-6">
              <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
                placeholder="0" autoFocus
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-4 text-center text-4xl font-black text-gray-900 focus:border-blue-500 focus:outline-none" />
              <p className="text-center text-gray-400 mt-2">{modal.insumo.unidad}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmarAjuste}
                className={`flex-1 py-4 font-bold rounded-xl text-white text-lg ${
                  modal.tipo === 'agregar' ? 'bg-green-600' : 'bg-orange-500'
                }`}>
                Confirmar
              </button>
              <button onClick={() => { setModal(null); setCantidad('') }}
                className="flex-1 py-4 bg-gray-200 text-gray-700 font-bold rounded-xl text-lg">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <span className="text-sm text-gray-500">{m.fecha} · {m.origen}</span>
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
