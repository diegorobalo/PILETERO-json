import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * DatabaseService - JSON file-based storage for Vercel deployment
 * Provides same promise-based API as SQLite version but stores data in data.json
 * Maintains backward compatibility - no frontend changes needed
 */
class DatabaseService {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.data = null;
    this.nextIds = {}; // Track next ID for each table
  }

  /**
   * Load data from JSON file (initialization)
   */
  init() {
    try {
      if (existsSync(this.dataPath)) {
        const content = readFileSync(this.dataPath, 'utf8');
        this.data = JSON.parse(content);
      } else {
        // Create default structure if file doesn't exist
        this.data = {
          clientes: [],
          visitas: [],
          inventario: [],
          pagos: [],
          gastos: [],
          configuracion: [],
          movimientos_inventario: [],
          fotos: [],
          fotos_clientes: []
        };
        this.save();
      }

      // Initialize nextIds trackers
      this._initializeIds();
      console.log('JSON data storage initialized:', this.dataPath);
    } catch (err) {
      console.error('Error initializing JSON storage:', err);
      throw err;
    }
  }

  /**
   * Initialize ID counters based on existing data
   */
  _initializeIds() {
    const tables = ['clientes', 'visitas', 'inventario', 'pagos', 'gastos', 'configuracion', 'movimientos_inventario', 'fotos', 'fotos_clientes'];
    for (const table of tables) {
      const items = this.data[table] || [];
      const maxId = items.reduce((max, item) => Math.max(max, item.id || 0), 0);
      this.nextIds[table] = maxId + 1;
    }
  }

  /**
   * Save data to JSON file
   */
  save() {
    try {
      writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf8');
      console.log(`[db-save] Persisted data to ${this.dataPath}`);
    } catch (err) {
      console.error('[db-save-error] Error saving JSON data:', err);
      throw err;
    }
  }

  /**
   * Filter array by conditions (mimics SQL WHERE)
   */
  _filterRecords(array, conditions) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return array;
    }
    return array.filter(record => {
      return Object.entries(conditions).every(([key, value]) => {
        if (typeof value === 'string' && value.includes('%')) {
          // Handle LIKE queries
          const pattern = value.replace(/%/g, '').toLowerCase();
          return String(record[key] || '').toLowerCase().includes(pattern);
        }
        return record[key] === value;
      });
    });
  }

  /**
   * SQL-like query interface (filtered array)
   */
  query(sql, params = []) {
    return new Promise((resolve) => {
      try {
        // Parse SQL to determine table and WHERE conditions
        const tableMatch = sql.match(/FROM\s+(\w+)/i);
        const tableName = tableMatch ? tableMatch[1] : null;

        if (!tableName || !this.data[tableName]) {
          resolve([]);
          return;
        }

        let results = [...this.data[tableName]];

        // Simple ORDER BY handling
        if (sql.includes('ORDER BY')) {
          const orderMatch = sql.match(/ORDER BY\s+(\w+(?:\.\w+)?)\s*(DESC|ASC)?/i);
          if (orderMatch) {
            const field = orderMatch[1].split('.').pop();
            const direction = orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1;
            results.sort((a, b) => {
              const aVal = a[field];
              const bVal = b[field];
              if (aVal < bVal) return -1 * direction;
              if (aVal > bVal) return 1 * direction;
              return 0;
            });
          }
        }

        // Simple LIMIT handling
        if (sql.includes('LIMIT')) {
          const limitMatch = sql.match(/LIMIT\s+\?/i);
          if (limitMatch && params.length > 0) {
            results = results.slice(0, params[params.length - 1]);
          }
        }

        resolve(results);
      } catch (err) {
        console.error('Query error:', err);
        resolve([]);
      }
    });
  }

  /**
   * SQL-like queryOne interface (single record)
   */
  queryOne(sql, params = []) {
    return new Promise((resolve) => {
      try {
        // Parse table and WHERE
        const tableMatch = sql.match(/FROM\s+(\w+)/i);
        const tableName = tableMatch ? tableMatch[1] : null;

        if (!tableName || !this.data[tableName]) {
          resolve(null);
          return;
        }

        // Extract WHERE conditions from SQL
        let records = [...this.data[tableName]];

        // Handle simple WHERE id = ? pattern
        if (sql.includes('WHERE id = ?')) {
          const record = records.find(r => r.id === params[0]);
          resolve(record || null);
          return;
        }

        // Handle other WHERE patterns
        if (sql.includes('WHERE')) {
          const whereMatch = sql.match(/WHERE\s+(.+?)(?:LIMIT|ORDER BY|$)/i);
          if (whereMatch) {
            const whereClause = whereMatch[1].trim();

            // Simple pattern matching for common WHERE conditions
            if (whereClause.includes('LIKE')) {
              const likeMatch = whereClause.match(/(\w+)\s+LIKE\s+\?/i);
              if (likeMatch && params.length > 0) {
                const field = likeMatch[1];
                const pattern = params[0].replace(/%/g, '').toLowerCase();
                const record = records.find(r =>
                  String(r[field] || '').toLowerCase().includes(pattern)
                );
                resolve(record || null);
                return;
              }
            }
          }
        }

        resolve(records[0] || null);
      } catch (err) {
        console.error('QueryOne error:', err);
        resolve(null);
      }
    });
  }

  /**
   * SQL-like execute interface (INSERT/UPDATE/DELETE)
   */
  execute(sql, params = []) {
    return new Promise((resolve) => {
      try {
        // Handle INSERT
        if (sql.includes('INSERT INTO')) {
          const tableMatch = sql.match(/INSERT INTO\s+(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : null;

          if (tableName && this.data[tableName]) {
            const id = this.nextIds[tableName]++;
            const columnsMatch = sql.match(/\((.*?)\)\s*VALUES/i);
            const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : [];

            const record = { id };
            columns.forEach((col, idx) => {
              record[col] = params[idx];
            });

            // Set timestamps
            record.created_at = new Date().toISOString();
            record.updated_at = new Date().toISOString();

            this.data[tableName].push(record);
            this.save();

            resolve({ lastID: id, changes: 1 });
            return;
          }
        }

        // Handle UPDATE
        if (sql.includes('UPDATE')) {
          const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : null;

          if (tableName && this.data[tableName]) {
            // Extract SET clause
            const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
            if (!setMatch) {
              resolve({ lastID: null, changes: 0 });
              return;
            }

            const setClauses = setMatch[1].split(',').map(c => c.trim());
            const updateFields = {};

            let paramIdx = 0;
            for (const clause of setClauses) {
              if (clause.includes('=')) {
                const [field] = clause.split('=').map(c => c.trim());
                if (field !== 'updated_at') {
                  updateFields[field] = params[paramIdx++];
                }
              }
            }

            // Extract WHERE condition (id = ?)
            const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
            if (whereMatch) {
              const id = params[params.length - 1];
              const recordIdx = this.data[tableName].findIndex(r => r.id === id);

              if (recordIdx >= 0) {
                Object.assign(this.data[tableName][recordIdx], updateFields, {
                  updated_at: new Date().toISOString()
                });
                this.save();
                resolve({ lastID: id, changes: 1 });
                return;
              }
            }
          }
        }

        // Handle DELETE
        if (sql.includes('DELETE')) {
          const tableMatch = sql.match(/DELETE FROM\s+(\w+)/i);
          const tableName = tableMatch ? tableMatch[1] : null;

          if (tableName && this.data[tableName]) {
            const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
            if (whereMatch && params.length > 0) {
              const id = params[0];
              const beforeLen = this.data[tableName].length;
              this.data[tableName] = this.data[tableName].filter(r => r.id !== id);
              const changes = beforeLen - this.data[tableName].length;
              this.save();
              resolve({ lastID: null, changes });
              return;
            }
          }
        }

        resolve({ lastID: null, changes: 0 });
      } catch (err) {
        console.error('Execute error:', err);
        resolve({ lastID: null, changes: 0 });
      }
    });
  }

  // ==================== CLIENTES (Clients) ====================

  async getAllClientes() {
    const clientes = this.data.clientes || [];
    return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async getClienteById(id) {
    return (this.data.clientes || []).find(c => c.id === id) || null;
  }

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

    const id = this.nextIds.clientes++;
    const cliente = {
      id,
      nombre,
      direccion: direccion || null,
      telefono: telefono || null,
      volumen_litros: volumen_litros || null,
      tipo_construccion: tipo_construccion || null,
      equipamiento: equipamiento || null,
      modelo_filtro: modelo_filtro || null,
      tipo_abono: tipo_abono || null,
      precio_abono: precio_abono || null,
      dias_visita: dias_visita || null,
      frecuencia_visita: frecuencia_visita || 'semanal',
      grupo_semana: grupo_semana || 'A',
      notas_acceso: notas_acceso || null,
      activo: 1,
      estado: 'activo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.data.clientes.push(cliente);
    this.save();
    return cliente;
  }

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

    const clienteIdx = this.data.clientes.findIndex(c => c.id === id);
    if (clienteIdx < 0) return null;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        this.data.clientes[clienteIdx][key] = value;
      }
    }

    this.data.clientes[clienteIdx].updated_at = new Date().toISOString();
    this.save();
    return this.data.clientes[clienteIdx];
  }

  async suspenderCliente(id) {
    const clienteIdx = this.data.clientes.findIndex(c => c.id === id);
    if (clienteIdx < 0) return null;

    this.data.clientes[clienteIdx].estado = 'suspendido';
    this.data.clientes[clienteIdx].updated_at = new Date().toISOString();
    this.save();
    return this.data.clientes[clienteIdx];
  }

  async reactivarCliente(id) {
    const clienteIdx = this.data.clientes.findIndex(c => c.id === id);
    if (clienteIdx < 0) return null;

    this.data.clientes[clienteIdx].estado = 'activo';
    this.data.clientes[clienteIdx].updated_at = new Date().toISOString();
    this.save();
    return this.data.clientes[clienteIdx];
  }

  // ==================== FOTOS (Photos) ====================

  async getFotosByVisita(visitaId) {
    return (this.data.fotos || []).filter(f => f.visita_id === visitaId);
  }

  async saveFoto({ visita_id, tipo, data }) {
    const id = this.nextIds.fotos++;
    const foto = {
      id,
      visita_id,
      tipo: tipo || 'general',
      ruta_archivo: data,
      uploaded_at: new Date().toISOString()
    };

    this.data.fotos.push(foto);
    this.save();
    return id;
  }

  // ==================== VISITAS (Visits) ====================

  async getAllVisitas(limit = 200) {
    let visitas = this.data.visitas || [];

    // Enrich with client info (join)
    visitas = visitas.map(v => {
      const cliente = (this.data.clientes || []).find(c => c.id === v.cliente_id);
      return {
        ...v,
        cliente_nombre: cliente?.nombre,
        cliente_direccion: cliente?.direccion
      };
    });

    // Sort by date DESC
    visitas.sort((a, b) => {
      const aDate = new Date(b.fecha || 0);
      const bDate = new Date(a.fecha || 0);
      return aDate - bDate;
    });

    return visitas.slice(0, limit);
  }

  async getVisitasByCliente(clienteId) {
    const visitas = (this.data.visitas || []).filter(v => v.cliente_id === clienteId);
    visitas.sort((a, b) => {
      const aDate = new Date(b.fecha || 0);
      const bDate = new Date(a.fecha || 0);
      return aDate - bDate;
    });
    return visitas;
  }

  async getVisitasByFecha(fecha) {
    const visitas = (this.data.visitas || []).filter(v => v.fecha === fecha);
    visitas.sort((a, b) => {
      const aTime = a.hora_inicio || '00:00';
      const bTime = b.hora_inicio || '00:00';
      return aTime.localeCompare(bTime);
    });
    return visitas;
  }

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

    const id = this.nextIds.visitas++;
    const visita = {
      id,
      cliente_id,
      fecha,
      hora_inicio: hora_inicio || null,
      hora_fin: hora_fin || null,
      tareas_realizadas: typeof tareas_realizadas === 'string' ? tareas_realizadas : (tareas_realizadas ? JSON.stringify(tareas_realizadas) : null),
      cloro_ppm: cloro_ppm || null,
      ph: ph || null,
      quimicos_usados: typeof quimicos_usados === 'string' ? quimicos_usados : (quimicos_usados ? JSON.stringify(quimicos_usados) : null),
      observaciones: observaciones || null,
      extras: typeof extras === 'string' ? extras : (extras ? JSON.stringify(extras) : JSON.stringify([])),
      sincronizada: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.data.visitas.push(visita);

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
        const insumo = (this.data.inventario || []).find(i =>
          i.nombre.toLowerCase().includes(nombre.toLowerCase())
        );
        if (!insumo) continue;

        insumo.stock_actual = Math.max(0, insumo.stock_actual - cant);
        insumo.updated_at = new Date().toISOString();

        await this.registrarMovimiento({
          insumo_id: insumo.id,
          tipo: 'uso',
          cantidad: -cant,
          origen: 'visita',
          referencia_id: id,
          fecha: fecha,
        });
      } catch (err) {
        console.warn(`[auto-stock] No se pudo descontar ${nombre}:`, err.message);
      }
    }

    this.save();
    return visita;
  }

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

    const visitaIdx = this.data.visitas.findIndex(v => v.id === id);
    if (visitaIdx < 0) return null;

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        if (key === 'tareas_realizadas' || key === 'quimicos_usados') {
          this.data.visitas[visitaIdx][key] = typeof value === 'string' ? value : (value ? JSON.stringify(value) : null);
        } else {
          this.data.visitas[visitaIdx][key] = value;
        }
      }
    }

    this.data.visitas[visitaIdx].updated_at = new Date().toISOString();
    this.save();
    return this.data.visitas[visitaIdx];
  }

  async deleteVisita(id) {
    this.data.visitas = (this.data.visitas || []).filter(v => v.id !== id);
    this.save();
  }

  // ==================== PAGOS (Payments) ====================

  async createPago({ cliente_id, monto, fecha, metodo_pago, estado, mes, tipo_abono }) {
    const id = this.nextIds.pagos++;
    const pago = {
      id,
      cliente_id,
      monto,
      fecha: fecha || new Date().toISOString().split('T')[0],
      metodo_pago: metodo_pago || 'efectivo',
      estado: estado || 'pagado',
      mes: mes || null,
      tipo_abono: tipo_abono || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.data.pagos.push(pago);
    this.save();
    return pago;
  }

  async getAllPagos(limit = 500) {
    let pagos = this.data.pagos || [];

    // Enrich with client info
    pagos = pagos.map(p => {
      const cliente = (this.data.clientes || []).find(c => c.id === p.cliente_id);
      return {
        ...p,
        cliente_nombre: cliente?.nombre,
        cliente_direccion: cliente?.direccion
      };
    });

    // Sort by date DESC
    pagos.sort((a, b) => {
      const aDate = new Date(b.fecha || 0);
      const bDate = new Date(a.fecha || 0);
      return aDate - bDate;
    });

    return pagos.slice(0, limit);
  }

  async getPagosByCliente(clienteId) {
    const pagos = (this.data.pagos || []).filter(p => p.cliente_id === clienteId);
    pagos.sort((a, b) => {
      const aDate = new Date(b.fecha || 0);
      const bDate = new Date(a.fecha || 0);
      return aDate - bDate;
    });
    return pagos;
  }

  async updatePago(id, data) {
    const allowed = ['monto', 'fecha', 'metodo_pago', 'estado', 'mes', 'tipo_abono'];

    const pagoIdx = this.data.pagos.findIndex(p => p.id === id);
    if (pagoIdx < 0) return null;

    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        this.data.pagos[pagoIdx][key] = value;
      }
    }

    this.data.pagos[pagoIdx].updated_at = new Date().toISOString();
    this.save();
    return this.data.pagos[pagoIdx];
  }

  async deletePago(id) {
    this.data.pagos = (this.data.pagos || []).filter(p => p.id !== id);
    this.save();
  }

  // ==================== FOTOS CLIENTES ====================

  async getFotosCliente(clienteId) {
    return (this.data.fotos_clientes || []).filter(f => f.cliente_id === clienteId);
  }

  async saveFotoCliente({ cliente_id, tipo, data }) {
    const id = this.nextIds.fotos_clientes++;
    const foto = {
      id,
      cliente_id,
      tipo: tipo || null,
      ruta_archivo: data,
      created_at: new Date().toISOString()
    };

    this.data.fotos_clientes.push(foto);
    this.save();
    return foto;
  }

  async deleteFotoCliente(id) {
    this.data.fotos_clientes = (this.data.fotos_clientes || []).filter(f => f.id !== id);
    this.save();
  }

  async aumentoPreciosMasivo(porcentaje) {
    let updated = 0;
    for (const cliente of this.data.clientes || []) {
      if (cliente.activo && cliente.estado === 'activo' && cliente.precio_abono && cliente.precio_abono > 0) {
        cliente.precio_abono = Math.round(cliente.precio_abono * (1.0 + porcentaje / 100.0));
        cliente.updated_at = new Date().toISOString();
        updated++;
      }
    }
    this.save();
    return { updated };
  }

  // ==================== INVENTARIO ====================

  async getAllInventario() {
    const inventario = this.data.inventario || [];
    return inventario.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async getInventarioById(id) {
    return (this.data.inventario || []).find(i => i.id === id) || null;
  }

  async createInventario(data) {
    const { nombre, unidad, stock_actual, stock_minimo, precio_unitario } = data;

    const id = this.nextIds.inventario++;
    const item = {
      id,
      nombre,
      unidad: unidad || 'g',
      stock_actual: stock_actual || 0,
      stock_minimo: stock_minimo || 0,
      precio_unitario: precio_unitario || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.data.inventario.push(item);
    this.save();
    return item;
  }

  async updateInventario(id, data) {
    const allowed = ['nombre', 'unidad', 'stock_actual', 'stock_minimo', 'precio_unitario'];

    const itemIdx = this.data.inventario.findIndex(i => i.id === id);
    if (itemIdx < 0) return null;

    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        this.data.inventario[itemIdx][key] = value;
      }
    }

    this.data.inventario[itemIdx].updated_at = new Date().toISOString();
    this.save();
    return this.data.inventario[itemIdx];
  }

  async ajustarStock(id, cantidad, visita_id = null) {
    const itemIdx = this.data.inventario.findIndex(i => i.id === id);
    if (itemIdx < 0) return null;

    this.data.inventario[itemIdx].stock_actual = Math.max(0, this.data.inventario[itemIdx].stock_actual + cantidad);
    this.data.inventario[itemIdx].updated_at = new Date().toISOString();

    await this.registrarMovimiento({
      insumo_id: id,
      tipo: cantidad > 0 ? 'compra' : 'uso',
      cantidad,
      origen: 'manual',
      visita_id: visita_id,
      fecha: new Date().toISOString().split('T')[0],
    });

    this.save();
    return this.data.inventario[itemIdx];
  }

  parseQuimicos(raw) {
    if (!raw) return [];

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

      if (Array.isArray(parsed)) return parsed;

      const viejo = parsed;
      const nuevo = [];

      const MAPPING = {
        cloroGranulado: { id: 1, nombre: 'Cloro Granulado', unidad: 'g' },
        cloroLiquido: { id: 2, nombre: 'Cloro Líquido', unidad: 'ml' },
        phMas: { id: 3, nombre: 'pH+', unidad: 'g' },
        phMenos: { id: 4, nombre: 'pH−', unidad: 'ml' },
        algicida: { id: 5, nombre: 'Algicida', unidad: 'ml' },
        floculante: { id: 6, nombre: 'Floculante', unidad: 'ml' },
      };

      for (const [clave, info] of Object.entries(MAPPING)) {
        if (viejo[clave] && viejo[clave] > 0) {
          nuevo.push({
            insumo_id: info.id,
            nombre: info.nombre,
            cantidad: viejo[clave],
            unidad: info.unidad,
          });
        }
      }

      return nuevo;
    } catch (e) {
      console.error('[database] parseQuimicos error:', e.message);
      return [];
    }
  }

  validateInsumoStock(insumo_id, cantidad) {
    return new Promise((resolve) => {
      const insumo = (this.data.inventario || []).find(i => i.id === insumo_id);
      if (!insumo) {
        resolve({ hasStock: false, stockDisponible: 0, error: 'Insumo no existe' });
      } else {
        const hasStock = insumo.stock_actual >= cantidad;
        resolve({ hasStock, stockDisponible: insumo.stock_actual });
      }
    });
  }

  async deleteInventario(id) {
    this.data.inventario = (this.data.inventario || []).filter(i => i.id !== id);
    this.save();
  }

  // ==================== MOVIMIENTOS INVENTARIO ====================

  async registrarMovimiento({ insumo_id, tipo, cantidad, origen, referencia_id, visita_id, fecha }) {
    const finalOrigen = visita_id ? 'visita' : (origen || 'manual');
    const finalReferencia = visita_id || referencia_id || null;

    const id = this.nextIds.movimientos_inventario++;
    const movimiento = {
      id,
      insumo_id,
      tipo,
      cantidad,
      origen: finalOrigen,
      referencia_id: finalReferencia,
      fecha: fecha || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    this.data.movimientos_inventario.push(movimiento);
    this.save();
  }

  async getMovimientosByInsumo(insumoId, limit = 50) {
    let movimientos = (this.data.movimientos_inventario || []).filter(m => m.insumo_id === insumoId);
    movimientos.sort((a, b) => {
      const aDate = new Date(b.fecha || 0);
      const bDate = new Date(a.fecha || 0);
      return aDate - bDate;
    });
    return movimientos.slice(0, limit);
  }

  // ==================== CONFIGURACION ====================

  async getConfig(clave) {
    const config = (this.data.configuracion || []).find(c => c.clave === clave);
    return config ? config.valor : null;
  }

  async getAllConfig() {
    const rows = this.data.configuracion || [];
    return rows.reduce((acc, r) => { acc[r.clave] = r.valor; return acc; }, {});
  }

  async setConfig(clave, valor) {
    const idx = (this.data.configuracion || []).findIndex(c => c.clave === clave);

    if (idx >= 0) {
      this.data.configuracion[idx].valor = valor;
    } else {
      this.data.configuracion.push({ clave, valor });
    }

    this.save();
    return { clave, valor };
  }

  // ==================== GASTOS ====================

  async createGasto({ descripcion, monto, fecha, categoria }) {
    const id = this.nextIds.gastos++;
    const gasto = {
      id,
      descripcion,
      monto,
      fecha: fecha || new Date().toISOString().split('T')[0],
      categoria: categoria || 'otros',
      created_at: new Date().toISOString()
    };

    this.data.gastos.push(gasto);
    this.save();
    return gasto;
  }

  async getAllGastos(limit = 500) {
    let gastos = this.data.gastos || [];
    gastos.sort((a, b) => {
      const aDate = new Date(b.fecha || 0);
      const bDate = new Date(a.fecha || 0);
      return aDate - bDate;
    });
    return gastos.slice(0, limit);
  }

  async deleteGasto(id) {
    this.data.gastos = (this.data.gastos || []).filter(g => g.id !== id);
    this.save();
  }

  // ==================== SYNC ====================

  async getUnsynced() {
    return (this.data.visitas || []).filter(v => v.sincronizada === 0);
  }

  async markSynced(visitaId) {
    const visitaIdx = this.data.visitas.findIndex(v => v.id === visitaId);
    if (visitaIdx < 0) return null;

    this.data.visitas[visitaIdx].sincronizada = 1;
    this.data.visitas[visitaIdx].updated_at = new Date().toISOString();
    this.save();
    return this.data.visitas[visitaIdx];
  }
}

// Create and export singleton instance
const databaseService = new DatabaseService(join(__dirname, '../data.json'));
export default databaseService;
