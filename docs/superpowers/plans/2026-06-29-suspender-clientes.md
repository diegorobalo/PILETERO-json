# Suspender Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Fede to temporarily suspend clients without deleting them, excluding suspended clients from agenda and finance calculations while maintaining full reversibility.

**Architecture:** Add `estado` column to `clientes` table with values 'activo' or 'suspendido'. Backend routes filter suspended clients from agenda queries and finance calculations. Frontend displays conditional suspend/reactivate buttons in ClientForm, filters agenda view to only active clients, and excludes suspended clients from finance metrics.

**Tech Stack:** SQLite (backend database), Express.js (Node.js API), React (frontend), IndexedDB/localStorage (client-side caching)

---

## File Structure

**Backend:**
- `backend/db/schema.sql` — Add migration for `estado` column
- `backend/services/database.js` — Modify `getAllClientes()` to return all clients; add `suspenderCliente()` and `reactivarCliente()` methods
- `backend/api/routes.js` — Add POST `/api/clientes/:id/suspender` and POST `/api/clientes/:id/reactivar` routes

**Frontend:**
- `frontend/src/components/ClientForm.jsx` — Add conditional suspend/reactivate button UI
- `frontend/src/pages/AgendaPage.jsx` — Filter clients to show only `estado === 'activo'`
- `frontend/src/pages/FinancePage.jsx` — Exclude suspended clients from ganancia neta calculation

---

## Task 1: Database Migration - Add `estado` Column

**Files:**
- Modify: `backend/db/schema.sql`

- [ ] **Step 1: Read current schema to understand structure**

Read `backend/db/schema.sql` to confirm the clientes table definition.

- [ ] **Step 2: Add migration to schema.sql**

Add the following ALTER TABLE statement at the end of `backend/db/schema.sql` (after the CREATE INDEX statements):

```sql
-- Migration: Add estado column for client suspension feature (v1.1)
ALTER TABLE clientes ADD COLUMN estado TEXT DEFAULT 'activo';
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
```

This adds:
- `estado` column (TEXT, default 'activo') — stores 'activo' or 'suspendido'
- Index on `estado` column for filtering performance

- [ ] **Step 3: Commit the schema change**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git add backend/db/schema.sql
git commit -m "feat: add estado column to clientes table for suspension feature"
```

Expected: One file changed, schema now includes ALTER TABLE and new index.

---

## Task 2: Backend - Add Suspend/Reactivate Methods to DatabaseService

**Files:**
- Modify: `backend/services/database.js` (around line 160, after `updateCliente`)

- [ ] **Step 1: Add two new async methods to DatabaseService class**

Find the location after the `updateCliente` method (around line 160) and add these two methods before the FOTOS section:

```javascript
  /**
   * Suspend a client (mark as suspendido)
   */
  async suspenderCliente(id) {
    const sql = `UPDATE clientes SET estado = 'suspendido', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.execute(sql, [id]);
    return this.getClienteById(id);
  }

  /**
   * Reactivate a suspended client (mark as activo)
   */
  async reactivarCliente(id) {
    const sql = `UPDATE clientes SET estado = 'activo', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.execute(sql, [id]);
    return this.getClienteById(id);
  }
```

- [ ] **Step 2: Modify getAllClientes to return ALL clients (not just active)**

Find the `getAllClientes()` method at line ~62 and replace:

```javascript
// OLD:
async getAllClientes() {
  return this.query('SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre');
}

// NEW:
async getAllClientes() {
  return this.query('SELECT * FROM clientes ORDER BY nombre');
}
```

This returns all clients (both activo and suspendido) so frontend can filter and display estado field. The frontend is responsible for filtering which clients to show in the agenda.

- [ ] **Step 3: Verify changes are correct**

Read back the modified section to confirm:
- `suspenderCliente()` and `reactivarCliente()` methods are added
- `getAllClientes()` no longer filters by `activo = 1`
- Methods are placed before the FOTOS section

- [ ] **Step 4: Commit**

```bash
git add backend/services/database.js
git commit -m "feat: add suspenderCliente and reactivarCliente methods to DatabaseService"
```

---

## Task 3: Backend - Add Suspend/Reactivate API Routes

**Files:**
- Modify: `backend/api/routes.js` (after PUT /api/clientes/:id route, around line 84)

- [ ] **Step 1: Add two new POST routes after the PUT /api/clientes/:id route**

Find line 84 (after the PUT /api/clientes/:id route closes) and add:

```javascript
/**
 * POST /api/clientes/:id/suspender
 * Suspend a client (temporarily disable without deleting)
 */
router.post('/clientes/:id/suspender', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const cliente = await databaseService.getClienteById(id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    const suspendedCliente = await databaseService.suspenderCliente(id);
    res.json({ success: true, cliente: suspendedCliente });
  } catch (error) {
    console.error('Error suspending cliente:', error);
    res.status(500).json({ error: 'Failed to suspend client' });
  }
});

/**
 * POST /api/clientes/:id/reactivar
 * Reactivate a suspended client
 */
router.post('/clientes/:id/reactivar', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const cliente = await databaseService.getClienteById(id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    const reactivatedCliente = await databaseService.reactivarCliente(id);
    res.json({ success: true, cliente: reactivatedCliente });
  } catch (error) {
    console.error('Error reactivating cliente:', error);
    res.status(500).json({ error: 'Failed to reactivate client' });
  }
});
```

These routes:
- Accept POST requests to `/api/clientes/:id/suspender` and `/api/clientes/:id/reactivar`
- Return the updated client object with the new `estado` field
- Are placed between the PUT route and the VISITAS ENDPOINTS section

- [ ] **Step 2: Commit**

```bash
git add backend/api/routes.js
git commit -m "feat: add POST /api/clientes/:id/suspender and reactivar endpoints"
```

---

## Task 4: Backend - Exclude Suspended Clients from Finance Calculations

**Files:**
- Modify: `backend/services/database.js` (locate `aumentoPreciosMasivo` method around line 389)

- [ ] **Step 1: Read current aumentoPreciosMasivo implementation**

Read the method at line 389-394 to confirm it filters by `activo = 1`.

- [ ] **Step 2: Update aumentoPreciosMasivo to also exclude suspended clients**

Find the `aumentoPreciosMasivo` method and update the WHERE clause:

```javascript
// OLD:
async aumentoPreciosMasivo(porcentaje) {
  const sql = `UPDATE clientes SET precio_abono = ROUND(precio_abono * (1.0 + ? / 100.0)), updated_at = CURRENT_TIMESTAMP
               WHERE activo = 1 AND precio_abono IS NOT NULL AND precio_abono > 0`
  const result = await this.execute(sql, [porcentaje])
  return { updated: result.changes }
}

// NEW:
async aumentoPreciosMasivo(porcentaje) {
  const sql = `UPDATE clientes SET precio_abono = ROUND(precio_abono * (1.0 + ? / 100.0)), updated_at = CURRENT_TIMESTAMP
               WHERE activo = 1 AND estado = 'activo' AND precio_abono IS NOT NULL AND precio_abono > 0`
  const result = await this.execute(sql, [porcentaje])
  return { updated: result.changes }
}
```

The added condition `estado = 'activo'` ensures suspended clients are never affected by price increases.

- [ ] **Step 3: Commit**

```bash
git add backend/services/database.js
git commit -m "fix: exclude suspended clients from price increase calculation"
```

---

## Task 5: Frontend - Add apiClient Methods for Suspend/Reactivate

**Files:**
- Modify: `frontend/src/services/api.js` (or appropriate API client file)

- [ ] **Step 1: Locate the apiClient file**

Find `frontend/src/services/api.js` (or similar). This file should have methods like `getClientes()`, `updateCliente()`, etc.

- [ ] **Step 2: Add two new methods to the apiClient object**

Add after the existing `updateCliente` method:

```javascript
async suspenderCliente(clienteId) {
  const response = await fetch(`${API_BASE_URL}/api/clientes/${clienteId}/suspender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to suspend client');
  return response.json();
},

async reactivarCliente(clienteId) {
  const response = await fetch(`${API_BASE_URL}/api/clientes/${clienteId}/reactivar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to reactivate client');
  return response.json();
},
```

These methods:
- Call the new backend routes
- Return the updated cliente object
- Follow the existing apiClient pattern

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.js
git commit -m "feat: add suspenderCliente and reactivarCliente methods to apiClient"
```

---

## Task 6: Frontend - Add Suspend/Reactivate Buttons to ClientForm

**Files:**
- Modify: `frontend/src/components/ClientForm.jsx`

- [ ] **Step 1: Read the current ClientForm component**

Read the file to understand the structure. Note where the submit button and cancel button are (typically near the end of the JSX return statement).

- [ ] **Step 2: Add state for managing suspend/reactivate loading state**

Find the `useState` declarations at the top of the component (around line 60-78) and add:

```javascript
const [suspending, setSuspending] = useState(false);
```

- [ ] **Step 3: Add handler function for suspend/reactivate**

Add this function after the existing form handlers (before the return statement):

```javascript
async function handleToggleSuspend() {
  if (!initialData?.id) return;

  const isSuspended = initialData.estado === 'suspendido';
  const actionFn = isSuspended ? apiClient.reactivarCliente : apiClient.suspenderCliente;
  const actionLabel = isSuspended ? 'Reactivar' : 'Suspender';

  if (!confirm(`¿${actionLabel} cliente "${initialData.nombre}"?`)) return;

  setSuspending(true);
  try {
    const result = await actionFn(initialData.id);
    if (result.success || result.cliente) {
      // Reload the cliente to reflect new estado
      const updated = await apiClient.getCliente(initialData.id);
      onSubmit(updated);
    }
  } catch (error) {
    console.error('Error toggling suspend:', error);
    alert(`Error: ${error.message}`);
  } finally {
    setSuspending(false);
  }
}
```

This function:
- Checks if in edit mode (initialData.id exists)
- Determines if currently suspended and calls appropriate action
- Shows confirmation dialog
- Calls apiClient method and reloads cliente data
- Calls onSubmit callback with updated data

- [ ] **Step 4: Add button to the JSX (before the existing submit/cancel buttons)**

Find the button section (typically at the end of the form JSX, near className with submit/cancel buttons). Add this conditional button before the existing submit button:

```jsx
{isEditMode && (
  <button
    type="button"
    onClick={handleToggleSuspend}
    disabled={suspending}
    className={`px-4 py-2 rounded font-medium transition ${
      initialData.estado === 'suspendido'
        ? 'bg-green-600 hover:bg-green-700 text-white'
        : 'bg-red-600 hover:bg-red-700 text-white'
    } disabled:opacity-50`}
  >
    {suspending ? 'Procesando...' : initialData.estado === 'suspendido' ? 'Reactivar' : 'Suspender'}
  </button>
)}
```

This button:
- Only shows in edit mode
- Shows "Suspender" (red) if client is activo, "Reactivar" (green) if suspendido
- Disables while processing
- Uses Tailwind styling consistent with the app

- [ ] **Step 5: Verify imports**

Ensure `apiClient` is imported at the top of the file. Check line 2 should have:
```javascript
import { apiClient } from '../services/api'
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ClientForm.jsx
git commit -m "feat: add suspend/reactivate buttons to ClientForm"
```

---

## Task 7: Frontend - Filter Active Clients in AgendaPage

**Files:**
- Modify: `frontend/src/pages/AgendaPage.jsx`

- [ ] **Step 1: Read the AgendaPage to understand client filtering**

Read `AgendaPage.jsx` around lines 77-120. Locate where `todosClientes` is used to filter which clients appear in the agenda.

- [ ] **Step 2: Locate the section that renders clients for the agenda**

Find where clients are displayed in the JSX (typically in a map or filter operation). Look for sections that iterate over `todosClientes` or a filtered version.

- [ ] **Step 3: Add filter to show only active clients**

When rendering clients for the agenda view, filter out suspended clients. For example, if you find a line like:

```javascript
const clientesActivos = todosClientes.filter(c => c.estado === 'activo');
```

should be used in place of `todosClientes` when displaying the schedule.

In the JSX render section, change from:
```jsx
{todosClientes.map(cliente => ...)}
```

to:
```jsx
{todosClientes.filter(c => c.estado === 'activo').map(cliente => ...)}
```

Or create a computed variable:
```javascript
const clientesEnAgenda = todosClientes.filter(c => c.estado === 'activo');
```

And use `clientesEnAgenda` in place of `todosClientes` for rendering.

**Note:** Do NOT filter clients from the data loading (`cargarDatos()`). The data should still load all clients so Fede can see if any are suspended, but they should not appear in the actual schedule/agenda view.

- [ ] **Step 4: Verify the change**

Confirm that:
- All clients are still loaded (state contains both active and suspended)
- Only active clients appear in the visual agenda display
- The change is minimal and doesn't affect other functionality

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AgendaPage.jsx
git commit -m "feat: exclude suspended clients from agenda view"
```

---

## Task 8: Frontend - Exclude Suspended Clients from Finance Calculations

**Files:**
- Modify: `frontend/src/pages/FinancePage.jsx`

- [ ] **Step 1: Read FinancePage to understand current finance logic**

Read the file to locate where "Ganancia Neta" or income calculations occur. Look for functions that calculate monthly earnings or client-based sums.

- [ ] **Step 2: Identify the ganancia neta calculation section**

Find the section that calculates net profit/earnings. This typically filters `clientes` and sums related `pagos` (payments). Look for comments or variable names like `gananciaNeta`, `totalIngresos`, or similar.

- [ ] **Step 3: Add filter to exclude suspended clients from calculations**

When calculating ganancia neta or total income per client, add a filter:

```javascript
// OLD (example):
const clientesParaCalculo = clientes;

// NEW:
const clientesParaCalculo = clientes.filter(c => c.estado === 'activo');
```

Then use `clientesParaCalculo` in all income/payment calculations:

```javascript
const gananciaPorCliente = clientesParaCalculo.map(c => {
  const pagosMes = pagos.filter(p => p.cliente_id === c.id && p.fecha.startsWith(mes));
  return pagosMes.reduce((sum, p) => sum + p.monto, 0);
});
```

**Important:** Do NOT filter gastos (expenses). Those remain global and should still be subtracted from the total, regardless of client status.

- [ ] **Step 4: Verify the change**

Confirm that:
- Suspended clients are not included in ganancia neta calculation
- Suspended clients are not included in individual client payment lists
- Gastos (expenses) remain unfiltered and always subtracted
- The "Ganancia Neta" decreases appropriately when a client is suspended

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/FinancePage.jsx
git commit -m "feat: exclude suspended clients from finance calculations"
```

---

## Task 9: Manual Testing

**Files:**
- Test against running backend and frontend servers

- [ ] **Step 1: Start backend server**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO\backend
npm start
```

Wait for "Server running on https://..." message.

- [ ] **Step 2: Start frontend server (in another terminal)**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO\frontend
npm run dev
```

Wait for "Local: http://localhost:5173" message.

- [ ] **Step 3: Open the app and verify initial state**

Navigate to the app in your browser. Go to Clientes page and create or view an existing client (e.g., "Casa Test").

- [ ] **Step 4: Edit the test client and verify Suspender button appears**

Click Edit on the test client. Confirm:
- "Suspender" button appears (red button)
- Button is in edit mode
- Button is not disabled

- [ ] **Step 5: Click Suspender button**

Confirm:
- Confirmation dialog appears asking to suspend the client
- After confirmation, button changes to "Reactivar" (green)
- Client.estado in the UI changes (if displayed) or refresh shows green button

- [ ] **Step 6: Verify client disappears from Agenda**

Navigate to Agenda page. Confirm:
- The suspended client no longer appears in the schedule
- Other active clients still appear

- [ ] **Step 7: Verify client excluded from Finance calculations**

Navigate to Finance page. Confirm:
- The suspended client does not appear in the client list or calculations
- Ganancia Neta decreased (if the client had pending/paid invoices)
- Gastos remain unchanged

- [ ] **Step 8: Reactivate the test client**

Return to Clientes page, edit the suspended client, click "Reactivar". Confirm:
- Button changes back to "Suspender" (red)
- estado changes back to 'activo'

- [ ] **Step 9: Verify client reappears in Agenda**

Navigate to Agenda. Confirm the client is back in the schedule.

- [ ] **Step 10: Verify client reappears in Finance**

Navigate to Finance. Confirm the client is back in calculations.

---

## Task 10: Verify All Commits and Clean Up

**Files:**
- Review git history and verify feature is complete

- [ ] **Step 1: Check commit history**

```bash
cd C:\Users\diego.robalo\Documents\CLAUDIA\PILETERO
git log --oneline -10
```

Expected output should show approximately 8-10 commits related to the feature:
1. Database schema migration (ALTER TABLE)
2. DatabaseService methods (suspender/reactivar)
3. API routes (POST /suspender, /reactivar)
4. Finance calculation fix (exclude suspended)
5. apiClient methods
6. ClientForm UI buttons
7. AgendaPage filtering
8. FinancePage filtering

- [ ] **Step 2: Run a final sanity check**

Verify that:
- Backend starts without errors
- Frontend starts without errors
- No TypeErrors or missing method errors in browser console
- All features work as expected

- [ ] **Step 3: Document completion**

Create a summary of what was implemented:
- Feature: Suspend/Reactivate clients
- Status: DONE
- Key files modified: backend/db/schema.sql, backend/services/database.js, backend/api/routes.js, frontend/src/components/ClientForm.jsx, frontend/src/pages/AgendaPage.jsx, frontend/src/pages/FinancePage.jsx
- Commits: [List SHA hashes from git log]

---

## Checklist Summary

- [ ] Task 1: Database migration (ALTER TABLE)
- [ ] Task 2: DatabaseService suspend/reactivate methods
- [ ] Task 3: Backend API routes (/suspender, /reactivar)
- [ ] Task 4: Exclude suspended from price increases
- [ ] Task 5: Frontend apiClient methods
- [ ] Task 6: ClientForm UI buttons
- [ ] Task 7: AgendaPage filtering
- [ ] Task 8: FinancePage filtering
- [ ] Task 9: Manual testing (all 10 substeps)
- [ ] Task 10: Verify commits and cleanup
