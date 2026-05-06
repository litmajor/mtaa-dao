/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONSOLIDATED API REFERENCE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Complete reference for all consolidated API endpoints after routing restructuring.
 * Use this as your source of truth for API documentation.
 * 
 * Generated: 2025-01-15
 * Version: 1.0
 * Status: Consolidation Complete
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HEALTH CHECK ENDPOINTS (/api/health)
// ═══════════════════════════════════════════════════════════════════════════════
// File: server/routes/health.ts
// Status: CONSOLIDATED - Added unified /subsystems endpoint

export const HEALTH_ENDPOINTS = {
  
  // UNIFIED HEALTH CHECK (NEW)
  getSubsystemsHealth: {
    method: 'GET',
    path: '/api/health/subsystems',
    auth: 'required',
    description: 'Get comprehensive health status of all subsystems',
    response: {
      timestamp: 'ISO8601',
      status: 'healthy|degraded|down',
      subsystems: {
        database: { status: string, lastCheck: string },
        cache: { status: string, lastCheck: string },
        ethereum: { status: string, lastCheck: string },
        aaveProtocol: { status: string, lastCheck: string },
        uniswap: { status: string, lastCheck: string },
        authentication: { status: string, lastCheck: string },
        adminApi: { status: string, lastCheck: string },
        userApi: { status: string, lastCheck: string },
        strategyApi: { status: string, lastCheck: string },
        strategyExecution: { status: string, lastCheck: string },
        riskManagement: { status: string, lastCheck: string },
        analytics: { status: string, lastCheck: string },
        graphPropagation: { status: string, lastCheck: string },
        monitoring: { status: string, lastCheck: string }
      },
      summary: {
        totalSubsystems: number,
        healthySubsystems: number,
        degradedSubsystems: number,
        downSubsystems: number,
        overallStatus: string,
        uptime: string
      }
    }
  },

  // INDIVIDUAL HEALTH CHECKS (existing)
  getDatabase: {
    method: 'GET',
    path: '/api/health/db',
    auth: 'optional',
    description: 'Check PostgreSQL database health'
  },

  getCache: {
    method: 'GET',
    path: '/api/health/cache',
    auth: 'optional',
    description: 'Check Redis cache health'
  },

  getEthereum: {
    method: 'GET',
    path: '/api/health/ethereum',
    auth: 'optional',
    description: 'Check Ethereum network connectivity'
  },

  getPropagation: {
    method: 'GET',
    path: '/api/health/propagation',
    auth: 'required',
    description: 'Check graph propagation service health'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STRATEGY ENDPOINTS (/api/strategies)
// ═══════════════════════════════════════════════════════════════════════════════
// Files: strategiesConsolidated.ts
// Consolidates: strategy.ts + strategyDeployment.ts
// Deprecates: /api/strategy/* (singular path)

export const STRATEGY_ENDPOINTS = {

  // STRATEGY MANAGEMENT - Core CRUD
  
  listStrategies: {
    method: 'GET',
    path: '/api/strategies',
    auth: 'optional',
    params: {
      skip: 'number (default: 0)',
      limit: 'number (default: 20)',
      riskLevel: 'string (low|medium|high)',
      tags: 'string (comma-separated)',
      sortBy: 'string (default: createdAt)'
    },
    description: 'List all strategies with optional filtering'
  },

  createStrategy: {
    method: 'POST',
    path: '/api/strategies',
    auth: 'required',
    body: {
      name: 'string - Strategy name',
      description: 'string - Strategy description',
      allocations: 'array - Asset allocations',
      rebalanceFrequencyDays: 'number (default: 7)',
      tags: 'array (default: [])',
      riskLevel: 'string (default: medium)',
      freqtradeStrategyCode: 'string (optional)',
      backtestRequest: 'object (optional)'
    },
    response: {
      success: boolean,
      message: string,
      data: {
        id: string,
        name: string,
        creatorId: string,
        status: 'active|paused|archived',
        created_at: 'ISO8601'
      }
    }
  },

  getStrategyDetails: {
    method: 'GET',
    path: '/api/strategies/:strategyId',
    auth: 'optional',
    params: { strategyId: 'string' },
    description: 'Get specific strategy details'
  },

  updateStrategy: {
    method: 'PUT',
    path: '/api/strategies/:strategyId',
    auth: 'required',
    params: { strategyId: 'string' },
    body: {
      name: 'string (optional)',
      description: 'string (optional)',
      allocations: 'array (optional)',
      rebalanceFrequencyDays: 'number (optional)',
      tags: 'array (optional)',
      riskLevel: 'string (optional)'
    },
    description: 'Update an existing strategy (owner only)'
  },

  deleteStrategy: {
    method: 'DELETE',
    path: '/api/strategies/:strategyId',
    auth: 'required',
    params: { strategyId: 'string' },
    description: 'Deactivate a strategy (owner only)'
  },

  // USER INTERACTIONS

  getUserCreatedStrategies: {
    method: 'GET',
    path: '/api/strategies/my/created',
    auth: 'required',
    description: "Get current user's created strategies"
  },

  getUserFollowedStrategies: {
    method: 'GET',
    path: '/api/strategies/my/followed',
    auth: 'required',
    description: "Get current user's followed strategies"
  },

  followStrategy: {
    method: 'POST',
    path: '/api/strategies/:strategyId/follow',
    auth: 'required',
    params: { strategyId: 'string' },
    description: 'Follow/copy a strategy'
  },

  unfollowStrategy: {
    method: 'DELETE',
    path: '/api/strategies/:strategyId/follow',
    auth: 'required',
    params: { strategyId: 'string' },
    description: 'Stop following a strategy'
  },

  // PERFORMANCE & ANALYTICS

  getStrategyPerformance: {
    method: 'GET',
    path: '/api/strategies/:strategyId/performance',
    auth: 'optional',
    params: { strategyId: 'string' },
    response: {
      returns: 'number',
      totalReturn: 'number',
      drawdown: 'number',
      sharpeRatio: 'number',
      volatility: 'number',
      followers: 'number'
    },
    description: 'Get strategy performance metrics'
  },

  getBacktestResults: {
    method: 'GET',
    path: '/api/strategies/:strategyId/backtest',
    auth: 'optional',
    params: { strategyId: 'string' },
    description: 'Get backtest results for a strategy'
  },

  runBacktest: {
    method: 'POST',
    path: '/api/strategies/:strategyId/backtest',
    auth: 'required',
    params: { strategyId: 'string' },
    body: {
      pair: 'string (default: BTC/USDT)',
      timeframe: 'string (default: 1h)',
      timerange: 'string (default: 20230101-20231231)',
      stakeAmount: 'number (default: 100)',
      enableOptimization: 'boolean (default: false)'
    },
    response: {
      success: boolean,
      message: string,
      data: { backtestId: string }
    },
    description: 'Start a backtest run (async, returns 202 Accepted)'
  },

  getStrategyRankings: {
    method: 'GET',
    path: '/api/strategies/rankings/:metric',
    auth: 'optional',
    params: {
      metric: 'string (returns|sharpe|followers|drawdown)',
      limit: 'number (default: 20)'
    },
    description: 'Get leaderboard of top strategies by metric'
  },

  // OPERATIONS

  rebalanceStrategy: {
    method: 'POST',
    path: '/api/strategies/:strategyId/rebalance',
    auth: 'required',
    params: { strategyId: 'string' },
    description: 'Manually trigger strategy rebalancing'
  },

  deployStrategy: {
    method: 'POST',
    path: '/api/strategies/:strategyId/deploy',
    auth: 'required',
    params: { strategyId: 'string' },
    body: { dryRun: 'boolean (default: false)' },
    description: 'Deploy strategy to Freqtrade'
  },

  optimizeParameters: {
    method: 'POST',
    path: '/api/strategies/:strategyId/optimize',
    auth: 'required',
    params: { strategyId: 'string' },
    body: {
      parameters: 'array - Parameters to optimize',
      optimizer: 'string (default: hyperopt)'
    },
    response: {
      success: boolean,
      message: string,
      data: { optimizationId: string }
    },
    description: 'Start parameter optimization (async)'
  },

  // DISCOVERY

  searchStrategies: {
    method: 'GET',
    path: '/api/strategies/search',
    auth: 'optional',
    params: {
      q: 'string - Search query',
      riskLevel: 'string',
      tags: 'string (comma-separated)',
      minReturn: 'number',
      maxDrawdown: 'number',
      sortBy: 'string (default: popularity)'
    },
    description: 'Search and filter strategies'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ADMIN ENDPOINTS (/api/admin)
// ═══════════════════════════════════════════════════════════════════════════════
// File: adminConsolidated.ts
// Consolidates: admin.ts + admin-ai-metrics.ts
// Auth: ALL endpoints require super_admin role
// Headers: { Authorization: 'Bearer <jwt_token>' }

export const ADMIN_ENDPOINTS = {

  // AUTHENTICATION

  adminLogin: {
    method: 'POST',
    path: '/api/admin/auth/login',
    auth: 'none',
    body: {
      email: 'string',
      password: 'string'
    },
    response: {
      success: boolean,
      message: string,
      data: {
        token: 'string - JWT token',
        user: {
          id: string,
          email: string,
          roles: string[]
        }
      }
    },
    description: 'Admin login (returns JWT for other operations)'
  },

  registerSuperuser: {
    method: 'POST',
    path: '/api/admin/auth/register',
    auth: 'super_admin',
    body: {
      email: 'string',
      password: 'string',
      name: 'string (optional)'
    },
    description: 'Register new superuser (requires existing superuser)'
  },

  // USER MANAGEMENT

  listUsers: {
    method: 'GET',
    path: '/api/admin/users',
    auth: 'super_admin',
    params: {
      skip: 'number (default: 0)',
      limit: 'number (default: 20)',
      search: 'string (email or name)',
      role: 'string'
    },
    description: 'List all users with pagination and search'
  },

  getUserDetails: {
    method: 'GET',
    path: '/api/admin/users/:userId',
    auth: 'super_admin',
    params: { userId: 'string' },
    description: 'Get specific user details'
  },

  banUser: {
    method: 'PUT',
    path: '/api/admin/users/:userId/ban',
    auth: 'super_admin',
    params: { userId: 'string' },
    body: {
      banned: 'boolean',
      reason: 'string (ban reason)'
    },
    description: 'Ban or unban a user'
  },

  deleteUser: {
    method: 'DELETE',
    path: '/api/admin/users/:userId',
    auth: 'super_admin',
    params: { userId: 'string' },
    description: 'Delete a user account'
  },

  // DAO MANAGEMENT

  listDAOs: {
    method: 'GET',
    path: '/api/admin/daos',
    auth: 'super_admin',
    params: {
      skip: 'number (default: 0)',
      limit: 'number (default: 20)'
    },
    description: 'List all DAOs'
  },

  getDAODetails: {
    method: 'GET',
    path: '/api/admin/daos/:daoId',
    auth: 'super_admin',
    params: { daoId: 'string' },
    description: 'Get specific DAO details'
  },

  updateDAOStatus: {
    method: 'PUT',
    path: '/api/admin/daos/:daoId/status',
    auth: 'super_admin',
    params: { daoId: 'string' },
    body: { status: 'string (active|paused|disabled)' },
    description: 'Update DAO status'
  },

  // SECURITY & AUDIT

  listSessions: {
    method: 'GET',
    path: '/api/admin/security/sessions',
    auth: 'super_admin',
    description: 'List all active sessions'
  },

  revokeSession: {
    method: 'DELETE',
    path: '/api/admin/security/sessions/:sessionId',
    auth: 'super_admin',
    params: { sessionId: 'string' },
    description: 'Revoke a user session'
  },

  getAuditLogs: {
    method: 'GET',
    path: '/api/admin/security/audit',
    auth: 'super_admin',
    params: {
      skip: 'number (default: 0)',
      limit: 'number (default: 100)'
    },
    description: 'Get audit logs of system operations'
  },

  getActivityLogs: {
    method: 'GET',
    path: '/api/admin/activity-logs',
    auth: 'super_admin',
    params: {
      skip: 'number (default: 0)',
      limit: 'number (default: 100)',
      userId: 'string (optional - filter by user)'
    },
    description: 'Get user activity logs'
  },

  // SYSTEM CONFIGURATION

  getSettings: {
    method: 'GET',
    path: '/api/admin/settings',
    auth: 'super_admin',
    description: 'Get all system settings'
  },

  updateSettings: {
    method: 'PUT',
    path: '/api/admin/settings',
    auth: 'super_admin',
    body: {
      key: 'string - Setting key',
      value: 'any - Setting value'
    },
    description: 'Update a system setting'
  },

  // ANALYTICS & MONITORING

  getAnalytics: {
    method: 'GET',
    path: '/api/admin/analytics',
    auth: 'super_admin',
    response: {
      timestamp: 'ISO8601',
      users: {
        total: number,
        active: number
      },
      daos: {
        total: number
      },
      system: {
        uptime: number,
        memory: object
      }
    },
    description: 'Get dashboard analytics metrics'
  },

  // AI SYSTEM MONITORING

  getAIMetrics: {
    method: 'GET',
    path: '/api/admin/ai-metrics',
    auth: 'super_admin',
    response: {
      timestamp: 'ISO8601',
      nuru: {
        status: string,
        intentClassificationAccuracy: number,
        totalIntents: number,
        topIntents: array,
        languageDistribution: array
      },
      kwetu: {
        status: string,
        treasuryOperations: number,
        transactionsProcessed: number,
        averageLatency: number
      },
      morio: {
        status: string,
        agentRunsTotal: number,
        successRate: number
      }
    },
    description: 'Get comprehensive AI layer metrics'
  },

  getComponentMetrics: {
    method: 'GET',
    path: '/api/admin/ai-metrics/:component',
    auth: 'super_admin',
    params: { component: 'string (nuru|kwetu|morio)' },
    description: 'Get specific AI component metrics'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEPRECATED ENDPOINTS (Sunset: 2026-09-01)
// ═══════════════════════════════════════════════════════════════════════════════

export const DEPRECATED_ENDPOINTS = [
  // Strategy endpoints using singular /api/strategy
  'POST /api/strategy/create',         // Use: POST /api/strategies
  'GET  /api/strategy/:strategyId',    // Use: GET /api/strategies/:strategyId
  'POST /api/strategy/:id/follow',     // Use: POST /api/strategies/:id/follow
  'GET  /api/strategy/leaderboard/:metric', // Use: GET /api/strategies/rankings/:metric
  
  // Scattered health checks (use /api/health/subsystems instead)
  'GET  /api/health/database',
  'GET  /api/health/blockchain',
  
  // AI metrics from separate endpoint
  'GET  /api/admin/ai-metrics'  // Now consolidated in admin router
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK INTEGRATION CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════════

export const INTEGRATION_CHECKLIST = {
  'Update imports in Express app': false,
  'Mount consolidated routers': false,
  'Update client API calls': false,
  'Test deprecated endpoint warnings': false,
  'Add deprecation monitoring': false,
  'Update API documentation': false,
  'Notify teams of migration': false,
  'Set 6-month deprecation timer': false,
  'Plan removal after deprecation': false
};

export {}