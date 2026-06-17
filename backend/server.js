import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import databaseService from './services/database.js';
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

  // Additional Socket.io handlers will be added in Task 6 (Sync Service)
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

export { app, httpServer, io, db, databaseService };
