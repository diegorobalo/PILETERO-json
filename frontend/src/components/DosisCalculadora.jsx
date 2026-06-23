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
  const [usados, setUsados] = useState({
    cloroGranulado: '',
    cloroLiquido: '',
    phMas: '',
    phMenos: '',
    algicida: '',
    floculante: '',
    otros: '',
  })

  const dosis = calcularDosis(volumenLitros, cloroActual, phActual, condicion)

  // Pre-fill "usados" with suggestions whenever dosis changes
  useEffect(() => {
    if (!dosis) return
    setUsados({
      cloroGranulado: dosis.cloroGranulado > 0 ? String(dosis.cloroGranulado) : '',
      cloroLiquido: '',
      phMas: dosis.phMas > 0 ? String(dosis.phMas) : '',
      phMenos: dosis.phMenos > 0 ? String(dosis.phMenos) : '',
      algicida: dosis.algicida > 0 ? String(dosis.algicida) : '',
      floculante: dosis.floculante > 0 ? String(dosis.floculante) : '',
      otros: '',
    })
  }, [condicion, cloroActual, phActual, volumenLitros])

  useEffect(() => {
    if (onChange) onChange({ condicion, ...usados })
  }, [usados, condicion])

  const handleUsado = (field, value) => {
    const updated = { ...usados, [field]: value }
    setUsados(updated)
  }

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

          {/* Lo que apliqué */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Lo que apliqué (editable):</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-36 shrink-0">Cloro granulado</label>
                <input
                  type="number"
                  value={usados.cloroGranulado}
                  onChange={(e) => handleUsado('cloroGranulado', e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
                />
                <span className="text-sm text-gray-500 w-6">g</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-36 shrink-0">Cloro líquido</label>
                <input
                  type="number"
                  value={usados.cloroLiquido}
                  onChange={(e) => handleUsado('cloroLiquido', e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
                />
                <span className="text-sm text-gray-500 w-6">ml</span>
              </div>

              {(dosis.phMas > 0 || usados.phMas) && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-36 shrink-0">pH+</label>
                  <input
                    type="number"
                    value={usados.phMas}
                    onChange={(e) => handleUsado('phMas', e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
                  />
                  <span className="text-sm text-gray-500 w-6">g</span>
                </div>
              )}

              {(dosis.phMenos > 0 || usados.phMenos) && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-36 shrink-0">pH−</label>
                  <input
                    type="number"
                    value={usados.phMenos}
                    onChange={(e) => handleUsado('phMenos', e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
                  />
                  <span className="text-sm text-gray-500 w-6">ml</span>
                </div>
              )}

              {(dosis.algicida > 0 || usados.algicida) && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-36 shrink-0">Algicida</label>
                  <input
                    type="number"
                    value={usados.algicida}
                    onChange={(e) => handleUsado('algicida', e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
                  />
                  <span className="text-sm text-gray-500 w-6">ml</span>
                </div>
              )}

              {(dosis.floculante > 0 || usados.floculante) && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-36 shrink-0">Floculante</label>
                  <input
                    type="number"
                    value={usados.floculante}
                    onChange={(e) => handleUsado('floculante', e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold"
                  />
                  <span className="text-sm text-gray-500 w-6">ml</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-36 shrink-0">Otros</label>
                <input
                  type="text"
                  value={usados.otros}
                  onChange={(e) => handleUsado('otros', e.target.value)}
                  placeholder="ej: 200g de estabilizador"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
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
