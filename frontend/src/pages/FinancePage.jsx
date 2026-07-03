import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import { toastSuccess, toastError, toastOffline } from '../utils/toast'

const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getMesActual() {
  return new Date().toISOString().slice(0, 7)
}

function formatMesLargo(mesStr) {
  if (!mesStr) return ''
  const [year, month] = mesStr.split('-')
  return `${MESES_NOMBRE[parseInt(month) - 1]} ${year}`
}

// Compara un pago contra un mes seleccionado (YYYY-MM).
// Si el pago tiene campo "mes" (nombre del servicio), matchea por ese nombre + año aprox.
// Si no tiene "mes", usa la fecha del pago directamente.
function pagoMatchMes(pago, mesStr) {
  const [yearStr, mmStr] = mesStr.split('-')
  const selectedYear = parseInt(yearStr, 10)
  const mesNombre = MESES_NOMBRE[parseInt(mmStr, 10) - 1]
  if (pago.mes) {
    if (pago.mes.toLowerCase() !== mesNombre.toLowerCase()) return false
    // Aceptar pagos hechos dentro de un año del mes de servicio
    // (cubre casos como pagar enero en febrero, o diciembre en enero del año siguiente)
    const pagoYear = parseInt(pago.fecha?.slice(0, 4) || '0', 10)
    return pagoYear >= selectedYear - 1 && pagoYear <= selectedYear + 1
  }
  return pago.fecha?.startsWith(mesStr) ?? false
}

function formatFecha(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function FinancePage() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [pagos, setPagos] = useState([])
  const [gastos, setGastos] = useState([])
  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('mes')
  const [mes, setMes] = useState(getMesActual())
  const [modalCliente, setModalCliente] = useState(null)
  const [formPago, setFormPago] = useState({ monto: '', fecha: new Date().toISOString().split('T')[0], metodo_pago: 'efectivo', mes: '', tipo_abono: '' })
  const [extrasAbono, setExtrasAbono] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [showAumento, setShowAumento] = useState(false)
  const [pctAumento, setPctAumento] = useState('10')
  const [aplicandoAumento, setAplicandoAumento] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [formGasto, setFormGasto] = useState({ descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], categoria: 'productos' })
  const [guardandoGasto, setGuardandoGasto] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const [cs, ps, gs, vs] = await Promise.all([
        apiClient.getClientes(),
        apiClient.getPagos(),
        apiClient.getGastos(),
        apiClient.getVisitas(),
      ])
      setClientes(cs)
      setPagos(ps)
      setGastos(gs)
      setVisitas(vs || [])
    } catch { setError('No se pudo conectar al servidor.') }
    finally { setLoading(false) }
  }

  function abrirModal(cliente) {
    setModalCliente(cliente)
    setFormPago({
      monto: cliente.precio_abono ? String(cliente.precio_abono) : '',
      fecha: new Date().toISOString().split('T')[0],
      metodo_pago: 'efectivo',
      mes: '',
      tipo_abono: '',
    })
    setExtrasAbono([])
  }

  async function registrarPago() {
    const abonoMonto = parseFloat(formPago.monto)
    if (!abonoMonto || abonoMonto <= 0) return toastError('Ingresá un monto válido')
    const extrasValidos = extrasAbono.filter(e => e.descripcion.trim() && parseFloat(e.monto) > 0)
    const extrasTotal = extrasValidos.reduce((s, e) => s + parseFloat(e.monto), 0)
    const montoTotal = abonoMonto + extrasTotal
    setGuardando(true)
    try {
      const pago = await apiClient.createPago({
        cliente_id: modalCliente.id,
        monto: montoTotal,
        fecha: formPago.fecha,
        metodo_pago: formPago.metodo_pago,
        estado: 'pagado',
        mes: formPago.mes || null,
        tipo_abono: formPago.tipo_abono || null,
      })
      await cargar()
      setModalCliente(null)
      navigate('/recibo', {
        state: {
          pago: {
            ...pago,
            cliente_nombre: modalCliente.nombre,
            cliente_direccion: modalCliente.direccion,
            abonoMonto,
            extras: extrasValidos,
          },
          cliente: modalCliente,
        },
      })
    } catch (e) {
      if (e.sinConexion) {
        const q = JSON.parse(localStorage.getItem('piletero_q_pagos') || '[]')
        q.push({
          cliente_id: modalCliente.id,
          monto: montoTotal,
          fecha: formPago.fecha,
          metodo_pago: formPago.metodo_pago,
          estado: 'pagado',
          mes: formPago.mes || null,
          tipo_abono: formPago.tipo_abono || null,
          timestamp: Date.now(),
        })
        localStorage.setItem('piletero_q_pagos', JSON.stringify(q))
        setModalCliente(null)
        toastOffline(`Pago de $${montoTotal} guardado offline\nSe registrará cuando vuelvas a conectar`)
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

  async function registrarGasto() {
    const monto = parseFloat(formGasto.monto)
    if (!formGasto.descripcion || !monto || monto <= 0) return toastError('Completá descripción y monto')
    setGuardandoGasto(true)
    try {
      await apiClient.createGasto({ ...formGasto, monto })
      await cargar()
      setModalGasto(false)
      setFormGasto({ descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], categoria: 'productos' })
      toastSuccess('Gasto registrado')
    } catch { toastError('Error al registrar el gasto') }
    finally { setGuardandoGasto(false) }
  }

  async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    try { await apiClient.deleteGasto(id); await cargar() }
    catch { toastError('No se pudo eliminar') }
  }

  function getExtrasTotal(mesStr) {
    return visitas
      .filter(v => v.fecha?.startsWith(mesStr))
      .reduce((sum, v) => {
        try {
          const extr = Array.isArray(v.extras) ? v.extras : JSON.parse(v.extras || '[]')
          return sum + extr.reduce((s, e) => s + (e.monto || 0), 0)
        } catch { return sum }
      }, 0)
  }

  const esMesActual = mes === getMesActual()

  const clientesActivos = clientes.filter(c => {
    if (c.activo === 0) return false
    if (c.fecha_inicio && mes && c.fecha_inicio > mes) return false
    // Si tiene fecha de fin y está suspendido, excluir de meses posteriores al fin
    if (c.fecha_fin && mes && mes > c.fecha_fin && c.estado === 'suspendido') return false
    if (esMesActual && c.estado === 'suspendido') return false
    return true
  })

  const clientesConStatus = clientesActivos.map(c => {
    const pagosMes = pagos.filter(p => p.cliente_id === c.id && pagoMatchMes(p, mes))
    const totalPagado = pagosMes.reduce((s, p) => s + (p.monto || 0), 0)
    // Para meses anteriores, si el cliente ya pagó algo ese mes, no mostrar deuda
    // (evita negativos cuando hubo un aumento de precios posterior)
    const esperado = (!esMesActual && totalPagado > 0) ? totalPagado : (c.precio_abono || 0)
    const deuda = Math.max(0, esperado - totalPagado)
    return { ...c, pagosMes, totalPagado, esperado, deuda, pagado: esperado > 0 && deuda === 0, parcial: totalPagado > 0 && deuda > 0 }
  })

  const conPrecio = clientesConStatus.filter(c => c.esperado > 0)
  const totalEsperado = conPrecio.reduce((s, c) => s + c.esperado, 0)
  const totalCobrado = conPrecio.reduce((s, c) => s + Math.min(c.totalPagado, c.esperado), 0)
  const totalDeuda = conPrecio.reduce((s, c) => s + c.deuda, 0)
  const pagosFiltrados = mes ? pagos.filter(p => pagoMatchMes(p, mes) && clientesActivos.some(c => c.id === p.cliente_id)) : pagos.filter(p => clientesActivos.some(c => c.id === p.cliente_id))

  return (
    <div className="min-h-screen bg-sky-50 pb-24">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">Finanzas</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAumento(true)}
              className="text-xs bg-white/20 text-white font-bold px-3 py-2 rounded-xl">
              📈 Aumento
            </button>
            <button onClick={() => setModalGasto(true)}
              className="text-xs bg-white/20 text-white font-bold px-3 py-2 rounded-xl">
              + Gasto
            </button>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="bg-white/20 text-white rounded-xl border-0 px-2 py-2 text-sm focus:outline-none focus:bg-white/30" />
          </div>
        </div>
        <div className="flex gap-1">
          {[
            ['mes', formatMesLargo(mes)],
            ['gastos', 'Gastos'],
            ['historial', 'Historial'],
            ['anio', 'Año'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2 rounded-xl font-semibold text-sm transition-colors ${tab === id ? 'bg-white text-sky-700' : 'text-sky-100 hover:bg-white/20'}`}>
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

            {(() => {
              const gastosMes = gastos.filter(g => g.fecha?.startsWith(mes))
              const totalGastosMes = gastosMes.reduce((s, g) => s + (g.monto || 0), 0)
              const totalExtrasMes = getExtrasTotal(mes)
              const ganancia = totalCobrado + totalExtrasMes - totalGastosMes
              return (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {totalExtrasMes > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-3">
                      <p className="text-xs text-purple-500 uppercase tracking-wide mb-1">Extras</p>
                      <p className="text-base font-black text-purple-700">${totalExtrasMes.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-purple-300 mt-0.5">trabajos adicionales</p>
                    </div>
                  )}
                  <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-3">
                    <p className="text-xs text-orange-400 uppercase tracking-wide mb-1">Gastado</p>
                    <p className="text-base font-black text-orange-600">${totalGastosMes.toLocaleString('es-AR')}</p>
                    <p className="text-xs text-orange-300 mt-0.5">{gastosMes.length} gasto(s)</p>
                  </div>
                  <div className={`bg-white rounded-xl shadow-sm p-3 border ${ganancia >= 0 ? 'border-green-100' : 'border-red-100'} ${totalExtrasMes > 0 ? '' : 'col-start-2'}`}>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${ganancia >= 0 ? 'text-green-500' : 'text-red-400'}`}>Ganancia neta</p>
                    <p className={`text-base font-black ${ganancia >= 0 ? 'text-green-700' : 'text-red-600'}`}>${ganancia.toLocaleString('es-AR')}</p>
                  </div>
                </div>
              )
            })()}

            {/* Desglose de extras del mes */}
            {(() => {
              const visitasConExtras = visitas.filter(v => {
                if (!v.fecha?.startsWith(mes)) return false
                try {
                  const extr = Array.isArray(v.extras) ? v.extras : JSON.parse(v.extras || '[]')
                  return extr.some(e => e.monto > 0)
                } catch { return false }
              })
              if (visitasConExtras.length === 0) return null
              return (
                <div className="mb-4">
                  <p className="text-xs font-bold text-purple-500 uppercase tracking-wide mb-2">Detalle de extras</p>
                  <div className="space-y-1">
                    {visitasConExtras.map(v => {
                      const cliente = clientes.find(c => c.id === v.cliente_id)
                      const extr = Array.isArray(v.extras) ? v.extras : JSON.parse(v.extras || '[]')
                      return extr.filter(e => e.monto > 0).map((e, i) => (
                        <div key={`${v.id}-${i}`} className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{cliente?.nombre || `Cliente #${v.cliente_id}`}</p>
                            <p className="text-xs text-gray-500 truncate">{e.descripcion}</p>
                          </div>
                          <p className="text-sm font-bold text-purple-700 ml-3 shrink-0">${(e.monto || 0).toLocaleString('es-AR')}</p>
                        </div>
                      ))
                    })}
                  </div>
                </div>
              )
            })()}

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

        {!loading && tab === 'gastos' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              {gastos.filter(g => g.fecha?.startsWith(mes)).length} gasto(s) · {formatMesLargo(mes)}
            </p>
            {gastos.filter(g => g.fecha?.startsWith(mes)).length === 0 ? (
              <p className="text-gray-400">No hay gastos registrados en este período.</p>
            ) : (
              <div className="space-y-2">
                {gastos.filter(g => g.fecha?.startsWith(mes)).map(g => (
                  <div key={g.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-orange-400 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{g.descripcion}</p>
                      <p className="text-sm text-gray-500">{formatFecha(g.fecha)} · {g.categoria}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-black text-orange-600">${(g.monto || 0).toLocaleString('es-AR')}</p>
                      <button onClick={() => eliminarGasto(g.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-500 rounded text-sm font-medium hover:bg-red-100">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && tab === 'anio' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Resumen {mes.split('-')[0]}</p>
            {(() => {
              const anio = mes.split('-')[0]
              const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
              const filas = meses.map((label, i) => {
                const key = `${anio}-${String(i+1).padStart(2,'0')}`
                const pagosDelMes = pagos.filter(p => p.fecha?.startsWith(key))
                const pagosActivos = pagosDelMes.filter(p => clientesActivos.some(c => c.id === p.cliente_id))
                const cobrado = pagosActivos.reduce((s,p) => s+(p.monto||0), 0)
                const gastado = gastos.filter(g => g.fecha?.startsWith(key)).reduce((s,g) => s+(g.monto||0), 0)
                const extras = getExtrasTotal(key)
                return { label, cobrado, gastado, extras, ganancia: cobrado + extras - gastado }
              })
              const totalAnio = filas.reduce((s,f) => s + f.cobrado, 0)
              const gastoAnio = filas.reduce((s,f) => s + f.gastado, 0)
              return (
                <div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-white rounded-xl shadow-sm border border-green-100 p-3 text-center">
                      <p className="text-xs text-green-500 uppercase mb-1">Cobrado</p>
                      <p className="text-sm font-black text-green-700">${totalAnio.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-3 text-center">
                      <p className="text-xs text-orange-400 uppercase mb-1">Gastado</p>
                      <p className="text-sm font-black text-orange-600">${gastoAnio.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-3 text-center">
                      <p className="text-xs text-gray-400 uppercase mb-1">Neto</p>
                      <p className={`text-sm font-black ${totalAnio-gastoAnio >= 0 ? 'text-green-700' : 'text-red-600'}`}>${(totalAnio-gastoAnio).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {filas.map((f,i) => (
                      <div key={i} className={`flex items-center px-4 py-3 gap-4 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                        <span className="w-8 text-sm font-bold text-gray-500">{f.label}</span>
                        <div className="flex-1">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-2 bg-green-400 rounded-full" style={{ width: `${totalAnio > 0 ? Math.min(100, (f.cobrado/totalAnio)*100*12) : 0}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-green-700 w-24 text-right">${f.cobrado.toLocaleString('es-AR')}</span>
                        <span className={`text-xs w-20 text-right ${f.ganancia >= 0 ? 'text-gray-400' : 'text-red-500'}`}>
                          {f.cobrado > 0 || f.gastado > 0 ? `neto $${f.ganancia.toLocaleString('es-AR')}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mes (opcional)</label>
                <select value={formPago.mes}
                  onChange={e => setFormPago(f => ({ ...f, mes: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="">— Seleccionar mes —</option>
                  <option value="Enero">Enero</option>
                  <option value="Febrero">Febrero</option>
                  <option value="Marzo">Marzo</option>
                  <option value="Abril">Abril</option>
                  <option value="Mayo">Mayo</option>
                  <option value="Junio">Junio</option>
                  <option value="Julio">Julio</option>
                  <option value="Agosto">Agosto</option>
                  <option value="Septiembre">Septiembre</option>
                  <option value="Octubre">Octubre</option>
                  <option value="Noviembre">Noviembre</option>
                  <option value="Diciembre">Diciembre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de abono (opcional)</label>
                <select value={formPago.tipo_abono}
                  onChange={e => setFormPago(f => ({ ...f, tipo_abono: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="">— Seleccionar tipo —</option>
                  <option value="Mano de obra">Mano de obra</option>
                  <option value="Todo incluido">Todo incluido</option>
                  <option value="Eventual">Eventual</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {/* Extras */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Extras (opcional)</label>
                  <button type="button"
                    onClick={() => setExtrasAbono(prev => [...prev, { descripcion: '', monto: '' }])}
                    className="text-xs text-blue-600 font-semibold hover:underline">
                    + Agregar extra
                  </button>
                </div>
                {extrasAbono.map((ex, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Descripción (ej: Boya pastillas)"
                      value={ex.descripcion}
                      onChange={e => setExtrasAbono(prev => prev.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="$"
                      value={ex.monto}
                      onChange={e => setExtrasAbono(prev => prev.map((x, j) => j === i ? { ...x, monto: e.target.value } : x))}
                      className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                    <button type="button"
                      onClick={() => setExtrasAbono(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 px-1 text-lg leading-none">✕</button>
                  </div>
                ))}
                {extrasAbono.filter(e => e.descripcion.trim() && parseFloat(e.monto) > 0).length > 0 && (
                  <div className="mt-2 p-3 bg-sky-50 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Abono:</span>
                      <span>${parseFloat(formPago.monto || 0).toLocaleString('es-AR')}</span>
                    </div>
                    {extrasAbono.filter(e => e.descripcion.trim() && parseFloat(e.monto) > 0).map((e, i) => (
                      <div key={i} className="flex justify-between text-gray-600">
                        <span>{e.descripcion}:</span>
                        <span>${parseFloat(e.monto).toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-gray-900 border-t border-sky-200 pt-1 mt-1">
                      <span>Total:</span>
                      <span>${(parseFloat(formPago.monto || 0) + extrasAbono.filter(e => e.descripcion.trim() && parseFloat(e.monto) > 0).reduce((s, e) => s + parseFloat(e.monto), 0)).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                )}
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

      {/* Modal de nuevo gasto */}
      {modalGasto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Registrar gasto</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <input type="text" value={formGasto.descripcion}
                  onChange={e => setFormGasto(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Cloro granulado 25kg"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-orange-400"
                  autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
                <input type="number" value={formGasto.monto}
                  onChange={e => setFormGasto(f => ({ ...f, monto: e.target.value }))}
                  placeholder="Ej: 8500"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-xl font-bold focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select value={formGasto.categoria}
                  onChange={e => setFormGasto(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2">
                  <option value="productos">Productos químicos</option>
                  <option value="combustible">Combustible</option>
                  <option value="herramientas">Herramientas</option>
                  <option value="otros">Otros</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" value={formGasto.fecha}
                  onChange={e => setFormGasto(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={registrarGasto} disabled={guardandoGasto}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded disabled:opacity-50">
                {guardandoGasto ? 'Guardando...' : '✓ Registrar gasto'}
              </button>
              <button onClick={() => setModalGasto(false)}
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
