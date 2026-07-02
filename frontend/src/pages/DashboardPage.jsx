import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api.js'

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function mesActual() {
  return new Date().toISOString().slice(0, 7)
}

function formatFechaCorta(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatHora(isoStr) {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function formatCurrency(n) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function diasRestantesMes() {
  const ahora = new Date()
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
  return fin.getDate() - ahora.getDate()
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [clientes, setClientes] = useState([])
  const [visitas, setVisitas] = useState([])
  const [pagos, setPagos] = useState([])

  async function cargar() {
    try {
      setLoading(true); setError(null)
      const [cs, vs, ps] = await Promise.all([
        apiClient.getClientes(),
        apiClient.getVisitas(),
        apiClient.getPagos(),
      ])
      setClientes(cs)
      setVisitas(vs)
      setPagos(ps)
    } catch {
      setError('No se pudo conectar al servidor.')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const today = hoy()
  const mes = mesActual()

  const visitasHoy = visitas.filter(v => v.fecha === today)
  const visitasMes = visitas.filter(v => v.fecha?.startsWith(mes))
  const ultimasVisitas = visitas.slice(0, 8)

  const pagosMes = pagos.filter(p => p.fecha?.startsWith(mes))
  const cobradoMes = pagosMes.reduce((s, p) => s + (p.monto || 0), 0)

  const clientesConPrecio = clientes.filter(c => c.precio_abono > 0)
  const esperadoMes = clientesConPrecio.reduce((s, c) => s + (c.precio_abono || 0), 0)
  const pendienteMes = Math.max(0, esperadoMes - cobradoMes)

  const clientesPagaron = new Set(pagosMes.map(p => p.cliente_id))
  const clientesDeben = clientesConPrecio.filter(c => !clientesPagaron.has(c.id))

  const mesNombre = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const fechaHoyLarga = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 capitalize">{fechaHoyLarga}</p>
        <h1 className="text-3xl font-black text-gray-900">Panel principal</h1>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={cargar} className="underline text-sm">Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando...</div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { emoji: '👥', value: clientes.length, label: 'Clientes activos', color: 'bg-sky-500', num: 'text-gray-900' },
              { emoji: '✅', value: visitasMes.length, label: `Visitas en ${mesNombre}`, color: 'bg-violet-500', num: 'text-violet-700' },
              { emoji: '💰', value: formatCurrency(cobradoMes), label: `Cobrado ${mesNombre}`, color: 'bg-green-500', num: 'text-green-700' },
              {
                emoji: pendienteMes > 0 ? '⏳' : '🎉',
                value: formatCurrency(pendienteMes),
                label: 'Pendiente cobro',
                color: pendienteMes > 0 ? 'bg-red-500' : 'bg-gray-300',
                num: pendienteMes > 0 ? 'text-red-600' : 'text-gray-400',
              },
            ].map(({ emoji, value, label, color, num }) => (
              <div key={label} className="bg-white rounded-xl shadow-card overflow-hidden">
                <div className={`h-1 ${color}`} />
                <div className="p-5">
                  <p className="text-2xl mb-2">{emoji}</p>
                  <p className={`text-3xl font-black ${num}`}>{value}</p>
                  <p className="text-sm text-gray-500 mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna principal: visitas */}
            <div className="lg:col-span-2 space-y-6">

              {/* Visitas de hoy */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Visitas hoy
                    {visitasHoy.length > 0 && (
                      <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{visitasHoy.length}</span>
                    )}
                  </h2>
                </div>
                {visitasHoy.length === 0 ? (
                  <p className="text-gray-400 text-sm">No hay visitas registradas para hoy.</p>
                ) : (
                  <div className="space-y-2">
                    {visitasHoy.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div>
                          <p className="font-bold text-gray-900">{v.cliente_nombre}</p>
                          <p className="text-xs text-gray-500">{v.cliente_direccion}</p>
                          {v.hora_inicio && <p className="text-xs text-blue-600 mt-0.5">🕐 {formatHora(v.hora_inicio)}</p>}
                        </div>
                        <button onClick={() => navigate('/reporte', { state: { visita: v } })}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-medium hover:bg-blue-700">
                          Ver reporte
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Últimas visitas */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Últimas visitas</h2>
                  <button onClick={() => navigate('/visitas')} className="text-sm text-blue-600 hover:underline">Ver todas →</button>
                </div>
                {ultimasVisitas.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin visitas registradas.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {ultimasVisitas.map(v => (
                      <div key={v.id} className="flex items-center justify-between py-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{v.cliente_nombre}</p>
                          <p className="text-xs text-gray-400">{v.cliente_direccion}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-sm text-gray-600 font-medium">{formatFechaCorta(v.fecha)}</p>
                          {v.hora_inicio && <p className="text-xs text-gray-400">{formatHora(v.hora_inicio)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Columna lateral: finanzas */}
            <div className="space-y-6">
              {/* Resumen del mes */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Cobros — {mesNombre}</h2>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Esperado</span>
                    <span className="font-bold text-gray-700">{formatCurrency(esperadoMes)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cobrado</span>
                    <span className="font-bold text-green-700">{formatCurrency(cobradoMes)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm">
                    <span className="text-gray-500">Pendiente</span>
                    <span className={`font-black ${pendienteMes > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(pendienteMes)}</span>
                  </div>
                </div>
                {esperadoMes > 0 && (
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round(cobradoMes / esperadoMes * 100))}%` }} />
                  </div>
                )}
                {esperadoMes > 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-right">
                    {Math.min(100, Math.round(cobradoMes / esperadoMes * 100))}% cobrado · {diasRestantesMes()} días restantes
                  </p>
                )}
                <button onClick={() => navigate('/finance')} className="w-full mt-4 text-sm text-blue-600 hover:underline text-center block">
                  Ir a Finanzas →
                </button>
              </div>

              {/* Clientes que deben */}
              {clientesDeben.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">
                    Deben pagar
                    <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{clientesDeben.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {clientesDeben.slice(0, 6).map(c => (
                      <div key={c.id} className="flex items-center justify-between">
                        <p className="text-sm text-gray-800 font-medium truncate flex-1">{c.nombre}</p>
                        <p className="text-sm font-bold text-red-600 ml-2 shrink-0">{formatCurrency(c.precio_abono)}</p>
                      </div>
                    ))}
                    {clientesDeben.length > 6 && (
                      <p className="text-xs text-gray-400">+{clientesDeben.length - 6} más</p>
                    )}
                  </div>
                </div>
              )}

              {/* Accesos rápidos */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-base font-bold text-gray-900 mb-3">Accesos rápidos</h2>
                <div className="space-y-2">
                  <button onClick={() => navigate('/clients')}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                    👥 Gestionar clientes
                  </button>
                  <button onClick={() => navigate('/visitas')}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                    📋 Ver todas las visitas
                  </button>
                  <button onClick={() => navigate('/finance')}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                    💰 Finanzas
                  </button>
                  <button onClick={() => navigate('/inventario')}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                    📦 Inventario
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
