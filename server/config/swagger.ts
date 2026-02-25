/**
 * Swagger/OpenAPI Configuration
 * Auto-generates API documentation from JSDoc comments
 * 
 * Documentation will be available at:
 * - Interactive UI: http://localhost:3000/api-docs
 * - Raw JSON spec: http://localhost:3000/api/openapi.json
 * 
 * Usage:
 * 1. Add JSDoc comments to your route files (see examples below)
 * 2. Documentation auto-updates when server restarts
 * 3. Share /api-docs link with frontend teams
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '../shared/config';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MTAA DAO API',
      version: '1.0.0',
      description: 'Complete DAO governance, treasury, payments, and community platform API',
      license: {
        name: 'MIT'
      },
      contact: {
        name: 'API Support',
        email: 'support@mtaadao.com',
        url: 'https://mtaadao.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development Server',
        variables: {
          port: {
            enum: ['5000', '5173'],
            default: '5000'
          }
        }
      },
      {
        url: 'https://api.mtaadao.com/api',
        description: 'Production Server'
      },
      {
        url: 'https://staging-api.mtaadao.com/api',
        description: 'Staging Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login endpoint'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service communication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR'
                },
                message: {
                  type: 'string',
                  example: 'Input validation failed'
                },
                details: {
                  type: 'object'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {}
            },
            pagination: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  example: 150
                },
                limit: {
                  type: 'integer',
                  example: 20
                },
                offset: {
                  type: 'integer',
                  example: 0
                },
                pages: {
                  type: 'integer',
                  example: 8
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User login, registration, and token management'
      },
      {
        name: 'Users',
        description: 'User profile and account management'
      },
      {
        name: 'Wallets',
        description: 'Wallet creation, balance, and operations'
      },
      {
        name: 'Payments',
        description: 'Payment processing and transaction history'
      },
      {
        name: 'DAO Governance',
        description: 'DAO creation, proposals, voting, and governance'
      },
      {
        name: 'Treasury',
        description: 'Treasury management, allocations, and finances'
      },
      {
        name: 'Analytics',
        description: 'System analytics, metrics, and reporting'
      },
      {
        name: 'Admin',
        description: 'Admin-only management endpoints'
      }
    ]
  },
  // Path to route files for JSDoc parsing
  apis: [
    './server/routes/**/*.ts',
    './server/api/**/*.ts',
    './server/routes/user/**/*.ts',
    './server/routes/admin/**/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * HOW TO DOCUMENT YOUR ENDPOINTS
 * 
 * Add JSDoc comments to your route handlers like this:
 * 
 * @swagger
 * /users/{userId}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user profile
 *     description: Retrieve detailed user profile information
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 * 
 * IMPORTANT RULES:
 * 1. @swagger comment must be INSIDE a route handler or above it
 * 2. Use standard OpenAPI 3.0 format
 * 3. Tag endpoints with appropriate category
 * 4. Include request/response examples
 * 5. Document all required parameters
 * 6. List all possible response codes
 * 
 * EXAMPLES:
 * - See examples below
 * - Check swagger.example.ts for detailed examples
 * - Update this as you add new endpoints
 */
