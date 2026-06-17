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

// ==================== VISITAS ENDPOINTS ====================

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

// ==================== PAGOS ENDPOINTS ====================

/**
 * POST /api/pagos
 * Create a new payment
 * Required: cliente_id, monto
 */
router.post('/pagos', async (req, res) => {
  try {
    const { cliente_id, monto, metodo_pago } = req.body;

    // Validate required fields
    if (!cliente_id || !monto) {
      return res.status(400).json({ error: 'cliente_id and monto are required' });
    }

    // Check if client exists
    const cliente = await databaseService.getClienteById(cliente_id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    const pago = await databaseService.createPago(cliente_id, monto, metodo_pago);
    res.status(201).json(pago);
  } catch (error) {
    console.error('Error creating pago:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

/**
 * GET /api/pagos/cliente/:clienteId
 * Get payments for a specific client
 */
router.get('/pagos/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;

    // Check if client exists
    const cliente = await databaseService.getClienteById(clienteId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente not found' });
    }

    const pagos = await databaseService.getPagosByCliente(clienteId);
    res.json(pagos);
  } catch (error) {
    console.error('Error getting pagos by cliente:', error);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

export default router;
