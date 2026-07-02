import { createClient } from '@libsql/client';

let client;

function getClient() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

const now = () => new Date().toISOString();
const toInt = (v) => v != null ? parseInt(v, 10) : v;
const rowToObj = (row) => {
  if (!row) return null;
  const obj = {};
  for (const [k, v] of Object.entries(row)) {
    obj[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return obj;
};
const rowsToObjs = (rows) => rows.map(rowToObj);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    volumen_litros REAL,
    tipo_construccion TEXT,
    equipamiento TEXT,
    modelo_filtro TEXT,
    tipo_abono TEXT,
    precio_abono REAL,
    dias_visita TEXT,
    frecuencia_visita TEXT DEFAULT 'semanal',
    grupo_semana TEXT DEFAULT 'A',
    notas_acceso TEXT,
    activo INTEGER DEFAULT 1,
    estado TEXT DEFAULT 'activo',
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    fecha TEXT,
    hora_inicio TEXT,
    hora_fin TEXT,
    tareas_realizadas TEXT,
    cloro_ppm REAL,
    ph REAL,
    quimicos_usados TEXT,
    observaciones TEXT,
    extras TEXT DEFAULT '[]',
    sincronizada INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    unidad TEXT DEFAULT 'g',
    stock_actual REAL DEFAULT 0,
    stock_minimo REAL DEFAULT 0,
    precio_unitario REAL,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    monto REAL,
    fecha TEXT,
    metodo_pago TEXT DEFAULT 'efectivo',
    estado TEXT DEFAULT 'pagado',
    mes TEXT,
    tipo_abono TEXT,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descripcion TEXT,
    monto REAL,
    fecha TEXT,
    categoria TEXT DEFAULT 'otros',
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insumo_id INTEGER,
    tipo TEXT,
    cantidad REAL,
    origen TEXT,
    referencia_id INTEGER,
    fecha TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visita_id INTEGER,
    tipo TEXT DEFAULT 'general',
    ruta_archivo TEXT,
    uploaded_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS fotos_clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    tipo TEXT,
    ruta_archivo TEXT,
    created_at TEXT
  )`,
];

class DatabaseService {
  async init() {
    const db = getClient();
    for (const sql of SCHEMA) {
      await db.execute(sql);
    }
    console.log('Turso database initialized');
  }

  // Used by sync-service and routes for ad-hoc queries
  async queryOne(sql, params = []) {
    const db = getClient();
    const result = await db.execute({ sql, args: params });
    return result.rows.length > 0 ? rowToObj(result.rows[0]) : null;
  }

  // ==================== CLIENTES ====================

  async getAllClientes() {
    const db = getClient();
    const result = await db.execute('SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre ASC');
    return rowsToObjs(result.rows);
  }

  async getClienteById(id) {
    const db = getClient();
    const result = await db.execute({ sql: 'SELECT * FROM clientes WHERE id = ?', args: [toInt(id)] });
    return result.rows.length > 0 ? rowToObj(result.rows[0]) : null;
  }

  async createCliente(data) {
    const db = getClient();
    const {
      nombre, direccion, telefono, volumen_litros, tipo_construccion,
      equipamiento, modelo_filtro, tipo_abono, precio_abono,
      dias_visita, frecuencia_visita, grupo_semana, notas_acceso
    } = data;

    const result = await db.execute({
      sql: `INSERT INTO clientes (nombre, direccion, telefono, volumen_litros, tipo_construccion,
            equipamiento, modelo_filtro, tipo_abono, precio_abono, dias_visita,
            frecuencia_visita, grupo_semana, notas_acceso, activo, estado, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'activo', ?, ?)`,
      args: [nombre, direccion || null, telefono || null, volumen_litros || null,
             tipo_construccion || null, equipamiento || null, modelo_filtro || null,
             tipo_abono || null, precio_abono || null, dias_visita || null,
             frecuencia_visita || 'semanal', grupo_semana || 'A', notas_acceso || null,
             now(), now()]
    });

    return this.getClienteById(Number(result.lastInsertRowid));
  }

  async updateCliente(id, data) {
    const db = getClient();
    const allowedFields = [
      'nombre', 'direccion', 'telefono', 'volumen_litros', 'tipo_construccion',
      'equipamiento', 'modelo_filtro', 'tipo_abono', 'precio_abono', 'dias_visita',
      'frecuencia_visita', 'grupo_semana', 'notas_acceso', 'activo'
    ];

    const updates = [];
    const args = [];
    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        args.push(value);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      args.push(now());
      args.push(toInt(id));
      await db.execute({ sql: `UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`, args });
    }

    return this.getClienteById(toInt(id));
  }

  async suspenderCliente(id) {
    const db = getClient();
    await db.execute({
      sql: `UPDATE clientes SET estado = 'suspendido', updated_at = ? WHERE id = ?`,
      args: [now(), toInt(id)]
    });
    return this.getClienteById(toInt(id));
  }

  async reactivarCliente(id) {
    const db = getClient();
    await db.execute({
      sql: `UPDATE clientes SET estado = 'activo', updated_at = ? WHERE id = ?`,
      args: [now(), toInt(id)]
    });
    return this.getClienteById(toInt(id));
  }

  async aumentoPreciosMasivo(porcentaje) {
    const db = getClient();
    const result = await db.execute({
      sql: `UPDATE clientes SET precio_abono = ROUND(precio_abono * (1.0 + ? / 100.0)), updated_at = ?
            WHERE activo = 1 AND estado = 'activo' AND precio_abono IS NOT NULL AND precio_abono > 0`,
      args: [porcentaje, now()]
    });
    return { updated: Number(result.rowsAffected) };
  }

  // ==================== VISITAS ====================

  async getAllVisitas(limit = 200) {
    const db = getClient();
    const result = await db.execute({
      sql: `SELECT v.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion
            FROM visitas v LEFT JOIN clientes c ON v.cliente_id = c.id
            ORDER BY v.fecha DESC, v.id DESC LIMIT ?`,
      args: [limit]
    });
    return rowsToObjs(result.rows);
  }

  async getVisitasByCliente(clienteId) {
    const db = getClient();
    const result = await db.execute({
      sql: 'SELECT * FROM visitas WHERE cliente_id = ? ORDER BY fecha DESC, id DESC',
      args: [toInt(clienteId)]
    });
    return rowsToObjs(result.rows);
  }

  async getVisitasByFecha(fecha) {
    const db = getClient();
    const result = await db.execute({
      sql: 'SELECT * FROM visitas WHERE fecha = ? ORDER BY hora_inicio ASC',
      args: [fecha]
    });
    return rowsToObjs(result.rows);
  }

  async getVisitaById(id) {
    const db = getClient();
    const result = await db.execute({ sql: 'SELECT * FROM visitas WHERE id = ?', args: [toInt(id)] });
    return result.rows.length > 0 ? rowToObj(result.rows[0]) : null;
  }

  async createVisita(data) {
    const db = getClient();
    const {
      cliente_id, fecha, hora_inicio, hora_fin, tareas_realizadas,
      cloro_ppm, ph, quimicos_usados, observaciones, extras
    } = data;

    const quimicosStr = typeof quimicos_usados === 'string'
      ? quimicos_usados
      : JSON.stringify(quimicos_usados || []);
    const extrasStr = typeof extras === 'string'
      ? extras
      : JSON.stringify(extras || []);
    const tareasStr = typeof tareas_realizadas === 'string'
      ? tareas_realizadas
      : (tareas_realizadas ? JSON.stringify(tareas_realizadas) : null);

    const result = await db.execute({
      sql: `INSERT INTO visitas (cliente_id, fecha, hora_inicio, hora_fin, tareas_realizadas,
            cloro_ppm, ph, quimicos_usados, observaciones, extras, sincronizada, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [toInt(cliente_id), fecha, hora_inicio || null, hora_fin || null, tareasStr,
             cloro_ppm || null, ph || null, quimicosStr, observaciones || null, extrasStr,
             now(), now()]
    });

    return this.getVisitaById(Number(result.lastInsertRowid));
  }

  async updateVisita(id, data) {
    const db = getClient();
    const allowedFields = [
      'hora_inicio', 'hora_fin', 'tareas_realizadas', 'cloro_ppm',
      'ph', 'quimicos_usados', 'observaciones', 'sincronizada', 'extras'
    ];

    const updates = [];
    const args = [];
    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        if (key === 'tareas_realizadas' || key === 'quimicos_usados' || key === 'extras') {
          args.push(typeof value === 'string' ? value : (value != null ? JSON.stringify(value) : null));
        } else {
          args.push(value);
        }
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      args.push(now());
      args.push(toInt(id));
      await db.execute({ sql: `UPDATE visitas SET ${updates.join(', ')} WHERE id = ?`, args });
    }

    return this.getVisitaById(toInt(id));
  }

  async deleteVisita(id) {
    const db = getClient();
    await db.execute({ sql: 'DELETE FROM visitas WHERE id = ?', args: [toInt(id)] });
  }

  // ==================== FOTOS ====================

  async getFotosByVisita(visitaId) {
    const db = getClient();
    const result = await db.execute({ sql: 'SELECT * FROM fotos WHERE visita_id = ?', args: [toInt(visitaId)] });
    return rowsToObjs(result.rows);
  }

  async saveFoto({ visita_id, tipo, data }) {
    const db = getClient();
    const result = await db.execute({
      sql: 'INSERT INTO fotos (visita_id, tipo, ruta_archivo, uploaded_at) VALUES (?, ?, ?, ?)',
      args: [toInt(visita_id), tipo || 'general', data, now()]
    });
    return Number(result.lastInsertRowid);
  }

  // ==================== FOTOS CLIENTES ====================

  async getFotosCliente(clienteId) {
    const db = getClient();
    const result = await db.execute({ sql: 'SELECT * FROM fotos_clientes WHERE cliente_id = ?', args: [toInt(clienteId)] });
    return rowsToObjs(result.rows);
  }

  async saveFotoCliente({ cliente_id, tipo, data }) {
    const db = getClient();
    const result = await db.execute({
      sql: 'INSERT INTO fotos_clientes (cliente_id, tipo, ruta_archivo, created_at) VALUES (?, ?, ?, ?)',
      args: [toInt(cliente_id), tipo || null, data, now()]
    });
    const id = Number(result.lastInsertRowid);
    const foto = await db.execute({ sql: 'SELECT * FROM fotos_clientes WHERE id = ?', args: [id] });
    return rowToObj(foto.rows[0]);
  }

  async deleteFotoCliente(id) {
    const db = getClient();
    await db.execute({ sql: 'DELETE FROM fotos_clientes WHERE id = ?', args: [toInt(id)] });
  }

  // ==================== PAGOS ====================

  async createPago({ cliente_id, monto, fecha, metodo_pago, estado, mes, tipo_abono }) {
    const db = getClient();
    const result = await db.execute({
      sql: `INSERT INTO pagos (cliente_id, monto, fecha, metodo_pago, estado, mes, tipo_abono, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [toInt(cliente_id), monto, fecha || now().split('T')[0],
             metodo_pago || 'efectivo', estado || 'pagado', mes || null, tipo_abono || null, now(), now()]
    });
    const id = Number(result.lastInsertRowid);
    const pago = await db.execute({ sql: 'SELECT * FROM pagos WHERE id = ?', args: [id] });
    return rowToObj(pago.rows[0]);
  }

  async getAllPagos(limit = 500) {
    const db = getClient();
    const result = await db.execute({
      sql: `SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion
            FROM pagos p LEFT JOIN clientes c ON p.cliente_id = c.id
            ORDER BY p.fecha DESC LIMIT ?`,
      args: [limit]
    });
    return rowsToObjs(result.rows);
  }

  async getPagosByCliente(clienteId) {
    const db = getClient();
    const result = await db.execute({
      sql: 'SELECT * FROM pagos WHERE cliente_id = ? ORDER BY fecha DESC',
      args: [toInt(clienteId)]
    });
    return rowsToObjs(result.rows);
  }

  async updatePago(id, data) {
    const db = getClient();
    const allowed = ['monto', 'fecha', 'metodo_pago', 'estado', 'mes', 'tipo_abono'];
    const updates = [];
    const args = [];
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); args.push(value); }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?'); args.push(now()); args.push(toInt(id));
      await db.execute({ sql: `UPDATE pagos SET ${updates.join(', ')} WHERE id = ?`, args });
    }

    const pago = await db.execute({ sql: 'SELECT * FROM pagos WHERE id = ?', args: [toInt(id)] });
    return rowToObj(pago.rows[0]);
  }

  async deletePago(id) {
    const db = getClient();
    await db.execute({ sql: 'DELETE FROM pagos WHERE id = ?', args: [toInt(id)] });
  }

  // ==================== INVENTARIO ====================

  async getAllInventario() {
    const db = getClient();
    const result = await db.execute('SELECT * FROM inventario ORDER BY nombre ASC');
    return rowsToObjs(result.rows);
  }

  async getInventarioById(id) {
    const db = getClient();
    const result = await db.execute({ sql: 'SELECT * FROM inventario WHERE id = ?', args: [toInt(id)] });
    return result.rows.length > 0 ? rowToObj(result.rows[0]) : null;
  }

  async createInventario(data) {
    const db = getClient();
    const { nombre, unidad, stock_actual, stock_minimo, precio_unitario } = data;
    const result = await db.execute({
      sql: `INSERT INTO inventario (nombre, unidad, stock_actual, stock_minimo, precio_unitario, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [nombre, unidad || 'g', stock_actual || 0, stock_minimo || 0, precio_unitario || null, now(), now()]
    });
    return this.getInventarioById(Number(result.lastInsertRowid));
  }

  async updateInventario(id, data) {
    const db = getClient();
    const allowed = ['nombre', 'unidad', 'stock_actual', 'stock_minimo', 'precio_unitario'];
    const updates = [];
    const args = [];
    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); args.push(value); }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?'); args.push(now()); args.push(toInt(id));
      await db.execute({ sql: `UPDATE inventario SET ${updates.join(', ')} WHERE id = ?`, args });
    }

    return this.getInventarioById(toInt(id));
  }

  async ajustarStock(id, cantidad, visita_id = null) {
    const db = getClient();
    await db.execute({
      sql: 'UPDATE inventario SET stock_actual = MAX(0, stock_actual + ?), updated_at = ? WHERE id = ?',
      args: [cantidad, now(), toInt(id)]
    });

    await this.registrarMovimiento({
      insumo_id: toInt(id),
      tipo: cantidad > 0 ? 'compra' : 'uso',
      cantidad,
      origen: visita_id ? 'visita' : 'manual',
      visita_id,
      fecha: new Date().toISOString().split('T')[0],
    });

    return this.getInventarioById(toInt(id));
  }

  async deleteInventario(id) {
    const db = getClient();
    await db.execute({ sql: 'DELETE FROM inventario WHERE id = ?', args: [toInt(id)] });
  }

  async validateInsumoStock(insumo_id, cantidad) {
    const insumo = await this.getInventarioById(insumo_id);
    if (!insumo) return { hasStock: false, stockDisponible: 0, error: 'Insumo no existe' };
    return { hasStock: insumo.stock_actual >= cantidad, stockDisponible: insumo.stock_actual };
  }

  // ==================== MOVIMIENTOS ====================

  async registrarMovimiento({ insumo_id, tipo, cantidad, origen, referencia_id, visita_id, fecha }) {
    const db = getClient();
    const finalOrigen = visita_id ? 'visita' : (origen || 'manual');
    const finalReferencia = visita_id || referencia_id || null;

    await db.execute({
      sql: `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, origen, referencia_id, fecha, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [toInt(insumo_id), tipo, cantidad, finalOrigen,
             finalReferencia ? toInt(finalReferencia) : null,
             fecha || new Date().toISOString().split('T')[0], now()]
    });
  }

  async getMovimientosByInsumo(insumoId, limit = 50) {
    const db = getClient();
    const result = await db.execute({
      sql: 'SELECT * FROM movimientos_inventario WHERE insumo_id = ? ORDER BY fecha DESC, id DESC LIMIT ?',
      args: [toInt(insumoId), limit]
    });
    return rowsToObjs(result.rows);
  }

  // ==================== CONFIGURACION ====================

  async getConfig(clave) {
    const db = getClient();
    const result = await db.execute({ sql: 'SELECT valor FROM configuracion WHERE clave = ?', args: [clave] });
    return result.rows.length > 0 ? result.rows[0].valor : null;
  }

  async getAllConfig() {
    const db = getClient();
    const result = await db.execute('SELECT * FROM configuracion');
    return result.rows.reduce((acc, r) => { acc[r.clave] = r.valor; return acc; }, {});
  }

  async setConfig(clave, valor) {
    const db = getClient();
    await db.execute({
      sql: 'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
      args: [clave, valor]
    });
    return { clave, valor };
  }

  // ==================== GASTOS ====================

  async createGasto({ descripcion, monto, fecha, categoria }) {
    const db = getClient();
    const result = await db.execute({
      sql: 'INSERT INTO gastos (descripcion, monto, fecha, categoria, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [descripcion, monto, fecha || new Date().toISOString().split('T')[0], categoria || 'otros', now()]
    });
    const id = Number(result.lastInsertRowid);
    const gasto = await db.execute({ sql: 'SELECT * FROM gastos WHERE id = ?', args: [id] });
    return rowToObj(gasto.rows[0]);
  }

  async getAllGastos(limit = 500) {
    const db = getClient();
    const result = await db.execute({ sql: 'SELECT * FROM gastos ORDER BY fecha DESC LIMIT ?', args: [limit] });
    return rowsToObjs(result.rows);
  }

  async deleteGasto(id) {
    const db = getClient();
    await db.execute({ sql: 'DELETE FROM gastos WHERE id = ?', args: [toInt(id)] });
  }

  // ==================== SYNC ====================

  async getUnsynced() {
    const db = getClient();
    const result = await db.execute('SELECT * FROM visitas WHERE sincronizada = 0');
    return rowsToObjs(result.rows);
  }

  async markSynced(visitaId) {
    const db = getClient();
    await db.execute({
      sql: 'UPDATE visitas SET sincronizada = 1, updated_at = ? WHERE id = ?',
      args: [now(), toInt(visitaId)]
    });
    return this.getVisitaById(toInt(visitaId));
  }

  // ==================== BACKWARD COMPAT ====================

  async getBackupData() {
    const db = getClient();
    const [clientes, visitas, pagos, gastos, inventario, movimientos, config] = await Promise.all([
      db.execute('SELECT * FROM clientes ORDER BY id ASC'),
      db.execute('SELECT * FROM visitas ORDER BY id ASC'),
      db.execute('SELECT * FROM pagos ORDER BY id ASC'),
      db.execute('SELECT * FROM gastos ORDER BY id ASC'),
      db.execute('SELECT * FROM inventario ORDER BY id ASC'),
      db.execute('SELECT * FROM movimientos_inventario ORDER BY id ASC'),
      db.execute('SELECT * FROM configuracion ORDER BY id ASC'),
    ]);
    return {
      version: '1.0',
      generado_en: new Date().toISOString(),
      clientes: rowsToObjs(clientes.rows),
      visitas: rowsToObjs(visitas.rows),
      pagos: rowsToObjs(pagos.rows),
      gastos: rowsToObjs(gastos.rows),
      inventario: rowsToObjs(inventario.rows),
      movimientos_inventario: rowsToObjs(movimientos.rows),
      configuracion: rowsToObjs(config.rows),
    };
  }

  parseQuimicos(raw) {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;

      const MAPPING = {
        cloroGranulado: { id: 1, nombre: 'Cloro Granulado', unidad: 'g' },
        cloroLiquido:   { id: 2, nombre: 'Cloro Líquido',   unidad: 'ml' },
        phMas:          { id: 3, nombre: 'pH+',             unidad: 'g' },
        phMenos:        { id: 4, nombre: 'pH−',             unidad: 'ml' },
        algicida:       { id: 5, nombre: 'Algicida',        unidad: 'ml' },
        floculante:     { id: 6, nombre: 'Floculante',      unidad: 'ml' },
      };

      return Object.entries(MAPPING)
        .filter(([clave]) => parsed[clave] && parsed[clave] > 0)
        .map(([clave, info]) => ({
          insumo_id: info.id,
          nombre: info.nombre,
          cantidad: parsed[clave],
          unidad: info.unidad,
        }));
    } catch (e) {
      return [];
    }
  }
}

const databaseService = new DatabaseService();
export default databaseService;
