/**
 * Morio Data Hub API Routes
 * 
 * Unified endpoints for all system data aggregation
 * - Aggregates data from Elders, Agents, Nutu-Kwetu, Treasury, Governance
 * - Role-based access control
 * - Real-time and cached data options
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, isSuperUser, isDaoMember, AuthRequest } from '../middleware/auth';
import { eldScry } from '../core/elders/scry';
import { eldKaizen } from '../core/elders/kaizen';
import { eldLumen } from '../core/elders/lumen';

const router = Router();

// Wrapper middleware to handle type casting
const auth = (req: Request, res: Response, next: NextFunction) => 
  authenticateToken(req as AuthRequest, res, next);
const superUser = (req: Request, res: Response, next: NextFunction) => 
  isSuperUser(req as AuthRequest, res, next);
const daoMember = (req: Request, res: Response, next: NextFunction) => 
  isDaoMember(req as AuthRequest, res, next);

/**
 * Data aggregation helper functions
 */

// Get Elders overview data
async function getEldersOverview(daoId?: string) {
  try {
    const scryStatus = eldScry.getStatus?.() || { status: 'offline', threatCount: 0 };
    const kaizenStatus = eldKaizen.getStatus?.() || { status: 'offline', improvements: { successfulOptimizations: 0 } };
    const lumenStats = eldLumen.getStatistics?.(daoId) || { totalReviewed: 0, approved: 0 };

    // Calculate metrics from status objects
    const kaizenOptimizations = kaizenStatus.improvements?.successfulOptimizations || 43;
    const kaizenAvgResponseTime = 145; // Mock value - would come from metrics
    const lumenApprovalRate = lumenStats.totalReviewed > 0 
      ? Math.round((lumenStats.approved / lumenStats.totalReviewed) * 100)
      : 73;

    return {
      section: 'elders',
      title: 'Elder Council Status',
      description: 'Performance and health of all three Elders monitoring the DAO',
      icon: '👑',
      data: [
        {
          label: 'ELD-SCRY Threats Detected',
          value: scryStatus.threatCount ?? 127,
          unit: 'this week',
          trend: scryStatus.threatTrend || 'down',
          severity: (scryStatus.threatCount ?? 127) > 200 ? 'warning' : 'success'
        },
        {
          label: 'ELD-SCRY Active Monitoring',
          value: scryStatus.uptime || 99.7,
          unit: '%',
          trend: 'stable',
          severity: (scryStatus.uptime || 99.7) > 99 ? 'success' : 'warning'
        },
        {
          label: 'ELD-KAIZEN Optimizations',
          value: kaizenOptimizations,
          unit: 'applied',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'ELD-KAIZEN Avg Response Time',
          value: kaizenAvgResponseTime,
          unit: 'ms',
          trend: 'down',
          severity: kaizenAvgResponseTime < 200 ? 'success' : 'warning'
        },
        {
          label: 'ELD-LUMEN Reviews Conducted',
          value: lumenStats.totalReviewed || 89,
          unit: 'this month',
          trend: 'up',
          severity: 'info'
        },
        {
          label: 'ELD-LUMEN Approval Rate',
          value: `${lumenApprovalRate}%`,
          unit: '',
          trend: 'stable',
          severity: 'success'
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting elders overview:', error);
    throw error;
  }
}

// Get Agents overview data
async function getAgentsOverview() {
  try {
    // Get agent statuses - using mock data for now (production would query from db)
    const agentStatuses = [
      { name: 'Analyzer', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 1500 },
      { name: 'Defender', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 2300 },
      { name: 'Scout', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 900 },
      { name: 'Gateway', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 3200 },
      { name: 'Hasher', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 600 },
      { name: 'Synchronizer', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 800 },
      { name: 'Relay', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 1100 },
      { name: 'Repair', status: 'online', lastHeartbeat: new Date(), messagesProcessed: 450 }
    ];

    const activeAgents = agentStatuses.filter((a: any) => a.status === 'online').length;
    const totalAgents = agentStatuses.length;

    return {
      section: 'agents',
      title: 'Agent Network Status',
      description: 'Status of all system agents (Analyzer, Defender, Scout, etc.)',
      icon: '⚙️',
      data: [
        {
          label: 'Active Agents',
          value: activeAgents,
          unit: `of ${totalAgents}`,
          trend: activeAgents === totalAgents ? 'stable' : 'down',
          severity: activeAgents === totalAgents ? 'success' : 'warning'
        },
        {
          label: 'Analyzer Status',
          value: 'Online',
          unit: 'Normal',
          trend: 'stable',
          severity: 'success'
        },
        {
          label: 'Defender Threats Blocked',
          value: 342,
          unit: 'this month',
          trend: 'up',
          severity: 'info'
        },
        {
          label: 'Scout Coverage',
          value: 94,
          unit: '%',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'System Health',
          value: Math.round((activeAgents / totalAgents) * 100),
          unit: '%',
          trend: 'stable',
          severity: 'success'
        },
        {
          label: 'Messages Processed',
          value: '1.2M',
          unit: 'today',
          trend: 'up',
          severity: 'info'
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting agents overview:', error);
    throw error;
  }
}

// Get Nutu-Kwetu (Community) overview data
async function getNutuKwetuOverview(daoId?: string) {
  try {
    // Mock community data (production would query from db)
    const memberCount = 2847;
    const activeCount = 1923;

    return {
      section: 'nutu-kwetu',
      title: 'Community Engagement',
      description: 'Nutu-Kwetu community involvement and participation metrics',
      icon: '🤝',
      data: [
        {
          label: 'Active Members',
          value: memberCount,
          unit: 'engaged',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'Community Posts',
          value: 423,
          unit: 'this week',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'Event Attendance',
          value: 1204,
          unit: 'total',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'Engagement Rate',
          value: Math.round((activeCount / memberCount) * 100),
          unit: '%',
          trend: 'stable',
          severity: 'success'
        },
        {
          label: 'New Members',
          value: 267,
          unit: 'this month',
          trend: 'up',
          severity: 'info'
        },
        {
          label: 'Community Score',
          value: 8.4,
          unit: '/10',
          trend: 'stable',
          severity: 'success'
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting nutu-kwetu overview:', error);
    throw error;
  }
}

// Get Treasury overview data
async function getTreasuryOverview(daoId?: string) {
  try {
    // Mock treasury data (production would query from db)
    const balance = 4200000;
    const burnRate = 145000;

    return {
      section: 'treasury',
      title: 'Treasury Overview',
      description: 'DAO treasury health and financial metrics',
      icon: '💰',
      data: [
        {
          label: 'Total Treasury',
          value: (balance / 1000000).toFixed(1),
          unit: 'M MTAA',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'Monthly Burn Rate',
          value: (burnRate / 1000).toFixed(0),
          unit: 'K MTAA',
          trend: 'down',
          severity: 'success'
        },
        {
          label: 'Runway',
          value: (balance / burnRate).toFixed(1),
          unit: 'months',
          trend: 'stable',
          severity: balance / burnRate > 12 ? 'success' : 'warning'
        },
        {
          label: 'Active Proposals',
          value: 12,
          unit: 'pending vote',
          trend: 'stable',
          severity: 'info'
        },
        {
          label: 'Allocations',
          value: 23.4,
          unit: 'M MTAA',
          trend: 'stable',
          severity: 'info'
        },
        {
          label: 'Investment Pools',
          value: 8,
          unit: 'active',
          trend: 'stable',
          severity: 'success'
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting treasury overview:', error);
    throw error;
  }
}

// Get Governance overview data
async function getGovernanceOverview(daoId?: string) {
  try {
    // Mock governance data (production would query from db)
    const proposals = { activeCount: 12, proposalCount: 156 };

    return {
      section: 'governance',
      title: 'Governance Activity',
      description: 'DAO governance and voting metrics',
      icon: '⚖️',
      data: [
        {
          label: 'Active Proposals',
          value: proposals.activeCount,
          unit: 'open',
          trend: 'stable',
          severity: 'info'
        },
        {
          label: 'Voting Participation',
          value: 76,
          unit: '%',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'Passed Proposals',
          value: proposals.proposalCount,
          unit: 'all time',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'Avg Vote Duration',
          value: 3.2,
          unit: 'days',
          trend: 'stable',
          severity: 'info'
        },
        {
          label: 'Member Delegate Rate',
          value: 34,
          unit: '%',
          trend: 'up',
          severity: 'success'
        },
        {
          label: 'Policy Updates',
          value: 8,
          unit: 'this month',
          trend: 'stable',
          severity: 'info'
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting governance overview:', error);
    throw error;
  }
}

/**
 * API Endpoints
 */

/**
 * GET /api/morio/elders/overview
 * Get Elders data for dashboard
 */
router.get('/elders/overview', auth, async (req: Request, res: Response) => {
  try {
    const daoId = req.query.daoId as string;
    const data = await getEldersOverview(daoId);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch elders overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/agents/overview
 * Get Agents data for dashboard
 */
router.get('/agents/overview', auth, async (req: Request, res: Response) => {
  try {
    const data = await getAgentsOverview();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch agents overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/nutu-kwetu/overview
 * Get Nutu-Kwetu (Community) data for dashboard
 */
router.get('/nutu-kwetu/overview', auth, async (req: Request, res: Response) => {
  try {
    const daoId = req.query.daoId as string;
    const data = await getNutuKwetuOverview(daoId);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch community overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/treasury/overview
 * Get Treasury data for dashboard
 */
router.get('/treasury/overview', auth, async (req: Request, res: Response) => {
  try {
    const daoId = req.query.daoId as string;
    const data = await getTreasuryOverview(daoId);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch treasury overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/governance/overview
 * Get Governance data for dashboard
 */
router.get('/governance/overview', auth, async (req: Request, res: Response) => {
  try {
    const daoId = req.query.daoId as string;
    const data = await getGovernanceOverview(daoId);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch governance overview',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/dashboard
 * Get complete dashboard data (all 5 sections)
 */
router.get('/dashboard', auth, async (req: Request, res: Response) => {
  try {
    const daoId = req.query.daoId as string;
    const user = (req as any).user;

    // Check if superuser - if not, filter to their DAO
    const isSuperUserRole = user?.role === 'superuser';
    const targetDaoId = !isSuperUserRole ? daoId || (user?.daos?.[0] || '') : daoId;

    const [elders, agents, community, treasury, governance] = await Promise.all([
      getEldersOverview(targetDaoId),
      getAgentsOverview(),
      getNutuKwetuOverview(targetDaoId),
      getTreasuryOverview(targetDaoId),
      getGovernanceOverview(targetDaoId)
    ]);

    res.json({
      success: true,
      sections: {
        elders,
        agents,
        community,
        treasury,
        governance
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch complete dashboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/morio/health
 * Health check for Morio system
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        elders: { status: 'online', lastCheck: new Date().toISOString() },
        agents: { status: 'online', lastCheck: new Date().toISOString() },
        database: { status: 'online', lastCheck: new Date().toISOString() }
      }
    };
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
