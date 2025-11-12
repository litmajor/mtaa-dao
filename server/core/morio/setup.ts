/**
 * Morio Data Hub Server Integration
 * 
 * Integration guide for adding Morio Data Hub to Express server
 * 
 * NOTE: This file contains reference implementations.
 * Morio modules (routes, websocket, services) are not yet created.
 * This serves as a template for future integration.
 */

import express, { Express } from 'express';
import { createServer } from 'http';

/**
 * Integration Example (Template - requires module creation)
 * 
 * Add this to your main server file (e.g., server.ts or index.ts)
 * 
 * Uncomment when morio modules are ready:
 * import morioRoutes from './routes/morio-data-hub';
 * import { createMorioWebSocketServer } from './websocket/morio-websocket';
 * import { morioDataHubService } from './services/morio-data-hub.service';
 */

export function integrateMariaDataHub(app: Express) {
  // Create HTTP server for WebSocket support
  const httpServer = createServer(app);

  // When modules are created, uncomment these:
  // app.use('/api/morio', morioRoutes);
  // const wsServer = createMorioWebSocketServer(httpServer);

  // Return server and cleanup function
  return {
    httpServer,
    wsServer: null, // Will be createMorioWebSocketServer when module is created
    cleanup: () => {
      // wsServer.shutdown();
    }
  };
}

/**
 * Usage in your main server file:
 * 
 * import express from 'express';
 * import { integrateMariaDataHub } from './core/morio';
 * 
 * const app = express();
 * const { httpServer, wsServer } = integrateMariaDataHub(app);
 * 
 * const PORT = process.env.PORT || 3000;
 * httpServer.listen(PORT, () => {
 *   console.log(`Server running on port ${PORT}`);
 *   console.log(`WebSocket server ready`);
 * });
 */

/**
 * Complete Integration Example (Template)
 * 
 * This function shows how to integrate Morio when modules are created.
 * Currently commented out pending module creation.
 */
export async function setupMorioDataHub(app: Express, port: number = 3000) {
  try {
    // When modules are created, uncomment:
    // Mount Morio API routes
    // app.use('/api/morio', morioRoutes);

    // Create HTTP server
    const httpServer = createServer(app);

    // Setup WebSocket server
    // const wsServer = createMorioWebSocketServer(httpServer);

    // Setup periodic health checks
    // setInterval(async () => {
    //   try {
    //     const health = await morioDataHubService.getSystemStatus();
    //     console.log('[Morio] System status:', health.overall);
    //   } catch (error) {
    //     console.error('[Morio] Health check failed:', error);
    //   }
    // }, 60000); // Check every minute

    // Start server
    httpServer.listen(port, () => {
      console.log(`[Morio Data Hub] Server running on port ${port}`);
      console.log(`[Morio Data Hub] REST API: http://localhost:${port}/api/morio`);
      console.log(`[Morio Data Hub] WebSocket: ws://localhost:${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('[Morio Data Hub] SIGTERM received, shutting down gracefully');
      httpServer.close(() => {
        // wsServer.shutdown();
        process.exit(0);
      });
    });

    return { httpServer, wsServer: null };
  } catch (error) {
    console.error('[Morio Data Hub] Setup failed:', error);
    throw error;
  }
}

/**
 * Environment Variables
 * 
 * Add these to your .env file:
 * 
 * # Morio Data Hub Configuration
 * MORIO_CACHE_TTL=300
 * MORIO_HEALTH_CHECK_INTERVAL=60000
 * MORIO_WEBSOCKET_ENABLED=true
 * MORIO_REAL_TIME_UPDATES=true
 * MORIO_DEBUG=false
 * FRONTEND_URL=http://localhost:5173
 */

/**
 * Database Schema for Morio Agents
 * 
 * -- Agents table
 * CREATE TABLE agents (
 *   id VARCHAR(255) PRIMARY KEY,
 *   name VARCHAR(255) NOT NULL,
 *   type VARCHAR(255) NOT NULL,
 *   status ENUM('online', 'offline', 'degraded') DEFAULT 'offline',
 *   last_heartbeat TIMESTAMP,
 *   messages_processed INT DEFAULT 0,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 * );
 * 
 * -- DAO Members table
 * CREATE TABLE dao_members (
 *   id VARCHAR(255) PRIMARY KEY,
 *   dao_id VARCHAR(255) NOT NULL,
 *   user_id VARCHAR(255) NOT NULL,
 *   last_active TIMESTAMP,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   FOREIGN KEY (dao_id) REFERENCES daos(id)
 * );
 * 
 * -- DAO Treasury table
 * CREATE TABLE dao_treasury (
 *   id VARCHAR(255) PRIMARY KEY,
 *   dao_id VARCHAR(255) NOT NULL,
 *   balance DECIMAL(20, 8),
 *   monthly_burn_rate DECIMAL(20, 8),
 *   runway_months INT,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   FOREIGN KEY (dao_id) REFERENCES daos(id)
 * );
 * 
 * -- Proposals table
 * CREATE TABLE proposals (
 *   id VARCHAR(255) PRIMARY KEY,
 *   dao_id VARCHAR(255) NOT NULL,
 *   title VARCHAR(255) NOT NULL,
 *   status ENUM('active', 'passed', 'failed', 'executed') DEFAULT 'active',
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   FOREIGN KEY (dao_id) REFERENCES daos(id)
 * );
 */

/**
 * Example Database Queries
 */

export const MorioQueries = {
  // Get active agents
  getActiveAgents: `
    SELECT name, status, last_heartbeat, messages_processed 
    FROM agents 
    WHERE status = 'online' 
    ORDER BY name
  `,

  // Get DAO members
  getDaoMembers: `
    SELECT COUNT(*) as member_count,
           SUM(CASE WHEN last_active > NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) as active_count
    FROM dao_members
    WHERE dao_id = $1
  `,

  // Get treasury data
  getTreasuryData: `
    SELECT balance, monthly_burn_rate, runway_months
    FROM dao_treasury
    WHERE dao_id = $1
  `,

  // Get active proposals
  getActiveProposals: `
    SELECT COUNT(*) as proposal_count,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM proposals
    WHERE dao_id = $1
  `,

  // Get agents health
  getAgentsHealth: `
    SELECT COUNT(*) as total_agents,
           SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as active_agents,
           AVG(messages_processed) as avg_messages
    FROM agents
  `
};

/**
 * Configuration Constants
 */

export const MorioConfig = {
  // Cache TTLs
  CACHE_STANDARD_TTL: 300, // 5 minutes
  CACHE_LONG_TTL: 3600, // 1 hour
  CACHE_SHORT_TTL: 60, // 1 minute

  // Update intervals (ms)
  STATUS_UPDATE_INTERVAL: 30000, // 30 seconds
  PERFORMANCE_UPDATE_INTERVAL: 60000, // 60 seconds
  ALERTS_UPDATE_INTERVAL: 15000, // 15 seconds
  HEALTH_CHECK_INTERVAL: 60000, // 60 seconds

  // WebSocket settings
  WEBSOCKET_RECONNECT_DELAY: 1000,
  WEBSOCKET_RECONNECT_DELAY_MAX: 5000,
  WEBSOCKET_RECONNECT_ATTEMPTS: 5,

  // Rate limits
  MAX_REQUESTS_PER_MINUTE: 100,
  MAX_WEBSOCKET_CONNECTIONS: 1000,

  // Data retention
  METRICS_RETENTION_DAYS: 30,
  ALERTS_RETENTION_DAYS: 90,

  // Feature flags
  ENABLE_CACHING: true,
  ENABLE_REAL_TIME_UPDATES: true,
  ENABLE_DEBUG_MODE: false
};

/**
 * Monitoring & Logging
 */

export const MorioMonitoring = {
  // Log levels
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',

  // Metrics to track
  METRICS: [
    'api_response_time',
    'websocket_connections',
    'cache_hit_rate',
    'error_rate',
    'active_alerts',
    'system_uptime'
  ],

  // Log examples
  logApiCall: (endpoint: string, duration: number, status: number) => {
    console.log(`[Morio API] ${endpoint} - ${duration}ms - ${status}`);
  },

  logWebSocketEvent: (event: string, clientId: string) => {
    console.log(`[Morio WS] ${event} - Client: ${clientId}`);
  },

  logCacheHit: (key: string) => {
    console.log(`[Morio Cache] HIT - ${key}`);
  },

  logCacheMiss: (key: string) => {
    console.log(`[Morio Cache] MISS - ${key}`);
  }
};

/**
 * Production Checklist
 * 
 * [ ] Configure environment variables
 * [ ] Setup database tables
 * [ ] Configure CORS settings
 * [ ] Enable HTTPS/WSS
 * [ ] Setup rate limiting
 * [ ] Configure cache strategy
 * [ ] Setup monitoring/alerting
 * [ ] Enable debug logging
 * [ ] Test WebSocket connections
 * [ ] Load test dashboard
 * [ ] Monitor memory/CPU usage
 * [ ] Setup log aggregation
 * [ ] Configure backups
 * [ ] Document API endpoints
 * [ ] Setup API documentation
 * [ ] Test role-based access
 * [ ] Verify error handling
 */
