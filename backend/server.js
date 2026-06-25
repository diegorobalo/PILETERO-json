import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cron from 'node-cron';
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';
import databaseService from './services/database.js';
import syncService from './services/sync-service.js';
import routes from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
const dbPath = join(__dirname, 'piletero.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

// Initialize database — schema + migrations — then start server
const schema = readFileSync(join(__dirname, 'db', 'schema.sql'), 'utf8');
const MIGRATIONS = [
  "ALTER TABLE clientes ADD COLUMN frecuencia_visita TEXT DEFAULT 'semanal'",
  "ALTER TABLE clientes ADD COLUMN grupo_semana TEXT DEFAULT 'A'",
  "CREATE TABLE IF NOT EXISTS fotos_clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL, tipo TEXT, ruta_archivo TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE)",
  "CREATE INDEX IF NOT EXISTS idx_fotos_clientes_cliente_id ON fotos_clientes(cliente_id)",
  // NUEVAS v1.1:
  "CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT)",
  "CREATE TABLE IF NOT EXISTS gastos (id INTEGER PRIMARY KEY AUTOINCREMENT, descripcion TEXT NOT NULL, monto REAL NOT NULL, fecha DATE NOT NULL, categoria TEXT DEFAULT 'otros', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS movimientos_inventario (id INTEGER PRIMARY KEY AUTOINCREMENT, insumo_id INTEGER NOT NULL, tipo TEXT NOT NULL, cantidad REAL NOT NULL, origen TEXT DEFAULT 'manual', referencia_id INTEGER, fecha DATE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (insumo_id) REFERENCES inventario(id) ON DELETE CASCADE)",
  "CREATE INDEX IF NOT EXISTS idx_movimientos_insumo_id ON movimientos_inventario(insumo_id)",
  "CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha)",
];

db.exec(schema, (err) => {
  if (err) {
    console.error('Error initializing database schema:', err);
    process.exit(1);
  }
  console.log('Database schema OK');

  let pending = MIGRATIONS.length;
  db.serialize(() => {
    MIGRATIONS.forEach(sql => {
      db.run(sql, (migErr) => {
        if (migErr && !migErr.message.includes('duplicate column')) {
          console.error('Migration warning:', migErr.message);
        }
        pending--;
        if (pending === 0) {
          console.log('Migrations OK — starting server');
          databaseService.init(db);
          syncService.init();
          startServer();
        }
      });
    });
  });
});

// ==================== REST API ENDPOINTS ====================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// Mount API routes
app.use('/api', routes);

// ==================== BACKUP AUTOMÁTICO ====================

const backupDir = join(__dirname, 'backups');

function hacerBackup() {
  try {
    mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dest = join(backupDir, `piletero_${timestamp}.db`);
    copyFileSync(dbPath, dest);
    console.log(`[backup] Copia guardada: ${dest}`);

    // Mantener solo los últimos 7 backups
    const archivos = readdirSync(backupDir)
      .filter(f => f.startsWith('piletero_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: statSync(join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    archivos.slice(7).forEach(({ name }) => {
      try {
        unlinkSync(join(backupDir, name));
        console.log(`[backup] Eliminado backup antiguo: ${name}`);
      } catch (unlinkErr) {
        console.error(`[backup] No se pudo eliminar ${name}:`, unlinkErr.message);
      }
    });
  } catch (err) {
    console.error('[backup] Error al hacer backup:', err.message);
  }
}

app.post('/api/backup', (req, res) => {
  try {
    hacerBackup();
    res.json({ success: true, message: 'Backup realizado' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== SOCKET.IO CONNECTION HANDLING ====================

io.on('connection', (socket) => {
  console.log(`New Socket.io connection: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket.io disconnected: ${socket.id}`);
  });

  // ==================== SYNC EVENTS ====================

  socket.on('sync:request', async (data) => {
    try {
      console.log(`[${socket.id}] sync:request received`);

      const clientData = await syncService.getClientDataForSync();

      socket.emit('sync:data', {
        success: true,
        clientes: clientData,
        timestamp: new Date().toISOString()
      });

      console.log(`[${socket.id}] Sent ${clientData.length} clients for sync`);
    } catch (error) {
      console.error(`[${socket.id}] Error in sync:request:`, error);
      socket.emit('sync:error', {
        error: error.message || 'Failed to get client data for sync'
      });
    }
  });

  socket.on('sync:visitas', async (data) => {
    try {
      console.log(`[${socket.id}] sync:visitas received with ${data?.visitas?.length || 0} visits`);

      if (!data || !Array.isArray(data.visitas)) {
        throw new Error('Invalid data format: expected {visitas: [...]}');
      }

      const results = await syncService.syncVisitData(data.visitas);

      socket.emit('sync:visitas:ack', {
        success: true,
        results: results,
        timestamp: new Date().toISOString()
      });

      console.log(`[${socket.id}] Synced ${results.length} visits successfully`);
    } catch (error) {
      console.error(`[${socket.id}] Error in sync:visitas:`, error);
      socket.emit('sync:error', {
        error: error.message || 'Failed to sync visits'
      });
    }
  });

  socket.on('sync:clientes', async (data) => {
    try {
      console.log(`[${socket.id}] sync:clientes received with ${data?.clientes?.length || 0} clients`);

      if (!data || !Array.isArray(data.clientes)) {
        throw new Error('Invalid data format: expected {clientes: [...]}');
      }

      const results = await syncService.syncClientData(data.clientes);

      socket.emit('sync:clientes:ack', {
        success: true,
        results: results,
        timestamp: new Date().toISOString()
      });

      // Enviar lista actualizada con IDs reales para que el celular reemplace los IDs temporales
      const updatedClientes = await syncService.getClientDataForSync();
      socket.emit('sync:clientes_refreshed', {
        clientes: updatedClientes,
        timestamp: new Date().toISOString()
      });

      console.log(`[${socket.id}] Synced ${results.length} clients, pushed ${updatedClientes.length} back`);
    } catch (error) {
      console.error(`[${socket.id}] Error in sync:clientes:`, error);
      socket.emit('sync:error', {
        error: error.message || 'Failed to sync clients'
      });
    }
  });

  socket.on('sync:fotos', async (data) => {
    try {
      const fotos = data?.fotos || [];
      console.log(`[${socket.id}] sync:fotos received: ${fotos.length} photo(s)`);
      let saved = 0;
      for (const foto of fotos) {
        try {
          const existing = await databaseService.queryOne(
            'SELECT id FROM fotos WHERE visita_id = ? AND tipo = ?',
            [foto.visita_id_server, foto.tipo]
          );
          if (!existing) {
            await databaseService.saveFoto({
              visita_id: foto.visita_id_server,
              tipo: foto.tipo,
              data: foto.data,
            });
            saved++;
          }
        } catch (err) {
          console.error('Error saving foto:', err.message);
        }
      }
      socket.emit('sync:fotos:ack', { success: true, saved });
      console.log(`[${socket.id}] Saved ${saved} new photo(s)`);
    } catch (error) {
      console.error(`[${socket.id}] Error in sync:fotos:`, error);
      socket.emit('sync:error', { error: error.message });
    }
  });

  socket.on('debug:unsynced', async (data) => {
    try {
      console.log(`[${socket.id}] debug:unsynced requested`);

      const unsynced = await syncService.getUnsynced();

      socket.emit('debug:unsynced:response', {
        success: true,
        count: unsynced.length,
        unsynced: unsynced
      });

      console.log(`[${socket.id}] Returned ${unsynced.length} unsynced visits`);
    } catch (error) {
      console.error(`[${socket.id}] Error in debug:unsynced:`, error);
      socket.emit('sync:error', {
        error: error.message || 'Failed to get unsynced visits'
      });
    }
  });
});

// ==================== FRONTEND ESTÁTICO ====================

const distPath = join(__dirname, '../frontend/dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    const ifaces = Object.values(networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal);
    const localIP = ifaces[0]?.address || 'TU_IP';
    console.log(`\n✅ PILETERO corriendo en http://localhost:${PORT}`);
    console.log(`📱 Celular: http://${localIP}:${PORT}\n`);
  });

  // Backup diario a las 20:00
  cron.schedule('0 20 * * *', hacerBackup);
  console.log('[backup] Backup automático programado para las 20:00 diarias');

  // Mostrar fecha del último backup
  try {
    mkdirSync(backupDir, { recursive: true });
    const archivosExistentes = readdirSync(backupDir)
      .filter(f => f.startsWith('piletero_') && f.endsWith('.db'))
      .sort()
      .reverse();
    if (archivosExistentes.length > 0) {
      console.log(`[backup] Último backup: ${archivosExistentes[0]}`);
    } else {
      console.log('[backup] No hay backups previos. Se creará el primero a las 20:00.');
    }
  } catch (err) {
    console.error('[backup] Error al verificar backups existentes:', err.message);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      else console.log('Database connection closed');
      process.exit(0);
    });
  });
});

export { app, server, io, db, databaseService, syncService };
