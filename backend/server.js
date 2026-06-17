import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import databaseService from './services/database.js';
import syncService from './services/sync-service.js';
import routes from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
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

// Initialize database schema
const schema = readFileSync(join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema, (err) => {
  if (err) {
    console.error('Error initializing database schema:', err);
    process.exit(1);
  }
  console.log('Database initialized with schema');
});

// Initialize database service
databaseService.init(db);

// Initialize sync service
syncService.init();

// ==================== REST API ENDPOINTS ====================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// Mount API routes
app.use('/api', routes);

// ==================== SOCKET.IO CONNECTION HANDLING ====================

io.on('connection', (socket) => {
  console.log(`New Socket.io connection: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket.io disconnected: ${socket.id}`);
  });

  // ==================== SYNC EVENTS ====================

  /**
   * sync:request
   * Mobile requests current client data to sync
   * Receives nothing, sends back list of all active clients
   */
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

  /**
   * sync:visitas
   * Mobile sends new/updated visits to server
   * Receives array of visit objects, saves them, marks as synced
   */
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

  /**
   * sync:clientes
   * Mobile sends new/updated clients to server
   * Receives array of client objects, saves them
   */
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

      console.log(`[${socket.id}] Synced ${results.length} clients successfully`);
    } catch (error) {
      console.error(`[${socket.id}] Error in sync:clientes:`, error);
      socket.emit('sync:error', {
        error: error.message || 'Failed to sync clients'
      });
    }
  });

  /**
   * sync:photos
   * Mobile sends photos (for future implementation)
   * For now: just acknowledge receipt
   */
  socket.on('sync:photos', async (data) => {
    try {
      console.log(`[${socket.id}] sync:photos received - acknowledging (not yet implemented)`);

      socket.emit('sync:photos:ack', {
        success: true,
        message: 'Photos received - implementation pending',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`[${socket.id}] Error in sync:photos:`, error);
      socket.emit('sync:error', {
        error: error.message || 'Failed to process photos'
      });
    }
  });

  /**
   * debug:unsynced
   * Debug endpoint to check unsynced visits
   */
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
httpServer.listen(PORT, () => {
  console.log(`PILETERO server running on http://localhost:${PORT}`);
  console.log('Socket.io ready for real-time sync');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  httpServer.close(() => {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      else console.log('Database connection closed');
      process.exit(0);
    });
  });
});

export { app, httpServer, io, db, databaseService, syncService };
