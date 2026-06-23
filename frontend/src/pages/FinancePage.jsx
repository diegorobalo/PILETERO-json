import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import { toastSuccess, toastError, toastOffline } from '../utils/toast'

function getMesActual() {
  return new Date().toISOString().slice(0, 7)
}

function formatMesLargo(mesStr) {
  if (!mesStr) return ''
  const [year, month] = mesStr.split('-')
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${meses[parseInt(month) - 1]} ${year}`
}

function formatFecha(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function FinancePage() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('mes')
  const [mes, setMes] = useState(getMesActual())
  const [modalCliente, setModalCliente] = useState(null)
  const [formPago, setFormPago] = useState({ monto: '', fecha: new Date().toISOString().split('T')[0], metodo_pago: 'efectivo' })
  const [guardando, setGuardando] = useState(false)
  const [showAumento, setShowAumento] = useState(false)
  const [pctAumento, setPctAumento] = useState('10')
  const [aplicandoAumento, setAplicandoAumento] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const [cs, ps] = await Promise.all([apiClient.getClientes(), apiClient.getPagos()])
      setClientes(cs)
      setPagos(ps)
    } catch { setError('No se pudo conectar al servidor.') }
    finally { setLoading(false) }
  }

  function abrirModal(cliente) {
    setModalCliente(cliente)
    setFormPago({
      monto: cliente.precio_abono ? String(cliente.precio_abono) : '',
      fecha: new Date().toISOString().split('T')[0],
      metodo_pago: 'efectivo',
    })
  }

  async function registrarPago() {
    const monto = parseFloat(formPago.monto)
    if (!monto || monto <= 0) return toastError('Ingresá un monto válido')
    setGuardando(true)
    try {
      const pago = await apiClient.createPago({
        cliente_id: modalCliente.id,
        monto,
        fecha: formPago.fecha,
        metodo_pago: formPago.metodo_pago,
        estado: 'pagado',
      })
      await cargar()
      setModalCliente(null)
      navigate('/recibo', {
        state: {
          pago: { ...pago, cliente_nombre: modalCliente.nombre, cliente_direccion: modalCliente.direccion },
          cliente: modalCliente,
        },
      })
    } catch (e) {
      if (e.sinConexion) {
        // Guardar en cola offline
        const q = JSON.parse(localStorage.getItem('piletero_q_pagos') || '[]')
        q.push({
          cliente_id: modalCliente.id,
          monto,
          fecha: formPago.fecha,
          metodo_pago: formPago.metodo_pago,
          estado: 'pagado',
          timestamp: Date.now(),
        })
        localStorage.setItem('piletero_q_pagos', JSON.stringify(q))
        setModalCliente(null)
        toastOffline(`Pago de $${monto} guardado offline\nSe registrará cuando vuelvas a conectar`)
      } else {
        toastError('Error: ' + (e.response?.data?.error || e.message))
      }
    } finally { setGuardando(false) }
  }

  async function aplicarAumento() {
    const pct = parseFloat(pctAumento)
    if (!pct || pct === 0 || pct < -99 || pct > 200) return toastError('Ingresá un porcentaje válido (-99 a 200, sin cero)')
    const afectados = clientes.filter(c => c.precio_abono > 0)
    if (!confirm(`¿Aplicar +${pct}% a los precios de ${afectados.length} cliente(s)?`)) return
    setAplicandoAumento(true)
    try {
      const r = await apiClient.aumentoPreciosMasivo(pct)
      await cargar()
      setShowAumento(false)
      toastSuccess(`Se actualizaron ${r.updated} cliente(s) con ${pct > 0 ? '+' : ''}${pct}%`)
    } catch (e) {
      toastError('Error: ' + (e.response?.data?.error || e.message))
    } finally { setAplicandoAumento(false) }
  }

  async function eliminarPago(id) {
    if (!confirm('¿Eliminar este pago?')) return
    try {
      await apiClient.deletePago(id)
      await cargar()
    } catch { toastError('No se pudo eliminar el pago') }
  }

  const clientesConStatus = clientes.map(c => {
    const pagosMes = pagos.filter(p => p.cliente_id === c.id && p.fecha?.startsWith(mes))
    const totalPagado = pagosMes.reduce((s, p) => s + (p.monto || 0), 0)
    const esperado = c.precio_abono || 0
    const deuda = Math.max(0, esperado - totalPagado)
    return { ...c, pagosMes, totalPagado, esperado, deuda, pagado: esperado > 0 && deuda === 0, parcial: totalPagado > 0 && deuda > 0 }
  })

  const conPrecio = clientesConStatus.filter(c => c.esperado > 0)
  const totalEsperado = conPrecio.reduce((s, c) => s + c.esperado, 0)
  const totalCobrado = conPrecio.reduce((s, c) => s + Math.min(c.totalPagado, c.esperado), 0)
  const totalDeuda = conPrecio.reduce((s, c) => s + c.deuda, 0)
  const pagosFiltrados = mes ? pagos.filter(p => p.fecha?.startsWith(mes)) : pagos

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">Finanzas</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAumento(true)}
              className="text-xs bg-white/20 text-white font-bold px-3 py-2 rounded-xl">
              📈 Aumento
            </button>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="bg-white/20 text-white rounded-xl border-0 px-2 py-2 text-sm focus:outline-none focus:bg-white/30" />
          </div>
        </div>
        <div className="flex gap-1">
          {[['mes', formatMesLargo(mes)], ['historial', 'Historial']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === id ? 'bg-white text-sky-700' : 'text-sky-100 hover:bg-white/20'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading && <p className="text-gray-500">Cargando...</p>}
        {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 mb-4">{error}</div>}

        {!loading && tab === 'mes' && (
          <div>
            {/* Totales */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Esperado</p>
                <p className="text-base font-black text-gray-700">${totalEsperado.toLocaleString('es-AR')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{conPrecio.length} clientes</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-green-100 p-3">
                <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Cobrado</p>
                <p className="text-base font-black text-green-700">${totalCobrado.toLocaleString('es-AR')}</p>
                <p className="text-xs text-green-400 mt-0.5">{conPrecio.filter(c => c.pagado).length} pagaron</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-red-100 p-3">
                <p className="text-xs text-red-400 uppercase tracking-wide mb-1">Pendiente</p>
                <p className="text-base font-black text-red-600">${totalDeuda.toLocaleString('es-AR')}</p>
                <p className="text-xs text-red-300 mt-0.5">{conPrecio.filter(c => c.deuda > 0).length} deben</p>
              </div>
            </div>

            {/* Lista de clientes */}
            <div className="space-y-2">
              {clientesConStatus.map(c => (
                <div key={c.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 flex items-center justify-between ${
                  c.pagado ? 'border-l-green-500' :
                  c.parcial ? 'border-l-amber-400' :
                  c.esperado > 0 ? 'border-l-red-400' : 'border-l-gray-200'
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{c.nombre}</p>
                    <p className="text-sm text-gray-500">{c.direccion}</p>
                    {c.esperado > 0 ? (
                      <p className={`text-sm mt-1 font-medium ${c.pagado ? 'text-green-600' : c.parcial ? 'text-yellow-700' : 'text-red-600'}`}>
                        {c.pagado ? `✓ Pagó $${c.totalPagado.toLocaleString('es-AR')}` :
                         c.parcial ? `Pagó $${c.totalPagado.toLocaleString('es-AR')} · Debe $${c.deuda.toLocaleString('es-AR')}` :
                         `Debe $${c.esperado.toLocaleString('es-AR')}`}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Sin precio de abono</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                    {c.esperado > 0 && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.pagado ? 'bg-green-100 text-green-700' :
                        c.parcial ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {c.pagado ? 'Pagado' : c.parcial ? 'Parcial' : 'Pendiente'}
                      </span>
                    )}
                    <button onClick={() => abrirModal(c)}
                      className="px-3 py-2 bg-sky-600 text-white rounded-xl font-semibold text-sm active:bg-sky-700">
                      + Pago
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && tab === 'historial' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">{pagosFiltrados.length} pago(s) · {formatMesLargo(mes)}</p>
            {pagosFiltrados.length === 0 ? (
              <p className="text-gray-400">No hay pagos registrados en este período.</p>
            ) : (
              <div className="space-y-2">
                {pagosFiltrados.map(p => (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-green-400 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{p.cliente_nombre}</p>
                      <p className="text-sm text-gray-500">{formatFecha(p.fecha)} · {p.metodo_pago || 'Efectivo'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-black text-green-700">${(p.monto || 0).toLocaleString('es-AR')}</p>
                      <button
                        onClick={() => navigate('/recibo', { state: { pago: p, cliente: clientes.find(c => c.id === p.cliente_id) } })}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200">
                        📄 Recibo
                      </button>
                      <button onClick={() => eliminarPago(p.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-500 rounded text-sm font-medium hover:bg-red-100">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal aumento de precios */}
      {showAumento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Ajuste general de precios</h2>
            <p className="text-gray-500 text-sm mb-5">Positivo = aumento · Negativo = descuento. Se aplica a todos los clientes con precio de abono.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Porcentaje (%)</label>
              <div className="flex items-center gap-3">
                <input type="number" value={pctAumento} onChange={e => setPctAumento(e.target.value)}
                  min="-99" max="200" placeholder="Ej: 20 o -10"
                  className="flex-1 border border-gray-300 rounded px-3 py-3 text-2xl font-black focus:outline-none focus:border-orange-400 text-center"
                  autoFocus />
                <span className="text-2xl font-black text-gray-400">%</span>
              </div>
            </div>
            {parseFloat(pctAumento) > 0 && clientes.filter(c => c.precio_abono > 0).length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-5 text-sm">
                <p className="font-bold text-orange-700 mb-2">Vista previa ({clientes.filter(c => c.precio_abono > 0).length} clientes):</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {clientes.filter(c => c.precio_abono > 0).map(c => {
                    const nuevo = Math.round(c.precio_abono * (1 + parseFloat(pctAumento) / 100))
                    return (
                      <div key={c.id} className="flex justify-between text-xs">
                        <span className="text-gray-700 truncate flex-1">{c.nombre}</span>
                        <span className="ml-2 shrink-0 text-gray-500">${c.precio_abono.toLocaleString('es-AR')} → <strong className="text-orange-700">${nuevo.toLocaleString('es-AR')}</strong></span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={aplicarAumento} disabled={aplicandoAumento}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg disabled:opacity-50">
                {aplicandoAumento ? 'Aplicando...' : `✓ Aplicar ${parseFloat(pctAumento) > 0 ? '+' : ''}${pctAumento}%`}
              </button>
              <button onClick={() => setShowAumento(false)}
                className="px-5 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pago */}
      {modalCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Registrar pago</h2>
            <p className="text-gray-500 text-sm mb-5">{modalCliente.nombre}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
                <input type="number" value={formPago.monto}
                  onChange={e => setFormPago(f => ({ ...f, monto: e.target.value }))}
                  placeholder={modalCliente.precio_abono ? `Abono: $${modalCliente.precio_abono}` : 'Ej: 5000'}
                  className="w-full border border-gray-300 rounded px-3 py-3 text-xl font-bold focus:outline-none focus:border-blue-500"
                  autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" value={formPago.fecha}
                  onChange={e => setFormPago(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
                <select value={formPago.metodo_pago}
                  onChange={e => setFormPago(f => ({ ...f, metodo_pago: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="débito">Tarjeta débito</option>
                  <option value="crédito">Tarjeta crédito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={registrarPago} disabled={guardando}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded disabled:opacity-50">
                {guardando ? 'Guardando...' : '✓ Confirmar pago'}
              </button>
              <button onClick={() => setModalCliente(null)}
                className="px-5 bg-gray-200 text-gray-700 font-bold py-3 rounded">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
