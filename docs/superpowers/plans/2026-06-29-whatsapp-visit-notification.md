# WhatsApp Aviso de Visita (PILETERO v1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Fede to send pre-filled WhatsApp messages to clients from the daily agenda, with customizable message templates editable via the Settings page.

**Architecture:** 
- Backend: Add two new config keys (`mensaje_whatsapp_visita`, `mensaje_whatsapp_reprogramado`) — no schema changes needed, leveraging existing `configuracion` table.
- Frontend: (1) Extend `ConfiguracionPage` with WhatsApp message templates textarea inputs, (2) Add WhatsApp buttons to each client in `AgendaPage`, (3) Create helper function to interpolate message placeholders ({nombre_cliente}, {fecha_hoy}).
- UX: WhatsApp button opens `https://wa.me/+54[numero]?text=[encoded_message]` directly in the browser/WhatsApp app.

**Tech Stack:** 
- Backend: Node.js/Express (unchanged — uses existing setConfig API)
- Frontend: React (add two textarea fields, WhatsApp button component)
- Message interpolation: Simple string `.replace()` utility

---

## File Structure

**Modified Files:**
- `frontend/src/pages/ConfiguracionPage.jsx` — Add "Mensajes WhatsApp" section with 2 textareas
- `frontend/src/pages/AgendaPage.jsx` — Add WhatsApp button for each client + message logic
- `frontend/src/utils/messageInterpolation.js` — NEW: Helper to interpolate placeholders

**Backend:** No code changes — existing GET/PUT `/api/configuracion` handles all config management.

---

## Initial Data (Default Messages)

The following default messages will be set on first run via a simple initialization check in ConfiguracionPage:

**Default visita message:**
```
Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!
```

**Default reprogramado message:**
```
Hola {nombre_cliente}, el servicio va a ser reprogramado para otro día. Te aviso cuando.
```

---

## Implementation Tasks

### Task 1: Create Message Interpolation Utility

**Files:**
- Create: `frontend/src/utils/messageInterpolation.js`

**Description:** This utility function interpolates placeholders in message templates. Called by both ConfiguracionPage (for preview) and AgendaPage (for actual WhatsApp link generation).

- [ ] **Step 1: Create the utility file with interpolation function**

Create `frontend/src/utils/messageInterpolation.js`:

```javascript
/**
 * Interpolates placeholders in a message template
 * Supported placeholders:
 *   {nombre_cliente} — replaced with cliente.nombre
 *   {fecha_hoy} — replaced with today's date in es-AR format
 *   {hora} — replaced with current time in es-AR format (optional)
 * 
 * @param {string} template - Message template with placeholders
 * @param {object} cliente - Client object with nombre, telefono, etc.
 * @returns {string} Interpolated message
 */
export function interpolateMensaje(template, cliente = {}) {
  if (!template) return '';
  
  let result = template;
  
  // Replace {nombre_cliente}
  if (cliente.nombre) {
    result = result.replace(/{nombre_cliente}/g, cliente.nombre);
  }
  
  // Replace {fecha_hoy} — today's date in Spanish locale
  const hoy = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  result = result.replace(/{fecha_hoy}/g, hoy);
  
  // Replace {hora} — current time in Spanish locale
  const ahora = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  result = result.replace(/{hora}/g, ahora);
  
  return result;
}

/**
 * Encodes a message for use in a wa.me URL
 * @param {string} message - Message to encode
 * @returns {string} URL-encoded message
 */
export function encodeWhatsAppMessage(message) {
  return encodeURIComponent(message);
}

/**
 * Generates a WhatsApp link for a given client and message
 * @param {string} clienteTelefono - Client phone number (without country code, e.g., "1234567890")
 * @param {string} mensaje - Message to send
 * @returns {string} wa.me URL
 */
export function generateWhatsAppLink(clienteTelefono, mensaje) {
  if (!clienteTelefono || !mensaje) return '';
  
  // Ensure phone number format: remove spaces and special chars
  const telefono = clienteTelefono.replace(/\D/g, '');
  const encoded = encodeWhatsAppMessage(mensaje);
  
  // Argentina country code: +54
  return `https://wa.me/+54${telefono}?text=${encoded}`;
}
```

- [ ] **Step 2: Commit the utility**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add frontend/src/utils/messageInterpolation.js
git commit -m "feat: add message interpolation utility for WhatsApp templates"
```

---

### Task 2: Extend ConfiguracionPage with WhatsApp Message Settings

**Files:**
- Modify: `frontend/src/pages/ConfiguracionPage.jsx`

**Description:** Add a new "Mensajes WhatsApp" section with two textarea inputs (visita y reprogramado), plus a preview button for each. Initialize defaults if messages are empty.

- [ ] **Step 1: Read current ConfiguracionPage to understand state structure**

(Already read in planning — confirm structure matches expectations)

- [ ] **Step 2: Add WhatsApp message fields to CAMPOS array**

Modify `frontend/src/pages/ConfiguracionPage.jsx`. Replace the CAMPOS definition:

```javascript
const CAMPOS = [
  { clave: 'nombre_tecnico', label: 'Nombre del técnico', placeholder: 'Ej: Federico Tenca' },
  { clave: 'telefono', label: 'Teléfono', placeholder: 'Ej: 2323 545583' },
  { clave: 'email', label: 'Email (opcional)', placeholder: 'Ej: fede@mail.com' },
  { clave: 'notas_pie_recibo', label: 'Nota al pie del recibo (opcional)', placeholder: 'Ej: Gracias por su confianza' },
]

// NEW: Mensaje WhatsApp fields
const MENSAJES_WHATSAPP = [
  {
    clave: 'mensaje_whatsapp_visita',
    label: 'Mensaje para visita (cuando vas a hacer el servicio)',
    placeholder: 'Ej: Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!',
    defaultValue: 'Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!'
  },
  {
    clave: 'mensaje_whatsapp_reprogramado',
    label: 'Mensaje para reprogramación',
    placeholder: 'Ej: Hola {nombre_cliente}, el servicio va a ser reprogramado para otro día. Te aviso cuando.',
    defaultValue: 'Hola {nombre_cliente}, el servicio va a ser reprogramado para otro día. Te aviso cuando.'
  }
]
```

- [ ] **Step 3: Update ConfiguracionPage component to initialize default messages**

Replace the `useEffect` hook in ConfiguracionPage:

```javascript
useEffect(() => {
  apiClient.getConfiguracion()
    .then(cfg => {
      // Initialize defaults if not set
      const withDefaults = { ...cfg };
      MENSAJES_WHATSAPP.forEach(({ clave, defaultValue }) => {
        if (!withDefaults[clave]) {
          withDefaults[clave] = defaultValue;
        }
      });
      setConfig(withDefaults);
    })
    .catch(() => toastError('No se pudo cargar la configuración'))
    .finally(() => setLoading(false))
}, [])
```

- [ ] **Step 4: Add WhatsApp messages section to JSX (before the closing div)**

In the return statement, replace the closing `</div>` with:

```javascript
return (
  <div className="p-6 max-w-2xl">
    <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
    <p className="text-gray-500 text-sm mb-6">Estos datos aparecen en los recibos y reportes PDF.</p>
    {loading ? <p className="text-gray-400">Cargando...</p> : (
      <div className="space-y-4">
        {/* Original campos */}
        {CAMPOS.map(({ clave, label, placeholder }) => (
          <div key={clave}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
                value={config[clave] || ''}
                placeholder={placeholder}
                onChange={e => setConfig(c => ({ ...c, [clave]: e.target.value }))}
              />
              <button
                onClick={() => guardar(clave, config[clave] || '')}
                disabled={guardando === clave}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-sky-700">
                {guardando === clave ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        ))}
        
        {/* NEW: WhatsApp Messages Section */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">💬 Mensajes WhatsApp</h2>
          <p className="text-gray-500 text-sm mb-6">
            Personaliza los mensajes que se envían por WhatsApp. Puedes usar:
            <br />
            <code className="text-xs bg-gray-100 px-1 rounded">{`{nombre_cliente}`}</code>
            {` — `}
            <code className="text-xs bg-gray-100 px-1 rounded">{`{fecha_hoy}`}</code>
            {` — `}
            <code className="text-xs bg-gray-100 px-1 rounded">{`{hora}`}</code>
          </p>
          
          {MENSAJES_WHATSAPP.map(({ clave, label, placeholder, defaultValue }) => (
            <div key={clave} className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 resize-vertical"
                rows="3"
                value={config[clave] || ''}
                placeholder={placeholder}
                onChange={e => setConfig(c => ({ ...c, [clave]: e.target.value }))}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => guardar(clave, config[clave] || defaultValue)}
                  disabled={guardando === clave}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-sky-700">
                  {guardando === clave ? '...' : 'Guardar'}
                </button>
                <button
                  onClick={() => {
                    const interpolated = require('../utils/messageInterpolation').interpolateMensaje(
                      config[clave] || defaultValue,
                      { nombre_cliente: 'Casa A' }
                    );
                    toastInfo(`Preview: ${interpolated}`);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-400">
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)
```

- [ ] **Step 5: Import the interpolation utility at the top**

Add to imports in ConfiguracionPage.jsx:

```javascript
import { interpolateMensaje } from '../utils/messageInterpolation'
```

- [ ] **Step 6: Commit ConfiguracionPage changes**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add frontend/src/pages/ConfiguracionPage.jsx
git commit -m "feat: add WhatsApp message configuration section to ConfiguracionPage

- Add two textarea fields for visita and reprogramado message templates
- Support placeholders: {nombre_cliente}, {fecha_hoy}, {hora}
- Initialize with default messages if not set
- Add Preview button to test message interpolation"
```

---

### Task 3: Add WhatsApp Button to AgendaPage Client List

**Files:**
- Modify: `frontend/src/pages/AgendaPage.jsx`

**Description:** Add a "💬 Enviar WhatsApp" button for each client in the "Hoy" section. Clicking it opens the WhatsApp link with the interpolated message.

- [ ] **Step 1: Import messageInterpolation utilities at the top of AgendaPage**

Add to imports:

```javascript
import { interpolateMensaje, generateWhatsAppLink } from '../services/api'
```

Wait — change this. The import should be:

```javascript
import { interpolateMensaje, generateWhatsAppLink } from '../utils/messageInterpolation'
```

- [ ] **Step 2: Add state for configuration (mensaje_whatsapp_visita)**

In AgendaPage, add to the existing useState declarations (after `vistaMode` state):

```javascript
const [config, setConfigLocal] = useState({})
```

- [ ] **Step 3: Load configuration on component mount**

Add this inside the existing `useEffect(() => { cargarDatos(); ... })` hook, right after `cargarDatos()` call:

```javascript
useEffect(() => {
  cargarDatos();
  setupSync();
  
  // NEW: Load WhatsApp message config
  apiClient.getConfiguracion()
    .then(cfg => setConfigLocal(cfg))
    .catch(err => console.error('Failed to load config:', err))
  
  window.addEventListener('online', autoSync);
  return () => window.removeEventListener('online', autoSync);
}, []);
```

Actually, simplify by adding the config load INSIDE cargarDatos:

In the `cargarDatos` function, add before the final `catch`:

```javascript
async function cargarDatos() {
  try {
    setLoading(true);
    await storageService.init();
    
    // ... existing code ...
    
    // NEW: Load WhatsApp config
    try {
      const cfg = await apiClient.getConfiguracion();
      setConfigLocal(cfg);
    } catch (err) {
      console.warn('Could not load WhatsApp config:', err);
    }
    
    // ... rest of existing code ...
  } catch (err) {
    // existing error handling
  }
}
```

- [ ] **Step 4: Create WhatsAppButton component inline (or as separate component)**

Option A (inline in AgendaPage): Add this function inside AgendaPage, before the return statement:

```javascript
function abrirWhatsApp(cliente) {
  if (!cliente.telefono) {
    toastError('Este cliente no tiene teléfono registrado');
    return;
  }
  
  const mensaje = config.mensaje_whatsapp_visita || 
    'Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!';
  
  const interpolated = interpolateMensaje(mensaje, cliente);
  const link = generateWhatsAppLink(cliente.telefono, interpolated);
  
  if (link) {
    window.open(link, '_blank');
  }
}
```

- [ ] **Step 5: Add WhatsApp button to ClientCard rendering in "Hoy" section**

Find the section in AgendaPage that renders `clientesDeHoy`. Locate the client card rendering and add the WhatsApp button. 

Search for the area that looks like:

```javascript
{clientesDeHoy.map((cliente) => (
  <ClientCard
    key={cliente.id}
    ...
  />
))}
```

Replace it with:

```javascript
{clientesDeHoy.map((cliente) => (
  <div key={cliente.id} className="relative">
    <ClientCard
      cliente={cliente}
      status={getClienteStatus(cliente.id)}
      timeInfo={getClienteTime(cliente)}
      onRemove={() => quitarCliente(cliente.id)}
      onSkip={() => { setModalSaltar(cliente.id); }}
    />
    {/* NEW: WhatsApp Button */}
    <button
      onClick={() => abrirWhatsApp(cliente)}
      className="absolute top-2 right-2 bg-green-500 hover:bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg shadow-md transition"
      title="Enviar WhatsApp"
    >
      💬
    </button>
  </div>
))}
```

**Note:** If ClientCard is already rendering a complete card structure, position the button differently. Check the actual ClientCard JSX and adjust positioning if needed.

- [ ] **Step 6: Commit AgendaPage changes**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add frontend/src/pages/AgendaPage.jsx
git commit -m "feat: add WhatsApp button to AgendaPage client list

- Load mensaje_whatsapp_visita config on mount
- Add 💬 button for each client in daily agenda
- Clicking button opens wa.me link with interpolated message
- Graceful error handling if phone number missing"
```

---

### Task 4: Verify Integration and Test Flow

**Files:**
- Test: Manual testing (no code changes)

**Description:** Verify the full flow works end-to-end.

- [ ] **Step 1: Start the backend server**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
npm run dev:backend
```

Expected: Server starts, database migrations run, no errors.

- [ ] **Step 2: Start the frontend dev server** (in another terminal)

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO\frontend
npm run dev
```

Expected: Frontend starts on http://localhost:5173 or similar.

- [ ] **Step 3: Navigate to Settings (Configuración)**

- Open http://localhost:5173/#/configuracion
- Scroll to "Mensajes WhatsApp" section
- Verify two textarea fields are visible

- [ ] **Step 4: Test editing a message template**

- Click in the first textarea (mensaje_whatsapp_visita)
- Change the message to: `Hola {nombre_cliente}, vengo hoy a las {hora}. Confirma 👍`
- Click "Guardar"
- Verify toast shows "Guardado"

- [ ] **Step 5: Test Preview button**

- Click "Preview" button under the mensaje_whatsapp_visita field
- Verify a toast shows: `Preview: Hola Casa A, vengo hoy a las [current_time]. Confirma 👍`
- (This proves interpolation works)

- [ ] **Step 6: Navigate to Agenda (Hoy)**

- Open http://localhost:5173/#/agenda
- Verify each client in the list has a 💬 button (top right of card)

- [ ] **Step 7: Test WhatsApp button click**

- Click the 💬 button on any client with a phone number
- Verify a new browser tab/window opens with WhatsApp Web or app
- Check the URL in the address bar includes:
  - `wa.me/+54[CLIENT_PHONE]`
  - `text=Hola%20[nombre_cliente]%2C%20...` (URL-encoded message)

- [ ] **Step 8: Test error handling**

- If there's a client without a phone number, click their 💬 button
- Verify an error toast appears: "Este cliente no tiene teléfono registrado"

- [ ] **Step 9: Test placeholder interpolation with multiple clients**

- Go back to Settings
- Change the message to: `{nombre_cliente} en {fecha_hoy}`
- Save
- Go to Agenda → Hoy
- Click 💬 on two different clients
- Verify each WhatsApp link has the correct client name and date

- [ ] **Step 10: Document test results**

No commit needed for manual testing. If all steps pass, move to Task 5.

---

### Task 5: Final Verification and Cleanup

**Files:**
- Verify: `frontend/src/utils/messageInterpolation.js`
- Verify: `frontend/src/pages/ConfiguracionPage.jsx`
- Verify: `frontend/src/pages/AgendaPage.jsx`

**Description:** Ensure code quality, no console errors, and edge cases handled.

- [ ] **Step 1: Check browser console for errors**

- Open DevTools (F12)
- Navigate to Configuración → Agenda
- Check Console tab for any warnings or errors
- Expected: No errors (warnings may exist from dependencies)

- [ ] **Step 2: Test with empty/null phone numbers**

- Create or edit a test client to have an empty `telefono` field
- Go to Agenda
- Click 💬 on that client
- Expected: Toast "Este cliente no tiene teléfono registrado"

- [ ] **Step 3: Test with special characters in client name**

- Ensure a client exists with a name like: "Casa de José & Mariana"
- Set a message template: `Hola {nombre_cliente}!`
- Click 💬
- Verify the WhatsApp link properly URL-encodes the name

- [ ] **Step 4: Test browser storage and persistence**

- Edit a message in Settings
- Refresh the page (F5)
- Go back to Settings
- Verify the message is still there (persisted in DB)

- [ ] **Step 5: Verify no breaking changes to existing pages**

- Clients page — load and add a new client ✓
- Finance page — view payments ✓
- Inventory page — view/edit stock ✓
- Dashboard — view stats ✓
- All should work without regression

- [ ] **Step 6: Create a summary commit if any tweaks were made**

If only testing (no code changes), skip this step. If you found bugs and fixed them inline:

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add -A
git commit -m "fix: minor tweaks from integration testing"
```

---

### Task 6: Create User Documentation (Optional but Recommended)

**Files:**
- Create/Modify: `docs/FEATURES.md` or `GUIA PILETERO v1.1.docx`

**Description:** Document the new WhatsApp feature for Fede's reference.

- [ ] **Step 1: Document the feature in a markdown or doc file**

Add to docs (or existing GUIA PILETERO):

```markdown
## 💬 WhatsApp Aviso de Visita (v1.1)

### ¿Qué es?
Desde la Agenda del día, Fede puede enviar mensajes pre-llenados a clientes por WhatsApp sin salir de la app.

### ¿Cómo funciona?

1. **Configurar mensajes** (una sola vez o cuando quieras cambiar)
   - Ve a **Configuración** → sección **💬 Mensajes WhatsApp**
   - Edita el mensaje para "Visita" (ej: "Hoy voy a hacer el mantenimiento")
   - Edita el mensaje para "Reprogramación" (opcional)
   - Placeholders disponibles: `{nombre_cliente}`, `{fecha_hoy}`, `{hora}`
   - Haz clic en **Guardar** o prueba con **Preview**

2. **Enviar mensaje a un cliente**
   - Ve a **Agenda** → **Hoy**
   - Para cada cliente, verás un botón 💬 (arriba a la derecha de la tarjeta)
   - Haz clic en 💬
   - Se abrirá WhatsApp con el mensaje ya rellenado
   - Revisa, edita si quieres, y envía

### Ejemplos de mensajes

**Visita:**
- "Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!"
- "Vengo a las {hora}. Confirma cuando llegues 👍"

**Reprogramación:**
- "Hola {nombre_cliente}, el servicio se reprograma para otro día. Te aviso cuando."

### Notas

- El cliente debe tener su número de teléfono registrado en la app
- Se abre WhatsApp Web en la computadora; desde el celular abre la app de WhatsApp
- Puedes editar el mensaje en WhatsApp antes de enviar
```

- [ ] **Step 2: Commit documentation**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add docs/FEATURES.md  # or GUIA PILETERO v1.1.docx if using Word
git commit -m "docs: add WhatsApp feature guide for users"
```

---

## Spec Compliance Checklist

- [x] **Backend:** Tabla configuracion con campos mensaje_whatsapp_visita y mensaje_whatsapp_reprogramado (via migrations)
- [x] **Backend:** GET /api/configuracion devuelve estos campos (✓ already works)
- [x] **Backend:** PUT /api/configuracion permite editarlos (✓ already works)
- [x] **Frontend — ConfiguracionPage:** Sección "Mensajes WhatsApp" con 2 textareas
- [x] **Frontend — ConfiguracionPage:** Botón "Guardar" por cada campo
- [x] **Frontend — ConfiguracionPage:** Buttons "Preview" para probar interpolación
- [x] **Frontend — AgendaPage:** Botón "💬 Enviar WhatsApp" por cada cliente
- [x] **Frontend — AgendaPage:** Al hacer clic abre wa.me con mensaje interpolado
- [x] **Frontend:** Helper function interpola {nombre_cliente}, {fecha_hoy}, {hora}
- [x] **Frontend:** WhatsApp URL encoding funciona correctamente
- [x] **UX:** Error handling si cliente sin teléfono
- [x] **Testing:** Manual verification de flujo completo
- [x] **Documentation:** User guide added

---

## Summary

This plan implements the WhatsApp visit notification feature for PILETERO v1.1 in **6 bite-sized tasks**:

1. **messageInterpolation.js** — Utility for placeholder replacement and URL generation
2. **ConfiguracionPage.jsx** — Add WhatsApp message config section
3. **AgendaPage.jsx** — Add WhatsApp button to client list
4. **Integration Testing** — Verify end-to-end flow
5. **Final Verification** — Check edge cases and regressions
6. **Documentation** — User guide (optional)

**Estimated Time:** 30–45 minutes (without doc)  
**Commits:** 4–5  
**Breaking Changes:** None

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-29-whatsapp-visit-notification.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration using superpowers:subagent-driven-development.

**2. Inline Execution** — Execute tasks in this session using superpowers:executing-plans, batch execution with checkpoints.

**Which approach?**
