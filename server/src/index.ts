
process.on('uncaughtException', (err) => {
  console.error('[Process Error: Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process Error: Unhandled Rejection]', reason);
});
import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { apiRouter } from './api/routes.js';
import { SocketManager } from './websocket/socketManager.js';
import { mqttIngestion } from './hal/mqttIngestion.js';
import './simulator/shopFloorSimulator.js'; // starts background simulator

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize SQLite WAL database and run initial seed if empty
initDatabase();
seedDatabase(false);

// Initialize WebSocket server
SocketManager.initialize(server);

// Connect MQTT hardware ingestion
mqttIngestion.connect(process.env.MQTT_URL || 'mqtt://127.0.0.1:1883');

// Mount REST API
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    system: 'INDO-MIM Shop-5 Product & Pouch Traceability System',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`  INDO-MIM SHOP-5 REAL-TIME PRODUCT & POUCH TRACEABILITY SERVER `);
  console.log(`  HTTP API:      http://localhost:${PORT}/api                   `);
  console.log(`  WebSocket:     ws://localhost:${PORT}/ws                      `);
  console.log(`  Health Check:  http://localhost:${PORT}/health                `);
  console.log(`================================================================`);
});
