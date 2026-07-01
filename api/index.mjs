import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import databaseService from '../backend/services/database.js';
import routes from '../backend/api/routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In serverless, initialize DB on first request (no persistent process)
let initialized = false;
app.use(async (req, res, next) => {
  if (!initialized) {
    await databaseService.init();
    initialized = true;
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '0.1.0' });
});

app.use('/api', routes);

export default app;
