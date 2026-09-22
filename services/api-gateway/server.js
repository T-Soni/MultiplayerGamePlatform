const http = require('http');
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createLogger } = require('../shared/logger');

const logger = createLogger('APIGateway');
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Downstream Service URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const REGISTRY_SERVICE_URL = process.env.REGISTRY_SERVICE_URL || 'http://localhost:5002';
const MATCHMAKING_SERVICE_URL = process.env.MATCHMAKING_SERVICE_URL || 'http://localhost:5003';
const GAME_ENGINE_URL = process.env.GAME_ENGINE_URL || 'http://localhost:5004';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5005';

// Enable CORS for frontend requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logger
app.use((req, res, next) => {
  logger.info(`[INCOMING] ${req.method} ${req.url}`);
  next();
});

// Overall Gateway Health
app.get('/health', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * Cluster Status Endpoint:
 * Pings all downstream microservices and reports their operational status.
 */
app.get('/api/status', async (req, res) => {
  const services = [
    { name: 'auth-service', url: `${AUTH_SERVICE_URL}/health` },
    { name: 'registry-service', url: `${REGISTRY_SERVICE_URL}/health` },
    { name: 'matchmaking-service', url: `${MATCHMAKING_SERVICE_URL}/health` },
    { name: 'game-engine', url: `${GAME_ENGINE_URL}/health` },
    { name: 'analytics-service', url: `${ANALYTICS_SERVICE_URL}/health` }
  ];

  const results = await Promise.allSettled(
    services.map(async (s) => {
      const start = Date.now();
      const resp = await fetch(s.url);
      const data = await resp.json();
      return {
        name: s.name,
        online: resp.ok,
        latencyMs: Date.now() - start,
        details: data
      };
    })
  );

  const clusterStatus = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      name: services[i].name,
      online: false,
      error: r.reason ? r.reason.message : 'Unreachable'
    };
  });

  const allOnline = clusterStatus.every(s => s.online);
  res.status(allOnline ? 200 : 207).json({
    gateway: 'healthy',
    allServicesOnline: allOnline,
    services: clusterStatus
  });
});

// Proxy 1: Auth Service (/api/auth)
app.use('/api/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => `/api/auth${path}`
}));

// Proxy 2: Registry & Config Service (/api/config)
app.use('/api/config', createProxyMiddleware({
  target: REGISTRY_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => `/api/config${path}`
}));

// Proxy 3: Matchmaking Service (/api/matchmaking)
app.use('/api/matchmaking', createProxyMiddleware({
  target: MATCHMAKING_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => `/api/matchmaking${path}`
}));

// Proxy 4: Analytics & Scoring Service (/api/analytics)
app.use('/api/analytics', createProxyMiddleware({
  target: ANALYTICS_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => `/api/analytics${path}`
}));

// Proxy 5: Game Engine REST routes (/api/games)
app.use('/api/games', createProxyMiddleware({
  target: GAME_ENGINE_URL,
  changeOrigin: true,
  pathRewrite: (path, req) => `/api/games${path}`
}));

// Proxy 6: Live WebSocket connection to Game Engine (/socket.io)
const wsProxy = createProxyMiddleware({
  target: GAME_ENGINE_URL,
  changeOrigin: true,
  ws: true,
  logLevel: 'warn'
});
app.use('/socket.io', wsProxy);

// Attach WebSocket upgrade handler to Gateway HTTP server
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io')) {
    wsProxy.upgrade(req, socket, head);
  }
});

server.listen(PORT, () => {
  logger.info(`====================================================`);
  logger.info(`  API GATEWAY LISTENING ON http://0.0.0.0:${PORT}    `);
  logger.info(`  Routes mapped:                                    `);
  logger.info(`    /api/auth        -> ${AUTH_SERVICE_URL}        `);
  logger.info(`    /api/config      -> ${REGISTRY_SERVICE_URL}    `);
  logger.info(`    /api/matchmaking -> ${MATCHMAKING_SERVICE_URL} `);
  logger.info(`    /api/analytics   -> ${ANALYTICS_SERVICE_URL}   `);
  logger.info(`    /api/games       -> ${GAME_ENGINE_URL}         `);
  logger.info(`    /socket.io (WS)  -> ${GAME_ENGINE_URL}         `);
  logger.info(`====================================================`);
});
