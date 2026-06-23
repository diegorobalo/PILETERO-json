const PRODUCTOS = [
  { nombre: 'Cloro granulado',  uso: 'Mantenimiento semanal',           base: 40,  unidad: 'g',  por: 10000 },
  { nombre: 'Cloro granulado',  uso: 'Shock (arranque / agua turbia)',   base: 150, unidad: 'g',  por: 10000 },
  { nombre: 'Alguicida',        uso: 'Mantenimiento semanal',           base: 50,  unidad: 'ml', por: 10000 },
  { nombre: 'Clarificante',     uso: 'Si el agua está turbia',          base: 50,  unidad: 'ml', por: 10000 },
]

function formatDosis(litros, base, unidad, por) {
  const cantidad = Math.round(litros / por * base)
  if (unidad === 'g' && cantidad >= 1000) return `${(cantidad / 1000).toFixed(1)} kg`
  if (unidad === 'ml' && cantidad >= 1000) return `${(cantidad / 1000).toFixed(2)} L`
  return `${cantidad} ${unidad}`
}

export default function DosisRecomendadas({ litros }) {
  const vol = parseFloat(litros)
  if (!vol || vol <= 0) return null

  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">
        Dosis recomendadas para {vol.toLocaleString('es-AR')} L
      </h3>
      <div className="space-y-2">
        {PRODUCTOS.map((p, i) => (
          <div key={i} className="flex items-start justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-gray-800">{p.nombre}</span>
              <span className="text-xs text-gray-500 ml-2">· {p.uso}</span>
            </div>
            <span className="text-sm font-bold text-blue-700 whitespace-nowrap">
              {formatDosis(vol, p.base, p.unidad, p.por)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Valores orientativos. Ajustar según pH y estado del agua.
      </p>
    </div>
  )
}
