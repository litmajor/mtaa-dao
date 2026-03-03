/**
 * Example Server Setup with Defender Agent Integration
 * 
 * This shows how to integrate defender agent into your main server/app file.
 * Copy the relevant sections into your existing server configuration.
 */

import express, { Express } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// ✅ Import defender setup (NEW)
import { setupDefenderAgent } from './middleware/defender-setup';

// Existing imports
import { authenticateToken, isAuthenticated } from './middleware/auth';
import { securityMiddleware } from './middleware/security';
import apiRoutes from './routes';
import { Logger } from './utils/logger';

const logger = new Logger('server');

export function createApp(): Express {
  const app = express();

  // ═════════════════════════════════════════════════════════════
  // PHASE 1: Core Middleware (Order matters!)
  // ═════════════════════════════════════════════════════════════

  // Security headers
  app.use(helmet());

  // Body parsing
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Request logging
  app.use(morgan('combined'));

  // Base security middleware (input validation)
  app.use(securityMiddleware);

  // ═════════════════════════════════════════════════════════════
  // PHASE 2: Defender Agent Integration (NEW!)
  // ═════════════════════════════════════════════════════════════
  // 🔒 Initialize defender agent with full security stack
  // This must be BEFORE route mounting so defender can track all routes
  
  logger.info('[SETUP] Initializing defender agent security framework...');
  setupDefenderAgent(app, authenticateToken);
  logger.info('[SETUP] Defender agent ready - all endpoints now tracked and protected');

  // ═════════════════════════════════════════════════════════════
  // PHASE 3: Route Mounting (After Defender Setup)
  // ═════════════════════════════════════════════════════════════

  // Health check (public endpoint)
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      defender: 'active',
    });
  });

  // Auth endpoints (public)
  app.post('/api/auth/register', async (req, res) => {
    // Your auth registration logic
  });

  app.post('/api/auth/login', async (req, res) => {
    // Your auth login logic
  });

  // Protected API routes (with defender tracking + privilege checking)
  app.use('/api', apiRoutes);

  // Admin endpoints (exposed by setupDefenderAgent)
  // These are automatically added:
  // - GET /api/admin/defender/dashboard
  // - GET /api/admin/defender/endpoints
  // - GET /api/admin/defender/threats
  // - POST /api/admin/defender/endpoints/:endpoint/privileges
  // - POST /api/admin/defender/endpoints/:endpoint/block
  // - POST /api/admin/defender/endpoints/:endpoint/unblock
  // - GET /api/admin/routes
  // - GET /api/admin/routes/audit

  // ═════════════════════════════════════════════════════════════
  // PHASE 4: Error Handling (After all routes)
  // ═════════════════════════════════════════════════════════════

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.path,
      method: req.method,
    });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('[ERROR] Unhandled error', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      path: req.path,
      method: req.method,
    });

    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: err }),
    });
  });

  return app;
}

// ═════════════════════════════════════════════════════════════
// Start Server
// ═════════════════════════════════════════════════════════════

if (require.main === module) {
  const app = createApp();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  const server = app.listen(PORT, HOST, () => {
    logger.info(`[SERVER] Started on ${HOST}:${PORT}`);
    logger.info('[SERVER] Defender agent active - monitoring all endpoints');
    logger.info('[SERVER] Dashboard: GET /api/admin/defender/dashboard');
    logger.info('[SERVER] Route audit: GET /api/admin/routes/audit');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('[SERVER] SIGTERM received, shutting down gracefully...');
    server.close(() => {
      logger.info('[SERVER] Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('[SERVER] SIGINT received, shutting down gracefully...');
    server.close(() => {
      logger.info('[SERVER] Server closed');
      process.exit(0);
    });
  });
}

export default createApp;
