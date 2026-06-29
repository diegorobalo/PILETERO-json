import express from 'express';
import databaseService from '../services/database.js';

const router = express.Router();

// ==================== CLIENTES ENDPOINTS ====================

/**
 * GET /api/clientes
 * Get all active clients
 */
router.get('/clientes', async (req, res) => {
  try {
    const clientes = await databaseService.getAllClientes();
    res.json(clientes);
  } catch (error) {
    console.error('Error getting clientes:', error);
    res.status(500).json({ error: 'Failed to retrieve clients' });
  }
});

/**
 * GET /api/clientes/:id
 * Get a specific client by ID
 */
router.get('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await databaseService.getClienteById(id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    res.json(cliente);
  } catch (error) {
    console.error('Error getting cliente:', error);
    res.status(500).json({ error: 'Failed to retrieve client' });
  }
});

/**
 * POST /api/clientes
 * Create a new client
 * Required: nombre, direccion
 */
router.post('/clientes', async (req, res) => {
  try {
    const { nombre, direccion } = req.body;

    // Validate required fields
    if (!nombre || !direccion) {
      return res.status(400).json({ error: 'nombre and direccion are required' });
    }

    const cliente = await databaseService.createCliente(req.body);
    res.status(201).json(cliente);
  } catch (error) {
    console.error('Error creating cliente:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * PUT /api/clientes/:id
 * Update a client
 */
router.put('/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const cliente = await databaseService.getClienteById(id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    const updatedCliente = await databaseService.updateCliente(id, req.body);
    res.json({ success: true, cliente: updatedCliente });
  } catch (error) {
    console.error('Error updating cliente:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

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

// ==================== VISITAS ENDPOINTS ====================

/**
 * GET /api/visitas
 * Get all visits with client info
 */
router.get('/visitas', async (req, res) => {
  try {
    const visitas = await databaseService.getAllVisitas();
    res.json(visitas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve visits' });
  }
});

/**
 * GET /api/visitas/fecha/:fecha
 * Get visits for a specific date
 */
router.get('/visitas/fecha/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    const visitas = await databaseService.getVisitasByFecha(fecha);
    res.json(visitas);
  } catch (error) {
    console.error('Error getting visitas by fecha:', error);
    res.status(500).json({ error: 'Failed to retrieve visits' });
  }
});

/**
 * GET /api/visitas/cliente/:clienteId
 * Get visits for a specific client
 */
router.get('/visitas/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;

    // Check if client exists
    const cliente = await databaseService.getClienteById(clienteId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    const visitas = await databaseService.getVisitasByCliente(clienteId);
    res.json(visitas);
  } catch (error) {
    console.error('Error getting visitas by cliente:', error);
    res.status(500).json({ error: 'Failed to retrieve visits' });
  }
});

/**
 * POST /api/visitas
 * Create a new visit
 * Required: cliente_id, fecha
 */
router.post('/visitas', async (req, res) => {
  try {
    const { cliente_id, fecha } = req.body;

    // Validate required fields
    if (!cliente_id || !fecha) {
      return res.status(400).json({ error: 'cliente_id and fecha are required' });
    }

    // Check if client exists
    const cliente = await databaseService.getClienteById(cliente_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    const visita = await databaseService.createVisita(req.body);
    res.status(201).json(visita);
  } catch (error) {
    console.error('Error creating visita:', error);
    res.status(500).json({ error: 'Failed to create visit' });
  }
});

/**
 * PUT /api/visitas/:id
 * Update a visit
 */
router.put('/visitas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if visit exists
    const visita = await databaseService.queryOne('SELECT * FROM visitas WHERE id = ?', [id]);
    if (!visita) {
      return res.status(404).json({ error: 'Visita not found' });
    }

    const updatedVisita = await databaseService.updateVisita(id, req.body);
    res.json({ success: true, visita: updatedVisita });
  } catch (error) {
    console.error('Error updating visita:', error);
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

/**
 * DELETE /api/visitas/:id
 */
router.delete('/visitas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const visita = await databaseService.queryOne('SELECT * FROM visitas WHERE id = ?', [id]);
    if (!visita) {
      return res.status(404).json({ error: 'Visita not found' });
    }
    await databaseService.deleteVisita(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting visita:', error);
    res.status(500).json({ error: 'Failed to delete visit' });
  }
});

/**
 * GET /api/visitas/:id/fotos
 * Get photos for a specific visit
 */
router.get('/visitas/:id/fotos', async (req, res) => {
  try {
    const fotos = await databaseService.getFotosByVisita(req.params.id);
    res.json(fotos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve photos' });
  }
});

/**
 * GET /api/clientes/:id/fotos-cliente
 */
router.get('/clientes/:id/fotos-cliente', async (req, res) => {
  try {
    res.json(await databaseService.getFotosCliente(req.params.id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve client photos' });
  }
});

/**
 * POST /api/clientes/:id/fotos-cliente
 * body: { tipo, data }  — max 2 fotos por cliente
 */
router.post('/clientes/:id/fotos-cliente', async (req, res) => {
  try {
    const clienteId = req.params.id;
    const { tipo, data } = req.body;
    if (!data) return res.status(400).json({ error: 'data (base64) es requerido' });
    const existentes = await databaseService.getFotosCliente(clienteId);
    if (existentes.length >= 2) return res.status(400).json({ error: 'Máximo 2 fotos por cliente' });
    const foto = await databaseService.saveFotoCliente({ cliente_id: clienteId, tipo, data });
    res.status(201).json(foto);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save client photo' });
  }
});

/**
 * DELETE /api/fotos-cliente/:id
 */
router.delete('/fotos-cliente/:id', async (req, res) => {
  try {
    await databaseService.deleteFotoCliente(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete client photo' });
  }
});

/**
 * PATCH /api/clientes/aumento-masivo
 * Apply % increase to all clients' precio_abono
 */
router.patch('/clientes/aumento-masivo', async (req, res) => {
  try {
    const { porcentaje } = req.body;
    const pct = parseFloat(porcentaje);
    if (isNaN(pct) || pct === 0 || pct < -99 || pct > 200) {
      return res.status(400).json({ error: 'porcentaje debe ser entre -99 y 200 (sin incluir 0)' });
    }
    const result = await databaseService.aumentoPreciosMasivo(pct);
    res.json({ success: true, updated: result.updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply price increase' });
  }
});

// ==================== PAGOS ENDPOINTS ====================

/**
 * GET /api/pagos
 * Get all payments with client info
 */
router.get('/pagos', async (req, res) => {
  try {
    res.json(await databaseService.getAllPagos());
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

/**
 * POST /api/pagos
 */
router.post('/pagos', async (req, res) => {
  try {
    const { cliente_id, monto } = req.body;
    if (!cliente_id || !monto) return res.status(400).json({ error: 'cliente_id and monto son requeridos' });
    const pago = await databaseService.createPago(req.body);
    res.status(201).json(pago);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

/**
 * GET /api/pagos/cliente/:clienteId
 */
router.get('/pagos/cliente/:clienteId', async (req, res) => {
  try {
    res.json(await databaseService.getPagosByCliente(req.params.clienteId));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

/**
 * DELETE /api/pagos/:id
 */
router.delete('/pagos/:id', async (req, res) => {
  try {
    await databaseService.deletePago(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// ==================== INVENTARIO ENDPOINTS ====================

router.get('/inventario', async (req, res) => {
  try {
    res.json(await databaseService.getAllInventario());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/inventario', async (req, res) => {
  try {
    if (!req.body.nombre) return res.status(400).json({ error: 'nombre requerido' });
    res.status(201).json(await databaseService.createInventario(req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/inventario/:id', async (req, res) => {
  try {
    res.json(await databaseService.updateInventario(req.params.id, req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/inventario/:id/ajustar  body: { cantidad: +100 | -50 }
router.patch('/inventario/:id/ajustar', async (req, res) => {
  try {
    const { cantidad } = req.body;
    if (cantidad === undefined) return res.status(400).json({ error: 'cantidad requerida' });
    res.json(await databaseService.ajustarStock(req.params.id, cantidad));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/inventario/:id', async (req, res) => {
  try {
    await databaseService.deleteInventario(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/inventario/:id/movimientos', async (req, res) => {
  try {
    res.json(await databaseService.getMovimientosByInsumo(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== CONFIGURACION ENDPOINTS ====================

router.get('/configuracion', async (req, res) => {
  try {
    res.json(await databaseService.getAllConfig());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/configuracion', async (req, res) => {
  try {
    const { clave, valor } = req.body;
    if (!clave) return res.status(400).json({ error: 'clave requerida' });
    res.json(await databaseService.setConfig(clave, valor ?? ''));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== GASTOS ENDPOINTS ====================

router.get('/gastos', async (req, res) => {
  try {
    res.json(await databaseService.getAllGastos());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/gastos', async (req, res) => {
  try {
    const { descripcion, monto } = req.body;
    if (!descripcion || !monto) return res.status(400).json({ error: 'descripcion y monto requeridos' });
    res.status(201).json(await databaseService.createGasto(req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/gastos/:id', async (req, res) => {
  try {
    await databaseService.deleteGasto(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
