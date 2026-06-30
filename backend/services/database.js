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
   * Get all clients (both active and suspended)
   */
  async getAllClientes() {
    return this.query('SELECT * FROM clientes ORDER BY nombre');
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
      frecuencia_visita,
      grupo_semana,
      notas_acceso
    } = data;

    const sql = `
      INSERT INTO clientes (
        nombre, direccion, telefono, volumen_litros, tipo_construccion,
        equipamiento, modelo_filtro, tipo_abono, precio_abono,
        dias_visita, frecuencia_visita, grupo_semana, notas_acceso
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      frecuencia_visita || 'semanal',
      grupo_semana || 'A',
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
      'frecuencia_visita',
      'grupo_semana',
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

  // ==================== FOTOS (Photos) ====================

  async getFotosByVisita(visitaId) {
    return this.query('SELECT * FROM fotos WHERE visita_id = ?', [visitaId]);
  }

  async saveFoto({ visita_id, tipo, data }) {
    // ruta_archivo stores base64 data for photos synced from mobile
    const sql = 'INSERT INTO fotos (visita_id, tipo, ruta_archivo) VALUES (?, ?, ?)';
    const result = await this.execute(sql, [visita_id, tipo || 'general', data]);
    return result.lastID;
  }

  // ==================== VISITAS (Visits) ====================

  /**
   * Get visits for a specific client
   */
  async getAllVisitas(limit = 200) {
    return this.query(
      `SELECT v.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion
       FROM visitas v LEFT JOIN clientes c ON v.cliente_id = c.id
       ORDER BY v.fecha DESC, v.created_at DESC LIMIT ?`,
      [limit]
    );
  }

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
      observaciones,
      extras
    } = data;

    const sql = `
      INSERT INTO visitas (
        cliente_id, fecha, hora_inicio, hora_fin, tareas_realizadas,
        cloro_ppm, ph, quimicos_usados, observaciones, extras
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      cliente_id,
      fecha,
      hora_inicio || null,
      hora_fin || null,
      typeof tareas_realizadas === 'string' ? tareas_realizadas : (tareas_realizadas ? JSON.stringify(tareas_realizadas) : null),
      cloro_ppm || null,
      ph || null,
      typeof quimicos_usados === 'string' ? quimicos_usados : (quimicos_usados ? JSON.stringify(quimicos_usados) : null),
      observaciones || null,
      typeof extras === 'string' ? extras : (extras ? JSON.stringify(extras) : JSON.stringify([]))
    ];

    const result = await this.execute(sql, params);

    // Auto-descuento de inventario basado en quimicos usados
    const quimicosRaw = typeof quimicos_usados === 'string'
      ? JSON.parse(quimicos_usados || '{}')
      : (quimicos_usados || {});

    const QUIMICO_MAP = {
      cloroGranulado: 'cloro granulado',
      cloroLiquido: 'cloro líquido',
      phMas: 'ph+',
      phMenos: 'ph−',
      algicida: 'algicida',
      floculante: 'floculante',
    };

    for (const [clave, nombre] of Object.entries(QUIMICO_MAP)) {
      const cant = parseFloat(quimicosRaw[clave]);
      if (!cant || cant <= 0) continue;
      try {
        const insumo = await this.queryOne(
          "SELECT id FROM inventario WHERE LOWER(nombre) LIKE ? LIMIT 1",
          [`%${nombre}%`]
        );
        if (!insumo) continue;
        await this.execute(
          'UPDATE inventario SET stock_actual = MAX(0, stock_actual - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [cant, insumo.id]
        );
        await this.registrarMovimiento({
          insumo_id: insumo.id,
          tipo: 'uso',
          cantidad: -cant,
          origen: 'visita',
          referencia_id: result.lastID,
          fecha: fecha,
        });
      } catch (err) {
        console.warn(`[auto-stock] No se pudo descontar ${nombre}:`, err.message);
      }
    }

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

        // Handle JSON fields
        if (key === 'tareas_realizadas' || key === 'quimicos_usados') {
          params.push(typeof value === 'string' ? value : (value ? JSON.stringify(value) : null));
        } else {
          params.push(value);
        }
      }
    }

    if (updates.length === 0) return this.queryOne('SELECT * FROM visitas WHERE id = ?', [id]);

    params.push(id);
    const sql = `UPDATE visitas SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    await this.execute(sql, params);
    return this.queryOne('SELECT * FROM visitas WHERE id = ?', [id]);
  }

  /**
   * Delete a visit record
   */
  async deleteVisita(id) {
    await this.execute('DELETE FROM visitas WHERE id = ?', [id]);
  }

  // ==================== PAGOS (Payments) ====================

  /**
   * Create a new payment record
   */
  async createPago({ cliente_id, monto, fecha, metodo_pago, estado, mes }) {
    const sql = `INSERT INTO pagos (cliente_id, monto, fecha, metodo_pago, estado, mes)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const result = await this.execute(sql, [
      cliente_id, monto,
      fecha || new Date().toISOString().split('T')[0],
      metodo_pago || 'efectivo',
      estado || 'pagado',
      mes || null,
    ]);
    return this.queryOne('SELECT * FROM pagos WHERE id = ?', [result.lastID]);
  }

  async getAllPagos(limit = 500) {
    return this.query(
      `SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion
       FROM pagos p LEFT JOIN clientes c ON p.cliente_id = c.id
       ORDER BY p.fecha DESC, p.created_at DESC LIMIT ?`,
      [limit]
    );
  }

  async getPagosByCliente(clienteId) {
    return this.query(
      'SELECT * FROM pagos WHERE cliente_id = ? ORDER BY fecha DESC',
      [clienteId]
    );
  }

  async updatePago(id, data) {
    const allowed = ['monto', 'fecha', 'metodo_pago', 'estado', 'mes'];
    const updates = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
    if (!updates.length) return this.queryOne('SELECT * FROM pagos WHERE id = ?', [id]);
    params.push(id);
    await this.execute(`UPDATE pagos SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    return this.queryOne('SELECT * FROM pagos WHERE id = ?', [id]);
  }

  async deletePago(id) {
    await this.execute('DELETE FROM pagos WHERE id = ?', [id]);
  }

  // ==================== FOTOS CLIENTES ====================

  async getFotosCliente(clienteId) {
    return this.query('SELECT * FROM fotos_clientes WHERE cliente_id = ? ORDER BY created_at', [clienteId]);
  }

  async saveFotoCliente({ cliente_id, tipo, data }) {
    const result = await this.execute(
      'INSERT INTO fotos_clientes (cliente_id, tipo, ruta_archivo) VALUES (?, ?, ?)',
      [cliente_id, tipo || null, data]
    );
    return this.queryOne('SELECT * FROM fotos_clientes WHERE id = ?', [result.lastID]);
  }

  async deleteFotoCliente(id) {
    await this.execute('DELETE FROM fotos_clientes WHERE id = ?', [id]);
  }

  async aumentoPreciosMasivo(porcentaje) {
    const sql = `UPDATE clientes SET precio_abono = ROUND(precio_abono * (1.0 + ? / 100.0)), updated_at = CURRENT_TIMESTAMP
                 WHERE activo = 1 AND estado = 'activo' AND precio_abono IS NOT NULL AND precio_abono > 0`
    const result = await this.execute(sql, [porcentaje])
    return { updated: result.changes }
  }

  // ==================== INVENTARIO ====================

  async getAllInventario() {
    return this.query('SELECT * FROM inventario ORDER BY nombre');
  }

  async getInventarioById(id) {
    return this.queryOne('SELECT * FROM inventario WHERE id = ?', [id]);
  }

  async createInventario(data) {
    const { nombre, unidad, stock_actual, stock_minimo, precio_unitario } = data;
    const result = await this.execute(
      'INSERT INTO inventario (nombre, unidad, stock_actual, stock_minimo, precio_unitario) VALUES (?, ?, ?, ?, ?)',
      [nombre, unidad || 'g', stock_actual || 0, stock_minimo || 0, precio_unitario || null]
    );
    return this.getInventarioById(result.lastID);
  }

  async updateInventario(id, data) {
    const allowed = ['nombre', 'unidad', 'stock_actual', 'stock_minimo', 'precio_unitario'];
    const updates = [];
    const params = [];
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); params.push(value); }
    }
    if (!updates.length) return this.getInventarioById(id);
    params.push(id);
    await this.execute(`UPDATE inventario SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
    return this.getInventarioById(id);
  }

  async ajustarStock(id, cantidad) {
    await this.execute(
      'UPDATE inventario SET stock_actual = MAX(0, stock_actual + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [cantidad, id]
    );
    await this.registrarMovimiento({
      insumo_id: id,
      tipo: cantidad > 0 ? 'compra' : 'uso',
      cantidad,
      origen: 'manual',
      fecha: new Date().toISOString().split('T')[0],
    });
    return this.getInventarioById(id);
  }

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

  // Valida stock pero NO bloquea. Retorna {hasStock: bool, stockDisponible: number}
  validateInsumoStock(insumo_id, cantidad) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT stock_actual as stock FROM inventario WHERE id = ?'
      this.db.get(sql, [insumo_id], (err, row) => {
        if (err) return reject(err)
        if (!row) return resolve({ hasStock: false, stockDisponible: 0, error: 'Insumo no existe' })

        const hasStock = row.stock >= cantidad
        resolve({ hasStock, stockDisponible: row.stock })
      })
    })
  }

  async deleteInventario(id) {
    return this.execute('DELETE FROM inventario WHERE id = ?', [id]);
  }

  // ==================== MOVIMIENTOS INVENTARIO ====================

  async registrarMovimiento({ insumo_id, tipo, cantidad, origen, referencia_id, fecha }) {
    await this.execute(
      'INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, origen, referencia_id, fecha) VALUES (?, ?, ?, ?, ?, ?)',
      [insumo_id, tipo, cantidad, origen || 'manual', referencia_id || null, fecha || new Date().toISOString().split('T')[0]]
    );
  }

  async getMovimientosByInsumo(insumoId, limit = 50) {
    return this.query(
      'SELECT * FROM movimientos_inventario WHERE insumo_id = ? ORDER BY fecha DESC, created_at DESC LIMIT ?',
      [insumoId, limit]
    );
  }

  // ==================== CONFIGURACION ====================

  async getConfig(clave) {
    const row = await this.queryOne('SELECT valor FROM configuracion WHERE clave = ?', [clave]);
    return row ? row.valor : null;
  }

  async getAllConfig() {
    const rows = await this.query('SELECT clave, valor FROM configuracion');
    return rows.reduce((acc, r) => { acc[r.clave] = r.valor; return acc; }, {});
  }

  async setConfig(clave, valor) {
    await this.execute(
      'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
      [clave, valor]
    );
    return { clave, valor };
  }

  // ==================== GASTOS ====================

  async createGasto({ descripcion, monto, fecha, categoria }) {
    const result = await this.execute(
      'INSERT INTO gastos (descripcion, monto, fecha, categoria) VALUES (?, ?, ?, ?)',
      [descripcion, monto, fecha || new Date().toISOString().split('T')[0], categoria || 'otros']
    );
    return this.queryOne('SELECT * FROM gastos WHERE id = ?', [result.lastID]);
  }

  async getAllGastos(limit = 500) {
    return this.query('SELECT * FROM gastos ORDER BY fecha DESC, created_at DESC LIMIT ?', [limit]);
  }

  async deleteGasto(id) {
    await this.execute('DELETE FROM gastos WHERE id = ?', [id]);
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
