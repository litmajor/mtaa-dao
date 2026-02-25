/**
 * Swagger UI Middleware
 * Mounts the interactive API documentation UI on Express
 * 
 * Usage:
 * app.use(swaggerMiddleware);
 * 
 * Access at: http://localhost:3000/api-docs
 */

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';
import { Router, Request, Response } from 'express';

const router = Router();

// Swagger UI setup
const swaggerUiOptions = {
  // Hide the "Swagger UI" top bar
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { font-size: 2em; }
    .swagger-ui .scheme-container { display: none; }
  `,
  customSiteTitle: 'MTAA DAO API Documentation',
  swaggerUrl: '/api/openapi.json',
  // presets: [swaggerUi.presets.apis, swaggerUi.SwaggerUIBundle.presets.standalone],
  // plugins: [swaggerUi.SwaggerUIBundle.plugins.DownloadUrl]
};

// Mount Swagger UI at /api-docs
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Alternative: serve OpenAPI spec as JSON
router.get('/openapi.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint for documentation
router.get('/api-health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    documentation: '/api-docs',
    openapi: '/api/openapi.json',
    timestamp: new Date()
  });
});

export default router;
