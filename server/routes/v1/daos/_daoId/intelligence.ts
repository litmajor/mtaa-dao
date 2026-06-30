import { Router } from 'express';
import { db } from '../../../../../db';
import { proposals, contributions, multisigTransactions, users } from '../../../../../../shared/schema';
import { eq, and, gt, lt, sql } from 'drizzle-orm';
import { isAuthenticated } from '../../../../nextAuthMiddleware';

const router = Router({ mergeParams: true });

// GET /api/v1/daos/:daoId/intelligence/events
router.get('/events', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const insights: any[] = [];

    // 1. Expiring Proposals
    const expiringProposals = await db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.daoId, daoId),
          eq(proposals.status, 'voting'),
          gt(proposals.voteEndTime, now),
          lt(proposals.voteEndTime, tomorrow)
        )
      );

    expiringProposals.forEach(p => {
      insights.push({
        id: `prop-${p.id}`,
        type: 'governance',
        severity: 'high',
        message: `Proposal "${p.title}" closes in less than 24 hours.`,
        actionLabel: 'Vote Now',
        actionUrl: `?open=governance&proposalId=${p.id}`,
        timestamp: new Date().toISOString()
      });
    });

    // 2. Multisig Transactions needing signatures
    const pendingMultisig = await db
      .select()
      .from(multisigTransactions)
      .where(
        and(
          eq(multisigTransactions.daoId, daoId),
          eq(multisigTransactions.status, 'pending'),
          lt(multisigTransactions.currentSignatures, multisigTransactions.requiredSignatures)
        )
      );

    pendingMultisig.forEach(m => {
      insights.push({
        id: `multisig-${m.id}`,
        type: 'treasury',
        severity: 'medium',
        message: `Pending treasury withdrawal of ${m.amount} ${m.currency} needs ${m.requiredSignatures - (m.currentSignatures || 0)} more signature(s).`,
        actionLabel: 'Review',
        actionUrl: `?open=treasury&txId=${m.id}`,
        timestamp: m.createdAt?.toISOString() || new Date().toISOString()
      });
    });

    // 3. Missed Contributions
    // Determine cycle duration based on DAO configuration
    const { daos, daoMemberships } = await import('../../../../../../shared/schema');
    const [dao] = await db
      .select({ rotationFrequency: daos.rotationFrequency })
      .from(daos)
      .where(eq(daos.id, daoId))
      .limit(1);

    let cycleDays = 30; // default to monthly
    if (dao?.rotationFrequency === 'weekly') cycleDays = 7;
    else if (dao?.rotationFrequency === 'quarterly') cycleDays = 90;

    const cycleStartDate = new Date(now.getTime() - cycleDays * 24 * 60 * 60 * 1000);
    
    const recentContributions = await db
      .select({ userId: contributions.userId })
      .from(contributions)
      .where(
        and(
          eq(contributions.daoId, daoId),
          gt(contributions.createdAt, cycleStartDate)
        )
      );
      
    const contributedUserIds = new Set(recentContributions.map(c => c.userId));
    
    // Get all members of the DAO
    const members = await db
      .select({ userId: daoMemberships.userId, firstName: users.firstName, lastName: users.lastName })
      .from(daoMemberships)
      .leftJoin(users, eq(users.id, daoMemberships.userId))
      .where(eq(daoMemberships.daoId, daoId));

    const missedMembers = members.filter(m => !contributedUserIds.has(m.userId));

    if (missedMembers.length > 0) {
      const cycleName = dao?.rotationFrequency || 'monthly';
      insights.push({
        id: `missed-contrib-${Date.now()}`,
        type: 'member',
        severity: 'medium',
        message: `${missedMembers.length} member(s) missed their ${cycleName} contribution.`,
        actionLabel: 'Send Reminder',
        actionUrl: `?open=members&action=remind`,
        timestamp: new Date().toISOString()
      });
    }

    // Sort by severity (high first) then timestamp
    insights.sort((a, b) => {
      const severityScore = { high: 3, medium: 2, low: 1 };
      const scoreA = severityScore[a.severity as keyof typeof severityScore] || 0;
      const scoreB = severityScore[b.severity as keyof typeof severityScore] || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    res.json({ success: true, events: insights });
  } catch (error: any) {
    console.error('Failed to fetch intelligence events:', error);
    res.status(500).json({ error: 'Failed to fetch intelligence events' });
  }
});

// GET /api/v1/daos/:daoId/intelligence/elder-insights
router.get('/elder-insights', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Elder Scry (Vision & Data) - Analyze Contributions
    // Check contribution velocity vs last month
    const recentContributions = await db
      .select()
      .from(contributions)
      .where(and(eq(contributions.daoId, daoId), gt(contributions.createdAt, thirtyDaysAgo)));
    
    let scryInsight = 'Contribution velocity is stable.';
    let scryRecommendation = 'Maintain current engagement strategies.';
    
    if (recentContributions.length < 5) {
      scryInsight = 'Contribution velocity is low this month.';
      scryRecommendation = 'Send reminders or create bounties to boost engagement.';
    } else {
      scryInsight = `Strong contribution velocity: ${recentContributions.length} contributions in the last 30 days.`;
    }

    // 2. Elder Kaizen (Optimization) - Analyze Governance
    // Check recent proposals to see if they reach quorum easily
    const recentProposals = await db
      .select()
      .from(proposals)
      .where(eq(proposals.daoId, daoId))
      .orderBy(sql`${proposals.createdAt} DESC`)
      .limit(5);

    let kaizenInsight = 'Governance participation looks healthy.';
    let kaizenRecommendation = 'No immediate changes needed to governance parameters.';

    const failedProposals = recentProposals.filter(p => p.status === 'defeated');
    if (recentProposals.length > 0 && failedProposals.length >= recentProposals.length / 2) {
      kaizenInsight = 'High rate of defeated proposals recently.';
      kaizenRecommendation = 'Consider lowering the voting quorum or extending voting periods.';
    } else if (recentProposals.length === 0) {
      kaizenInsight = 'No recent governance activity detected.';
      kaizenRecommendation = 'Encourage members to submit proposals for DAO improvements.';
    }

    // 3. Elder Lumen (Clarity) - Analyze Proposal Clarity
    let lumenInsight = 'Proposals are well-structured and clear.';
    let lumenRecommendation = 'Continue using the current proposal templates.';
    
    if (recentProposals.length > 0) {
      const shortProposals = recentProposals.filter(p => p.description && p.description.length < 50);
      if (shortProposals.length > 0) {
        lumenInsight = 'Some recent proposals lack detailed descriptions.';
        lumenRecommendation = 'Require a minimum character count or richer context for new proposals.';
      }
    }

    // 4. Coordinator (Execution) - Agent Network Health
    // We import agentRegistry dynamically to avoid circular deps if any
    const { agentRegistry } = await import('../../../../services/AgentRegistry');
    const activeAgents = agentRegistry.getAllAgents().filter(a => a.status === 'active');
    
    let coordInsight = `Agent network running nominally with ${activeAgents.length} active agents.`;
    let coordRecommendation = 'No immediate action required.';
    
    if (activeAgents.length === 0) {
      coordInsight = 'No active agents detected in the network.';
      coordRecommendation = 'Check AgentPaymentGateway subscriptions or start core agents.';
    }

    const insights = [
      {
        elderId: 'elder-scry',
        name: 'Elder Scry',
        role: 'Vision & Data',
        activeInsight: scryInsight,
        recommendation: scryRecommendation,
        lastRun: new Date().toISOString(),
      },
      {
        elderId: 'elder-kaizen',
        name: 'Elder Kaizen',
        role: 'Optimization',
        activeInsight: kaizenInsight,
        recommendation: kaizenRecommendation,
        lastRun: new Date().toISOString(),
      },
      {
        elderId: 'elder-lumen',
        name: 'Elder Lumen',
        role: 'Clarity',
        activeInsight: lumenInsight,
        recommendation: lumenRecommendation,
        lastRun: new Date().toISOString(),
      },
      {
        elderId: 'elder-coordinator',
        name: 'Coordinator',
        role: 'Execution',
        activeInsight: coordInsight,
        recommendation: coordRecommendation,
        lastRun: new Date().toISOString(),
      }
    ];

    res.json({ success: true, insights });
  } catch (error: any) {
    console.error('Failed to fetch elder insights:', error);
    res.status(500).json({ error: 'Failed to fetch elder insights' });
  }
});

// GET /api/v1/daos/:daoId/intelligence/agent-network
router.get('/agent-network', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    
    const { agentRegistry } = await import('../../../../services/AgentRegistry');
    const { daoAgentSubscriptions } = await import('../../../../../../shared/schema');
    const { ethers } = await import('ethers');
    
    const allAgents = agentRegistry.getAllAgents();
    const now = new Date();
    
    // Fetch active subscriptions for this DAO from the synced indexer DB table
    const activeSubscriptions = await db
      .select()
      .from(daoAgentSubscriptions)
      .where(
        and(
          eq(daoAgentSubscriptions.daoId, daoId),
          eq(daoAgentSubscriptions.isActive, true),
          gt(daoAgentSubscriptions.expiresAt, now)
        )
      );

    // Map registered agents into network format
    const mappedAgents = allAgents.map(a => {
      let tier = 'Tier 4';
      if (a.name.toLowerCase().includes('morio') || a.name.toLowerCase().includes('nuru')) tier = 'Tier 1';
      else if (a.name.toLowerCase().includes('elder') || a.name.toLowerCase().includes('coordinator')) tier = 'Tier 2';
      else if (a.type.includes('trading')) tier = 'Tier 3';
      else if (a.type.includes('analytics') || a.type.includes('analyzer')) tier = 'Domain Analyzers';
      
      // Determine if subscribed
      let agentIdBytes = a.id;
      if (!a.id.startsWith('0x')) agentIdBytes = ethers.id(a.id);
      
      const isSubscribed = activeSubscriptions.some(sub => sub.agentId === agentIdBytes);

      return {
        agentId: a.id,
        agentName: a.name,
        tier,
        isSubscribed,
        status: a.status,
        lastActive: a.lastActive ? new Date(a.lastActive).toISOString() : null,
        description: `${a.type} agent instance`,
        category: a.type
      };
    });

    // If local registry is empty, provide the canonical defaults
    if (mappedAgents.length === 0) {
      mappedAgents.push(
        { agentId: '1', agentName: 'Nuru', tier: 'Tier 1', isSubscribed: false, status: 'active', lastActive: new Date().toISOString(), description: 'Core data layer', category: 'orchestration' },
        { agentId: '2', agentName: 'Elder Kaizen', tier: 'Tier 2', isSubscribed: false, status: 'idle', lastActive: new Date(Date.now() - 3600000).toISOString(), description: 'Optimization', category: 'elder' },
        { agentId: '3', agentName: 'Defender', tier: 'Tier 4', isSubscribed: false, status: 'active', lastActive: new Date().toISOString(), description: 'Security', category: 'security' },
        { agentId: '4', agentName: 'Gov Analytics', tier: 'Domain Analyzers', isSubscribed: false, status: 'active', lastActive: new Date().toISOString(), description: 'Governance analytics', category: 'analyzer' }
      );
    }

    res.json({ success: true, agents: mappedAgents });
  } catch (error: any) {
    console.error('Failed to fetch agent network:', error);
    res.status(500).json({ error: 'Failed to fetch agent network' });
  }
});

export default router;
