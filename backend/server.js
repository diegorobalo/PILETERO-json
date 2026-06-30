import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cron from 'node-cron';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== START SERVER INITIALIZATION ====================

const PORT = process.env.PORT || 3000;

function startServer() {
  server.listen(PORT, '0.0.0.0', () => {
    const ifaces = Object.values(networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal);
    const localIP = ifaces[0]?.address || 'TU_IP';
    console.log(`\n✅ PILETERO corriendo en http://localhost:${PORT}`);
    console.log(`📱 Celular: http://${localIP}:${PORT}\n`);
    console.log('Storage: JSON (data.json) - Vercel compatible\n');
  });
}

// Initialize JSON-based storage (Vercel-compatible, no SQLite)
try {
  databaseService.init();
  console.log('JSON data storage initialized');
  syncService.init();
  startServer();
} catch (err) {
  console.error('Error initializing data storage:', err);
  process.exit(1);
}

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

// ==================== DATA BACKUP ====================
// Note: JSON data is automatically persisted in data.json
// For production (Vercel), consider external backups or database services

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
          const existing = (databaseService.data.fotos || []).find(
            f => f.visita_id === foto.visita_id_server && f.tipo === foto.tipo
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


// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, io, databaseService, syncService };
