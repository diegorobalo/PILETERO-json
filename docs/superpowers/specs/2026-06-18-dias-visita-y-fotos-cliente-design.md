# Spec: Días de visita (selector) + Fotos de cliente

**Fecha:** 2026-06-18  
**Proyecto:** PILETERO  
**Alcance:** Desktop-first; fotos de cliente en mobile quedan para una sesión posterior.

---

## Contexto

`dias_visita` existe como TEXT libre en SQLite e IndexedDB. `AgendaPage` ya lee este campo y auto-puebla la agenda del día con `clienteEsDeHoy()`. El problema es que el campo es texto libre, propenso a typos y problemas con tildes ("Miércoles" vs "Miercoles").

Las fotos de cliente son una nueva necesidad: guardar 1-2 imágenes de referencia de la piscina por cliente, visibles al editar el cliente en desktop.

---

## Feature 1: Selector de días de visita

### Formato de datos

`dias_visita` pasa de texto libre a un JSON array de enteros `[0..6]`, donde cada número es el valor de `Date.getDay()`:

| Número | Día       |
|--------|-----------|
| 0      | Domingo   |
| 1      | Lunes     |
| 2      | Martes    |
| 3      | Miércoles |
| 4      | Jueves    |
| 5      | Viernes   |
| 6      | Sábado    |

Ejemplo: `"[1,3]"` = Lunes y Miércoles.

**Sin cambio de schema** — la columna `dias_visita TEXT` ya existe en `clientes`.

### ClientForm.jsx

- Reemplazar `<input type="text" name="dias_visita">` con 7 botones toggle en fila horizontal.
- Labels cortos: `Dom Lun Mar Mié Jue Vie Sáb`.
- Estado interno: `diasSeleccionados` (array de números).
- Toggle: click agrega o quita el número del array.
- Visual: seleccionado = `bg-blue-600 text-white`, no seleccionado = `bg-white border border-gray-300 text-gray-700`.
- Al iniciar: si `initialData.dias_visita` es JSON válido con array → pre-seleccionar. Si es texto viejo o vacío → array vacío (usuario re-selecciona).
- Al serializar para `onSubmit`: `dias_visita = JSON.stringify(diasSeleccionados)` si hay días, `""` si no hay ninguno.

### AgendaPage.jsx — `clienteEsDeHoy()`

```js
function clienteEsDeHoy(diasVisita) {
  if (!diasVisita) return false;
  const hoy = new Date().getDay();
  try {
    const arr = JSON.parse(diasVisita);
    if (Array.isArray(arr)) return arr.includes(hoy);
  } catch {}
  // Fallback: viejo formato texto
  const variantes = DIAS[hoy] || [];
  return variantes.some(v => diasVisita.toLowerCase().includes(v));
}
```

El objeto `DIAS` existente se mantiene para backward compatibility.

---

## Feature 2: Fotos de cliente (desktop)

### Schema — nueva tabla

```sql
CREATE TABLE IF NOT EXISTS fotos_clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  tipo TEXT,
  ruta_archivo TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fotos_clientes_cliente_id ON fotos_clientes(cliente_id);
```

`ruta_archivo` almacena el base64 DataURL (igual que `fotos` de visitas).

### database.js — nuevos métodos

- `getFotosCliente(clienteId)` → `SELECT * FROM fotos_clientes WHERE cliente_id = ? ORDER BY created_at`
- `saveFotoCliente({ cliente_id, tipo, data })` → INSERT, retorna el registro creado
- `deleteFotoCliente(id)` → DELETE

### routes.js — nuevos endpoints

- `GET  /api/clientes/:id/fotos-cliente` → devuelve array de fotos
- `POST /api/clientes/:id/fotos-cliente` → body `{ tipo, data }`, valida max 2 fotos, guarda, retorna la foto creada
- `DELETE /api/fotos-cliente/:id` → elimina por id

### api.js — nuevos métodos

- `getFotosCliente(clienteId)`
- `saveFotoCliente(clienteId, { tipo, data })`
- `deleteFotoCliente(id)`

### ClientForm.jsx — sección de fotos

**Posición:** al final del formulario, antes de los botones de guardar/cancelar.

**Compresión antes de guardar:**
- Canvas resize: máx 900px en el lado más largo, manteniendo aspect ratio.
- JPEG quality: 0.75
- Resultado esperado: ~80-150KB por foto independientemente del tamaño original.

**Modo edición** (cliente ya existe, `editingId !== null`):
- Al montar: carga fotos existentes via `apiClient.getFotosCliente(id)`.
- Al agregar foto: comprime → llama `apiClient.saveFotoCliente()` → actualiza lista local.
- Al eliminar: llama `apiClient.deleteFotoCliente(id)` → actualiza lista local.
- Operaciones inmediatas, no esperan al botón "Guardar".

**Modo creación** (cliente nuevo):
- La sección de fotos se muestra deshabilitada con el mensaje: _"Guardá el cliente primero para poder agregar fotos."_
- Flujo natural: crear cliente → guardarlo → volver a abrirlo en edición → agregar fotos.
- Esto evita refactoring del parent (`ClientsPage`/`MobileClientesPage`) que actualmente no retorna el ID del cliente recién creado.

**UI:**
```
[ Fotos de la piscina ]            (label section)
[ 🏊 thumbnail ][ ✕ ]  [ 🏊 thumbnail ][ ✕ ]   ← hasta 2 fotos
[ + Agregar foto ]   ← oculto si ya hay 2
```
- Thumbnails: `max-h-40 rounded-lg object-cover`
- Input file: `accept="image/*" capture="environment"` para mobile, oculto, activado por botón
- Indicador de carga durante compresión/subida

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `backend/db/schema.sql` | Agregar tabla `fotos_clientes` + índice |
| `backend/services/database.js` | 3 métodos nuevos |
| `backend/api/routes.js` | 3 endpoints nuevos |
| `frontend/src/services/api.js` | 3 métodos nuevos |
| `frontend/src/components/ClientForm.jsx` | Day picker + sección fotos |
| `frontend/src/pages/AgendaPage.jsx` | `clienteEsDeHoy` backward-compatible |

---

## Fuera de alcance (esta iteración)

- Sync de fotos de cliente al celular
- Más de 2 fotos por cliente
- Ordenamiento o tipado de fotos más allá del campo `tipo` libre
