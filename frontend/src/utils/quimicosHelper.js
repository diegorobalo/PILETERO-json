// Convierte formato viejo {cloroGranulado: 100} a array dinámico
export function parseQuimicos(raw) {
  if (!raw) return []

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw

    // Si ya es array, retorna como está
    if (Array.isArray(parsed)) return parsed

    // Si es objeto viejo, convierte
    const viejo = parsed
    const nuevo = []

    const MAPPING = {
      cloroGranulado: { id: 1, nombre: 'Cloro Granulado', unidad: 'g' },
      cloroLiquido: { id: 2, nombre: 'Cloro Líquido', unidad: 'ml' },
      phMas: { id: 3, nombre: 'pH+', unidad: 'g' },
      phMenos: { id: 4, nombre: 'pH−', unidad: 'ml' },
      algicida: { id: 5, nombre: 'Algicida', unidad: 'ml' },
      floculante: { id: 6, nombre: 'Floculante', unidad: 'ml' },
    }

    for (const [clave, info] of Object.entries(MAPPING)) {
      if (viejo[clave] && viejo[clave] > 0) {
        nuevo.push({
          insumo_id: info.id,
          nombre: info.nombre,
          cantidad: viejo[clave],
          unidad: info.unidad,
        })
      }
    }

    return nuevo
  } catch (e) {
    console.error('[quimicosHelper] parseQuimicos error:', e.message)
    return []
  }
}

// Convierte array dinámico a string legible
export function quimicosTexto(quimicos) {
  if (!quimicos || quimicos.length === 0) return '-'

  const parsed = parseQuimicos(quimicos)
  if (parsed.length === 0) return '-'

  return parsed
    .map(q => `${q.nombre}: ${q.cantidad}${q.unidad}`)
    .join(' · ')
}

// Para PDFs: retorna array de líneas de texto
export function quimicosLineas(quimicos) {
  const parsed = parseQuimicos(quimicos)
  if (parsed.length === 0) return []

  return parsed.map(q => `• ${q.nombre}: ${q.cantidad}${q.unidad}`)
}
