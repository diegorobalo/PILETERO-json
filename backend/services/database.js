import Database from 'sqlite3';
import { promisify } from 'util';

/**
 * DatabaseService - Wrapper around SQLite database operations
 * Provides promise-based methods for database queries and CRUD operations
 */
class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  init(db) {
    this.db = db;
  }

  /**
   * Promise wrapper for db.all (multiple rows)
   */
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Promise wrapper for db.get (single row)
   */
  queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Promise wrapper for db.run (insert, update, delete)
   */
  execute(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  // ==================== CLIENTES (Clients) ====================

  /**
   * Get all active clients
   */
  async getAllClientes() {
    return this.query('SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre');
  }

  /**
   * Get client by ID
   */
  async getClienteById(id) {
    return this.queryOne('SELECT * FROM clientes WHERE id = ?', [id]);
  }

  /**
   * Create a new client
   */
  async createCliente(data) {
    const {
      nombre,
      direccion,
      telefono,
      volumen_litros,
      tipo_construccion,
      equipamiento,
      modelo_filtro,
      tipo_abono,
      precio_abono,
      dias_visita,
      notas_acceso
    } = data;

    const sql = `
      INSERT INTO clientes (
        nombre, direccion, telefono, volumen_litros, tipo_construccion,
        equipamiento, modelo_filtro, tipo_abono, precio_abono,
        dias_visita, notas_acceso
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      nombre,
      direccion || null,
      telefono || null,
      volumen_litros || null,
      tipo_construccion || null,
      equipamiento || null,
      modelo_filtro || null,
      tipo_abono || null,
      precio_abono || null,
      dias_visita || null,
      notas_acceso || null
    ];

    const result = await this.execute(sql, params);
    return this.getClienteById(result.lastID);
  }

  /**
   * Update client information
   */
  async updateCliente(id, data) {
    const allowedFields = [
      'nombre',
      'direccion',
      'telefono',
      'volumen_litros',
      'tipo_construccion',
      'equipamiento',
      'modelo_filtro',
      'tipo_abono',
      'precio_abono',
      'dias_visita',
      'notas_acceso',
      'activo'
    ];

    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (updates.length === 0) return this.getClienteById(id);

    params.push(id);
    const sql = `UPDATE clientes SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    await this.execute(sql, params);
    return this.getClienteById(id);
  }

  // ==================== VISITAS (Visits) ====================

  /**
   * Get visits for a specific client
   */
  async getVisitasByCliente(clienteId) {
    return this.query(
      'SELECT * FROM visitas WHERE cliente_id = ? ORDER BY fecha DESC',
      [clienteId]
    );
  }

  /**
   * Get visits for a specific date
   */
  async getVisitasByFecha(fecha) {
    return this.query(
      'SELECT * FROM visitas WHERE fecha = ? ORDER BY hora_inicio',
      [fecha]
    );
  }

  /**
   * Create a new visit record
   */
  async createVisita(data) {
    const {
      cliente_id,
      fecha,
      hora_inicio,
      hora_fin,
      tareas_realizadas,
      cloro_ppm,
      ph,
      quimicos_usados,
      observaciones
    } = data;

    const sql = `
      INSERT INTO visitas (
        cliente_id, fecha, hora_inicio, hora_fin, tareas_realizadas,
        cloro_ppm, ph, quimicos_usados, observaciones
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      cliente_id,
      fecha,
      hora_inicio || null,
      hora_fin || null,
      tareas_realizadas || null,
      cloro_ppm || null,
      ph || null,
      quimicos_usados || null,
      observaciones || null
    ];

    const result = await this.execute(sql, params);
    return this.queryOne('SELECT * FROM visitas WHERE id = ?', [result.lastID]);
  }

  /**
   * Update visit record
   */
  async updateVisita(id, data) {
    const allowedFields = [
      'hora_inicio',
      'hora_fin',
      'tareas_realizadas',
      'cloro_ppm',
      'ph',
      'quimicos_usados',
      'observaciones',
      'sincronizada'
    ];

    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (updates.length === 0) return this.queryOne('SELECT * FROM visitas WHERE id = ?', [id]);

    params.push(id);
    const sql = `UPDATE visitas SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    await this.execute(sql, params);
    return this.queryOne('SELECT * FROM visitas WHERE id = ?', [id]);
  }

  // ==================== FOTOS (Photos) ====================

  /**
   * Create a new photo record
   */
  async createFoto(visitaId, tipo, rutaArchivo) {
    const sql = 'INSERT INTO fotos (visita_id, tipo, ruta_archivo) VALUES (?, ?, ?)';
    const result = await this.execute(sql, [visitaId, tipo, rutaArchivo]);
    return this.queryOne('SELECT * FROM fotos WHERE id = ?', [result.lastID]);
  }

  /**
   * Get photos for a specific visit
   */
  async getFotosByVisita(visitaId) {
    return this.query('SELECT * FROM fotos WHERE visita_id = ? ORDER BY uploaded_at', [visitaId]);
  }

  // ==================== PAGOS (Payments) ====================

  /**
   * Create a new payment record
   */
  async createPago(clienteId, monto, metodo) {
    const sql = `
      INSERT INTO pagos (cliente_id, monto, fecha, metodo_pago)
      VALUES (?, ?, DATE('now'), ?)
    `;
    const result = await this.execute(sql, [clienteId, monto, metodo]);
    return this.queryOne('SELECT * FROM pagos WHERE id = ?', [result.lastID]);
  }

  /**
   * Get payments for a specific client
   */
  async getPagosByCliente(clienteId) {
    return this.query(
      'SELECT * FROM pagos WHERE cliente_id = ? ORDER BY fecha DESC',
      [clienteId]
    );
  }

  // ==================== SYNC ====================

  /**
   * Get all unsynced visits
   */
  async getUnsynced() {
    return this.query('SELECT * FROM visitas WHERE sincronizada = 0 ORDER BY created_at');
  }

  /**
   * Mark visit as synced
   */
  async markSynced(visitaId) {
    const sql = 'UPDATE visitas SET sincronizada = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await this.execute(sql, [visitaId]);
    return this.queryOne('SELECT * FROM visitas WHERE id = ?', [visitaId]);
  }
}

// Create and export singleton instance
const databaseService = new DatabaseService('./piletero.db');
export default databaseService;
