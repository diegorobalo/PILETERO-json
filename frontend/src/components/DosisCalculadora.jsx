import { useState, useEffect } from 'react'

const CONDICIONES = [
  { id: 'cristalina', emoji: '💎', label: 'Cristalina', desc: 'Agua transparente' },
  { id: 'turbia_leve', emoji: '🌫️', label: 'Algo turbia', desc: 'Ligeramente opaca' },
  { id: 'turbia', emoji: '☁️', label: 'Turbia', desc: 'No se ve el fondo' },
  { id: 'verde', emoji: '🟢', label: 'Verde/Algas', desc: 'Presencia de algas' },
]

function calcularDosis(volumenLitros, cloroActual, phActual, condicion) {
  const vol = parseFloat(volumenLitros) || 0
  const cloro = parseFloat(cloroActual)
  const ph = parseFloat(phActual)

  if (!vol) return null

  const TARGET_CLORO = condicion === 'verde' ? 10 : 2.0
  const deficitCloro = isNaN(cloro) ? TARGET_CLORO : Math.max(0, TARGET_CLORO - cloro)

  // Granular chlorine (65% active Ca-Hypochlorite)
  const cloroGranulado = Math.round(vol * deficitCloro / 650)

  // Liquid chlorine (10% Na-Hypochlorite)
  const cloroLiquido = Math.round(vol * deficitCloro / 100)

  // pH correction
  let phMas = 0
  let phMenos = 0
  if (!isNaN(ph)) {
    if (ph < 7.2) {
      phMas = Math.round(vol * (7.4 - ph) * 5) // g of pH+
    } else if (ph > 7.6) {
      phMenos = Math.round(vol * (ph - 7.4) * 20) // ml of pH-
    }
  }

  // Algaecide
  let algicida = 0
  if (condicion === 'verde') algicida = Math.round(vol / 25)
  else if (condicion !== 'cristalina') algicida = Math.round(vol / 50)

  // Floculante/clarifier
  let floculante = 0
  if (condicion === 'turbia') floculante = Math.round(vol / 100)
  else if (condicion === 'turbia_leve') floculante = Math.round(vol / 200)

  return { cloroGranulado, cloroLiquido, phMas, phMenos, algicida, floculante, deficitCloro, TARGET_CLORO }
}

export default function DosisCalculadora({ volumenLitros, cloroActual, phActual, onChange }) {
  const [condicion, setCondicion] = useState('cristalina')
  const [usados, setUsados] = useState([])

  const dosis = calcularDosis(volumenLitros, cloroActual, phActual, condicion)

  // Pre-fill "usados" con sugerencias como array
  useEffect(() => {
    if (!dosis) {
      setUsados([])
      return
    }

    const sugerencias = []

    if (dosis.cloroGranulado > 0) {
      sugerencias.push({
        insumo_id: 1,
        nombre: 'Cloro Granulado',
        cantidad: dosis.cloroGranulado,
        unidad: 'g',
      })
    }
    if (dosis.cloroLiquido > 0) {
      sugerencias.push({
        insumo_id: 2,
        nombre: 'Cloro Líquido',
        cantidad: dosis.cloroLiquido,
        unidad: 'ml',
      })
    }
    if (dosis.phMas > 0) {
      sugerencias.push({
        insumo_id: 3,
        nombre: 'pH+',
        cantidad: dosis.phMas,
        unidad: 'g',
      })
    }
    if (dosis.phMenos > 0) {
      sugerencias.push({
        insumo_id: 4,
        nombre: 'pH−',
        cantidad: dosis.phMenos,
        unidad: 'ml',
      })
    }
    if (dosis.algicida > 0) {
      sugerencias.push({
        insumo_id: 5,
        nombre: 'Algicida',
        cantidad: dosis.algicida,
        unidad: 'ml',
      })
    }
    if (dosis.floculante > 0) {
      sugerencias.push({
        insumo_id: 6,
        nombre: 'Floculante',
        cantidad: dosis.floculante,
        unidad: 'ml',
      })
    }

    setUsados(sugerencias)
  }, [condicion, cloroActual, phActual, volumenLitros])

  useEffect(() => {
    if (onChange) onChange({ condicion, usados })
  }, [usados, condicion, onChange])

  const phOk = !isNaN(parseFloat(phActual)) && parseFloat(phActual) >= 7.2 && parseFloat(phActual) <= 7.6

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">🧪 Dosis de Químicos</h2>

      {/* Condición del agua */}
      <div className="mb-5">
        <p className="text-sm text-gray-600 mb-2 font-medium">Estado del agua:</p>
        <div className="grid grid-cols-2 gap-2">
          {CONDICIONES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCondicion(c.id)}
              className={`p-3 rounded-xl border-2 text-left transition-all active:scale-95 ${
                condicion === c.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="text-2xl mb-1">{c.emoji}</div>
              <div className="font-bold text-gray-900 text-sm">{c.label}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sugerencias */}
      {dosis && volumenLitros ? (
        <>
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-blue-800 mb-3">
              Sugerencias para {Number(volumenLitros).toLocaleString('es-AR')} L
              {condicion === 'verde' && ' — ⚠️ Tratamiento de choque'}:
            </p>

            <div className="space-y-2 text-sm">
              {/* Cloro */}
              {dosis.deficitCloro > 0 ? (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">🔵 Cloro granulado</span>
                  <span className="font-bold text-blue-900">{dosis.cloroGranulado} g</span>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">🔵 Cloro</span>
                  <span className="font-bold text-green-600">✓ OK</span>
                </div>
              )}

              {/* pH */}
              {dosis.phMas > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">🟠 pH+ (subir pH)</span>
                  <span className="font-bold text-orange-700">{dosis.phMas} g</span>
                </div>
              )}
              {dosis.phMenos > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">🟣 pH− (bajar pH)</span>
                  <span className="font-bold text-purple-700">{dosis.phMenos} ml</span>
                </div>
              )}
              {phOk && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">🟢 pH</span>
                  <span className="font-bold text-green-600">✓ OK ({phActual})</span>
                </div>
              )}

              {/* Algicida */}
              {dosis.algicida > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">🟤 Algicida</span>
                  <span className="font-bold text-amber-700">{dosis.algicida} ml</span>
                </div>
              )}

              {/* Floculante */}
              {dosis.floculante > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">⚪ Floculante</span>
                  <span className="font-bold text-gray-700">{dosis.floculante} ml</span>
                </div>
              )}
            </div>
          </div>

          {/* Sugerencias de DosisCalculadora (array dinámico) */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Lo que apliqué (editable):</p>
            <div className="space-y-3">
              {usados.length === 0 ? (
                <p className="text-xs text-gray-400">Sin sugerencias para esta condición</p>
              ) : (
                usados.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-center bg-blue-50 p-3 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">{item.nombre}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <input
                          type="number"
                          step="0.01"
                          value={item.cantidad}
                          onChange={(e) => {
                            const updated = [...usados]
                            updated[idx].cantidad = parseFloat(e.target.value)
                            setUsados(updated)
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm font-bold"
                        />
                        <span className="text-xs text-gray-500">{item.unidad}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUsados(usados.filter((_, i) => i !== idx))}
                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      ✕ Quitar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-500 text-sm">
          Completá el volumen de la pileta en el perfil del cliente para ver las dosis sugeridas.
        </div>
      )}
    </div>
  )
}
