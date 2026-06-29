# Insumos Dinámicos en Visitas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que Fede seleccione CUALQUIER insumo del inventario en una visita (no solo los 6 químicos hardcodeados), con sugerencias automáticas de DosisCalculadora pero libertad total de editar/agregar/eliminar.

**Architecture:** 
- DosisCalculadora genera array de sugerencias (en lugar de objeto fijo)
- Nuevo componente SelectorInsumo para agregar insumos dinámicamente
- Backend recibe array, descuenta stock automáticamente por cada insumo
- Backward-compat: visitas antiguas (formato viejo) se convierten transparentemente

**Tech Stack:** React, Node.js/Express, SQLite, Tailwind

---

## Task 1: Backend — parseQuimicos Helper + Validation

**Files:**
- Modify: `backend/services/database.js` (add helpers after line 150)

**Context:** Agregar dos helpers: uno que convierte formato viejo a nuevo (backward-compat), otro que valida stock sin bloquear.

- [ ] **Step 1: Add parseQuimicos helper to database.js**

Abre `backend/services/database.js` y agrega este helper después de la función `ajustarStock()`:

```javascript
  // Convierte formato viejo {cloroGranulado: 100, ...} a array dinámico
  // Si ya es array, retorna as-is. Backward-compatible para visitas antiguas.
  parseQuimicos(raw) {
    if (!raw) return []
    
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      
      // Si ya es array, retorna como está
      if (Array.isArray(parsed)) return parsed
      
      // Si es objeto viejo, convierte a array
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
      console.error('[database] parseQuimicos error:', e.message)
      return []
    }
  }
```

- [ ] **Step 2: Add validateInsumoStock helper to database.js**

Agrega este helper inmediatamente después de `parseQuimicos()`:

```javascript
  // Valida stock pero NO bloquea. Retorna {hasStock: bool, stockDisponible: number}
  validateInsumoStock(insumo_id, cantidad) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT stock FROM inventario WHERE id = ?'
      this.db.get(sql, [insumo_id], (err, row) => {
        if (err) return reject(err)
        if (!row) return resolve({ hasStock: false, stockDisponible: 0, error: 'Insumo no existe' })
        
        const hasStock = row.stock >= cantidad
        resolve({ hasStock, stockDisponible: row.stock })
      })
    })
  }
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add backend/services/database.js
git commit -m "feat: add parseQuimicos + validateInsumoStock helpers for dynamic insumos"
```

---

## Task 2: Backend — Adapt POST /api/visitas to Handle Dynamic Array

**Files:**
- Modify: `backend/server.js` (function createVisita, lines ~300-380)

**Context:** El endpoint POST /api/visitas recibe ahora `quimicos_usados` como array. Debe iterar cada insumo, descuentar stock, registrar movimientos, y validar sin bloquear.

- [ ] **Step 1: Read current POST /api/visitas route**

Lee `backend/server.js` sección POST /api/visitas para entender la estructura actual.

- [ ] **Step 2: Locate the quimicos_usados processing section**

Busca en el route donde se procesa `visita.quimicos_usados`. Hoy probablemente solo lo guarda. Vas a modificar esa sección.

- [ ] **Step 3: Replace quimicos processing with dynamic array handler**

Reemplaza la sección (busca algo como "guardar visita" o "createVisita") con este código:

```javascript
      // Procesar insumos dinámicos
      const quimicosArray = visita.quimicos_usados || []
      let warnings = []
      
      // Validar stock de cada insumo (sin bloquear)
      for (const insumo of quimicosArray) {
        const validation = await db.validateInsumoStock(insumo.insumo_id, insumo.cantidad)
        if (!validation.hasStock) {
          warnings.push(`Stock bajo: ${insumo.nombre} (disponible: ${validation.stockDisponible}${insumo.unidad})`)
        }
      }
      
      // Guardar visita (con el array tal cual)
      const createdVisita = await db.createVisita(visita)
      
      // Descontar stock de cada insumo (después de guardar, en paralelo)
      for (const insumo of quimicosArray) {
        try {
          await db.ajustarStock(insumo.insumo_id, -insumo.cantidad)
          await db.registrarMovimiento(
            insumo.insumo_id,
            'uso',
            -insumo.cantidad,
            'visita',
            createdVisita.id
          )
        } catch (e) {
          console.error(`[visitas] Error descuentando ${insumo.nombre}:`, e.message)
        }
      }
      
      // Responder con warnings si hubo stock bajo
      const response = { ...createdVisita, warnings }
      res.json(response)
```

- [ ] **Step 4: Test with curl/Postman**

Abre Postman o usa curl para hacer POST a `/api/visitas` con un array dinámico:

```json
{
  "cliente_id": 1,
  "fecha": "2026-06-25",
  "tareas_realizadas": ["limpiafondo"],
  "cloro_ppm": 2.5,
  "ph": 7.4,
  "quimicos_usados": [
    {"insumo_id": 1, "nombre": "Cloro Granulado", "cantidad": 100, "unidad": "g"},
    {"insumo_id": 6, "nombre": "Floculante", "cantidad": 150, "unidad": "ml"}
  ],
  "observaciones": ""
}
```

Esperado: 200 OK, visita guardada, stock descontado de ambos insumos.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add backend/server.js
git commit -m "feat: POST /api/visitas now handles dynamic insumo array, descuenta stock per insumo"
```

---

## Task 3: Frontend — Create SelectorInsumo Component

**Files:**
- Create: `frontend/src/components/SelectorInsumo.jsx`

**Context:** Nuevo componente pequeño que muestra un dropdown de insumos del inventario (excluyendo agua) + input de cantidad + botón agregar.

- [ ] **Step 1: Create the component file**

Crea `frontend/src/components/SelectorInsumo.jsx`:

```javascript
import { useState, useEffect } from 'react'
import { apiClient } from '../services/api'

export default function SelectorInsumo({ onAgregarInsumo }) {
  const [insumos, setInsumos] = useState([])
  const [seleccionado, setSeleccionado] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    cargarInsumos()
  }, [])

  async function cargarInsumos() {
    try {
      setLoading(true)
      const lista = await apiClient.getInventario()
      // Excluir agua
      const filtrada = lista.filter(i => i.nombre.toLowerCase() !== 'agua')
      setInsumos(filtrada)
    } catch (e) {
      setError('No se pudieron cargar insumos')
    } finally {
      setLoading(false)
    }
  }

  function handleAgregar() {
    if (!seleccionado || !cantidad) {
      alert('Seleccioná insumo y cantidad')
      return
    }

    const insumo = insumos.find(i => i.id === parseInt(seleccionado))
    if (!insumo) return

    onAgregarInsumo({
      insumo_id: insumo.id,
      nombre: insumo.nombre,
      cantidad: parseFloat(cantidad),
      unidad: insumo.unidad || 'g',
    })

    setSeleccionado('')
    setCantidad('')
  }

  if (loading) return <div className="text-sm text-gray-400">Cargando insumos...</div>
  if (error) return <div className="text-sm text-red-500">{error}</div>

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-xs text-gray-500 uppercase">Insumo</label>
        <select
          value={seleccionado}
          onChange={(e) => setSeleccionado(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="">-- Seleccioná insumo --</option>
          {insumos.map(i => (
            <option key={i.id} value={i.id}>
              {i.nombre} ({i.stock}{i.unidad || 'g'} disponible)
            </option>
          ))}
        </select>
      </div>

      <div className="w-32">
        <label className="text-xs text-gray-500 uppercase">
          Cantidad {seleccionado && `(${insumos.find(i => i.id === parseInt(seleccionado))?.unidad || 'g'})`}
        </label>
        <input
          type="number"
          step="0.01"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      <button
        onClick={handleAgregar}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
      >
        Agregar
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Test import in browser console (optional)**

Abre `frontend/src/components/` y verifica que el archivo se creó sin errores de sintaxis.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add frontend/src/components/SelectorInsumo.jsx
git commit -m "feat: add SelectorInsumo component for dynamic insumo selection"
```

---

## Task 4: Frontend — Refactor DosisCalculadora to Return Array

**Files:**
- Modify: `frontend/src/components/DosisCalculadora.jsx` (lines ~50-80, state + useEffect)

**Context:** DosisCalculadora debe generar sugerencias como array en lugar de objeto. El padre (VisitasPage) pasa un array inicial, DosisCalculadora lo modifica y lo retorna vía onChange.

- [ ] **Step 1: Understand current structure**

Lee `DosisCalculadora.jsx` líneas 50-80 (estados iniciales).

- [ ] **Step 2: Replace usados state with array**

Busca:
```javascript
  const [usados, setUsados] = useState({
    cloroGranulado: '',
    cloroLiquido: '',
    // ... etc
  })
```

Reemplaza con:
```javascript
  const [usados, setUsados] = useState([])
```

- [ ] **Step 3: Update calcularDosis to return array mapping**

Busca la función `useEffect` que pre-llena `usados` cuando cambia `dosis`. Reemplaza completamente:

```javascript
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
```

- [ ] **Step 4: Update onChange call**

Busca el segundo `useEffect`:
```javascript
  useEffect(() => {
    if (onChange) onChange({ condicion, ...usados })
  }, [usados, condicion])
```

Reemplaza con:
```javascript
  useEffect(() => {
    if (onChange) onChange({ condicion, usados })
  }, [usados, condicion, onChange])
```

- [ ] **Step 5: Refactor JSX to render array (modify return statement)**

En el `return` del componente, busca donde renderiza los inputs de químicos (probablemente una serie de `<input value={usados.cloroGranulado} ...>`).

Reemplaza esa sección con:

```javascript
        {/* Sugerencias de DosisCalculadora */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Sugerencias:</p>
          {usados.length === 0 ? (
            <p className="text-xs text-gray-400">Sin sugerencias para esta condición</p>
          ) : (
            usados.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-blue-50 p-3 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{item.nombre}</p>
                  <p className="text-xs text-gray-500">{item.cantidad}{item.unidad}</p>
                </div>
                <button
                  onClick={() => setUsados(usados.filter((_, i) => i !== idx))}
                  className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  ✕ Quitar
                </button>
              </div>
            ))
          )}
        </div>
```

- [ ] **Step 6: Commit**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add frontend/src/components/DosisCalculadora.jsx
git commit -m "refactor: DosisCalculadora now returns array of insumos, not object"
```

---

## Task 5: Frontend — Update VisitasPage to Handle Array + Integration

**Files:**
- Modify: `frontend/src/pages/VisitasPage.jsx` (lines ~62-150)

**Context:** VisitasPage debe recibir onChange de DosisCalculadora (ahora es array), agregar el nuevo SelectorInsumo, permitir editar/eliminar insumos, y pasar el array a la API.

- [ ] **Step 1: Import SelectorInsumo**

Al inicio de VisitasPage.jsx, agrega:
```javascript
import SelectorInsumo from '../components/SelectorInsumo'
```

- [ ] **Step 2: Replace quimicosUsados state**

Busca:
```javascript
  const [quimicosUsados, setQuimicosUsados] = useState({})
```

Reemplaza con:
```javascript
  const [quimicosUsados, setQuimicosUsados] = useState([])
```

- [ ] **Step 3: Update handleDosisChange**

Si existe una función `handleDosisChange` (probablemente recibe onChange de DosisCalculadora), actualiza:

```javascript
  function handleDosisChange(data) {
    // data = { condicion, usados (array) }
    setQuimicosUsados(data.usados || [])
  }
```

- [ ] **Step 4: Add handler to edit cantidad and delete insumo**

Agrega estas funciones (dentro del componente, antes del return):

```javascript
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
```

- [ ] **Step 5: Add JSX section "Lo que usaste" before guardarVisita button**

En la sección del formulario (donde está el formulario "nueva visita"), agrega ANTES del botón "Guardar":

```javascript
              {/* Lo que usaste (array editable) */}
              {quimicosUsados.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg space-y-3 border border-blue-200">
                  <h3 className="text-sm font-bold text-blue-900">Lo que usaste</h3>
                  {quimicosUsados.map((insumo, idx) => (
                    <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{insumo.nombre}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <input
                            type="number"
                            step="0.01"
                            value={insumo.cantidad}
                            onChange={(e) => handleEditarCantidad(idx, e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-xs text-gray-500">{insumo.unidad}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEliminarInsumo(idx)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        ✕ Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar otro insumo */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-3">Agregar otro insumo</p>
                <SelectorInsumo onAgregarInsumo={handleAgregarInsumo} />
              </div>
```

- [ ] **Step 6: Update guardarVisita to send array**

En `guardarVisita()`, asegúrate que `quimicos_usados` se envía como array (ya debería funcionar):

```javascript
      const visita = {
        cliente_id: parseInt(form.cliente_id),
        fecha: form.fecha,
        tareas_realizadas: tasks,
        cloro_ppm: cloro === '' ? null : parseFloat(cloro),
        ph: ph === '' ? null : parseFloat(ph),
        quimicos_usados: quimicosUsados,  // ← ya es array
        observaciones: form.observaciones,
      }
```

- [ ] **Step 7: Commit**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add frontend/src/pages/VisitasPage.jsx
git commit -m "feat: VisitasPage integrates dynamic insumo array, edit/delete handlers, SelectorInsumo"
```

---

## Task 6: Frontend — Create quimicosHelper + Update Display Components

**Files:**
- Create: `frontend/src/utils/quimicosHelper.js`
- Modify: `frontend/src/pages/VisitasPage.jsx` (function quimicosTexto)
- Modify: `frontend/src/pages/ReporteVisitaPage.jsx` (quimicos display)
- Modify: `frontend/src/pages/ReciboPagoPage.jsx` (quimicos display)

**Context:** Crear un helper que convierte viejo formato a nuevo (backward-compat) y funciones para renderizar insumos dinámicos en historial/PDFs.

- [ ] **Step 1: Create quimicosHelper.js**

Crea `frontend/src/utils/quimicosHelper.js`:

```javascript
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
```

- [ ] **Step 2: Update VisitasPage.jsx to use helper**

En VisitasPage.jsx, reemplaza la función `quimicosTexto()` (líneas ~36-47) con:

```javascript
import { parseQuimicos, quimicosTexto } from '../utils/quimicosHelper'

// ... resto del código

// Solo usar en el componente:
const quim = parseQuimicos(v.quimicos_usados)
// ... render con quimicosTexto(quim)
```

- [ ] **Step 3: Update ReporteVisitaPage.jsx**

En `ReporteVisitaPage.jsx`, busca donde renderiza los químicos (probablemente en la sección del PDF).

Reemplaza con:

```javascript
import { parseQuimicos, quimicosLineas } from '../utils/quimicosHelper'

// ... en el componente:

const quimicos = parseQuimicos(visita.quimicos_usados)
const quimLineas = quimicosLineas(quimicos)

// En el JSX del PDF:
{quimLineas.length > 0 && (
  <div className="mb-4">
    <p className="font-bold text-sm mb-1">Químicos aplicados:</p>
    {quimLineas.map((linea, idx) => (
      <p key={idx} className="text-sm text-gray-700">{linea}</p>
    ))}
  </div>
)}
```

- [ ] **Step 4: Update ReciboPagoPage.jsx similarly**

En `ReciboPagoPage.jsx`, busca la sección de WhatsApp text builder donde genera el texto para compartir. Reemplaza referencias a químicos con:

```javascript
import { parseQuimicos, quimicosTexto } from '../utils/quimicosHelper'

// ... en el componente:

const quimTexto = quimicosTexto(visita.quimicos_usados)

// En el text builder:
`Químicos: ${quimTexto}`
```

- [ ] **Step 5: Commit**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add frontend/src/utils/quimicosHelper.js frontend/src/pages/VisitasPage.jsx frontend/src/pages/ReporteVisitaPage.jsx frontend/src/pages/ReciboPagoPage.jsx
git commit -m "feat: add quimicosHelper for backward-compat + update all display components to render dynamic array"
```

---

## Task 7: End-to-End Test + Handle Edge Cases

**Files:**
- Test: Manual testing via UI

**Context:** Verificar que todo funciona: crear visita con sugerencias, editar/agregar/eliminar insumos, validar stock, ver en historial/PDFs, visitas antiguas se leen bien.

- [ ] **Step 1: Start the app**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
npm run build --workspace=frontend
cd backend
node server.js
```

Abre `http://localhost:3000` en navegador.

- [ ] **Step 2: Test crear visita con sugerencias automáticas**

1. Abre "Visitas" → "Nueva visita"
2. Selecciona un cliente
3. Ingresa volumen: 50000L, condición: turbia
4. Verifica que DosisCalculadora sugiere: cloro granulado, floculante (deberían aparecer en "Sugerencias")
5. Verifica que se copian a "Lo que usaste"

Esperado: Array de sugerencias visible, editable.

- [ ] **Step 3: Test eliminar sugerencia + agregar otro insumo**

1. En "Lo que usaste", toca el botón X en "Cloro Granulado" → debe desaparecer
2. En "Agregar otro insumo", selecciona "Cloro en Pastillas", entra cantidad "150g", toca "Agregar"
3. Verifica que aparece en "Lo que usaste"

Esperado: Sugerencias editables, SelectorInsumo funciona.

- [ ] **Step 4: Test guardar visita + verificar stock descontado**

1. Toca "Guardar visita"
2. Abre "Inventario" en otra pestaña
3. Busca "Floculante" y "Cloro en Pastillas"
4. Verifica que stock se decrementó

Esperado: Stock correcto, movimientos registrados.

- [ ] **Step 5: Test stock insuficiente (warning no bloquea)**

1. Nueva visita, volumen pequeño (5000L)
2. En "Agregar otro insumo", selecciona un insumo que tenga stock bajo (ej: 10g pero entra 500g)
3. Toca guardar
4. Verifica que sale un popup de advertencia pero permite guardar igual

Esperado: Stock va negativo, aparece en rojo en inventario.

- [ ] **Step 6: Test historial de visitas (backward-compat)**

1. Abre "Historial de visitas"
2. Toca una visita recién creada
3. Verifica que muestra "Floculante: X ml · Cloro en Pastillas: 150g" etc.
4. Expande si tiene visitas antiguas (formato viejo), verifica que se muestran bien

Esperado: Visitas antiguas y nuevas se ven iguales.

- [ ] **Step 7: Test PDF (ReporteVisitaPage)**

1. En el historial, toca "Ver informe/PDF" en una visita
2. Verifica que en la sección "Químicos aplicados" aparecen todos los insumos dinámicos
3. Verifica que los bullets se ven bien (• Floculante: X ml, etc.)

Esperado: PDF genera sin errores, químicos renderean dinámicamente.

- [ ] **Step 8: Test WhatsApp text (ReciboPagoPage)**

1. En una visita, abre el modal de "Ver informe"
2. Toca "Compartir por WhatsApp"
3. Verifica que el texto pre-llenado incluye los químicos (ej: "Químicos: Floculante: X ml ...")

Esperado: Texto dinámico se incluye en WhatsApp.

- [ ] **Step 9: Commit final (if all tests pass)**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git log --oneline -5  # Verifica que ves los 5 commits anteriores de insumos dinámicos
git status  # Debe estar limpio (no hay cambios sin commitear)
```

Si todo pasó, perfecto. Si hay bugs, revisar los archivos relevantes y hacer commits de fix.

---

## Checklist de Aceptación

- [ ] Fede puede seleccionar CUALQUIER insumo del inventario en una visita
- [ ] Stock se descuenta automáticamente con unidad correcta (g, ml, L, etc.)
- [ ] Soporta decimales (1.5 litros, 0.25g)
- [ ] Advertencia (no bloqueo) si stock insuficiente
- [ ] DosisCalculadora sigue sugiriendo los 6 químicos automáticamente
- [ ] Fede puede eliminar sugerencias y agregar otros insumos
- [ ] Historial de visitas muestra insumos dinámicos correctamente
- [ ] PDFs (ReporteVisita, ReciboPago) renderizan insumos dinámicos
- [ ] Visitas antiguas (formato viejo) se leen sin quebrar
- [ ] No hay errores en consola del navegador o logs del servidor

---

## Notes for Future

- Si Fede agrega un insumo nuevo al inventario, automáticamente aparece en SelectorInsumo (sin cambio de código)
- Backward-compat helper `parseQuimicos()` convierte viejo → nuevo on-read (transparente)
- Stock puede ir negativo (Fede lo ve y ajusta después si quiere)
- Descuento es 1:1 (cantidad ingresada = cantidad descontada, sin conversiones)
