import { db } from '../db';
import { v4 as uuid } from 'uuid';
import { sql } from 'drizzle-orm';
import proposalRiskAnalyzer, { RiskAnalysisResult } from './proposalRiskAnalyzer';

export interface CreateProposalDTO {
  agentId: string;
  actionType: string;
  proposedArgs: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AgentProposal {
  id: string;
  agent_id: string;
  action_type: string;
  proposed_args: Record<string, any>;
  risk_score: number;
  risk_category: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_breakdown?: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED';
  created_at: Date;
  expires_at: Date;
  approved_by?: string;
  approved_at?: Date;
  rejected_by?: string;
  rejection_reason?: string;
  rejected_at?: Date;
  executed_at?: Date;
  execution_hash?: string;
  ip_address?: string;
  user_agent?: string;
}

export class AgentProposalService {
  /**
   * Create a new proposal
   */
  async createProposal(dto: CreateProposalDTO, treasuryBalance: number): Promise<AgentProposal> {
    const proposalId = uuid();
    const now = new Date();
    const expiresAt = this.calculateExpirationTime(now);

    // Analyze risk
    const riskAnalysis = await proposalRiskAnalyzer.analyzeRisk(
      dto.agentId,
      dto.actionType,
      dto.proposedArgs,
      treasuryBalance
    );

    // Create proposal
    const result = await db.execute(sql`
      INSERT INTO agent_proposals (
        id, agent_id, action_type, proposed_args, risk_score, risk_category, 
        risk_breakdown, status, created_at, expires_at, ip_address, user_agent
      ) VALUES (
        ${proposalId}, ${dto.agentId}, ${dto.actionType}, ${JSON.stringify(dto.proposedArgs)},
        ${riskAnalysis.score}, ${riskAnalysis.category}, ${JSON.stringify(riskAnalysis.breakdown)},
        'PENDING', ${now}, ${expiresAt}, ${dto.ipAddress || null}, ${dto.userAgent || null}
      )
      RETURNING *
    `);

    const proposal = result.rows?.[0];
    if (!proposal) {
      throw new Error('Failed to create proposal');
    }

    return this.formatProposal(proposal);
  }

  /**
   * Get all proposals (with filtering)
   */
  async getProposals(options: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED';
    agentId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AgentProposal[]> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    let query: any;
    
    if (options.status && options.agentId) {
      query = await db.execute(sql`
        SELECT * FROM agent_proposals
        WHERE status = ${options.status} AND agent_id = ${options.agentId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
    } else if (options.status) {
      query = await db.execute(sql`
        SELECT * FROM agent_proposals
        WHERE status = ${options.status}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
    } else if (options.agentId) {
      query = await db.execute(sql`
        SELECT * FROM agent_proposals
        WHERE agent_id = ${options.agentId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
    } else {
      query = await db.execute(sql`
        SELECT * FROM agent_proposals
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
    }

    const proposals = query.rows || [];
    return proposals.map((p: any) => this.formatProposal(p));
  }

  /**
   * Get pending proposals sorted by expiration
   */
  async getPendingProposals(limit: number = 20): Promise<AgentProposal[]> {
    const result = await db.execute(sql`
      SELECT * FROM agent_proposals
      WHERE status = 'PENDING' AND expires_at > ${new Date()}
      ORDER BY expires_at ASC
      LIMIT ${limit}
    `);

    const proposals = result.rows || [];
    return proposals.map((p: any) => this.formatProposal(p));
  }

  /**
   * Get single proposal by ID
   */
  async getProposal(proposalId: string): Promise<AgentProposal | null> {
    const result = await db.execute(sql`
      SELECT * FROM agent_proposals WHERE id = ${proposalId}
    `);

    const proposal = result.rows?.[0];
    return proposal ? this.formatProposal(proposal) : null;
  }

  /**
   * Approve a proposal
   */
  async approveProposal(
    proposalId: string,
    approvedBy: string,
    reason: string
  ): Promise<AgentProposal> {
    const now = new Date();

    const result = await db.execute(sql`
      UPDATE agent_proposals
      SET status = 'APPROVED', approved_by = ${approvedBy}, approved_at = ${now}, reason = ${reason}
      WHERE id = ${proposalId}
      RETURNING *
    `);

    const proposal = result.rows?.[0];
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    return this.formatProposal(proposal);
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(
    proposalId: string,
    rejectedBy: string,
    reason: string
  ): Promise<AgentProposal> {
    const now = new Date();

    const result = await db.execute(sql`
      UPDATE agent_proposals
      SET status = 'REJECTED', rejected_by = ${rejectedBy}, rejected_at = ${now}, rejection_reason = ${reason}
      WHERE id = ${proposalId}
      RETURNING *
    `);

    const proposal = result.rows?.[0];
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    return this.formatProposal(proposal);
  }

  /**
   * Mark proposal as executed (after on-chain execution)
   */
  async markExecuted(proposalId: string, executionHash?: string): Promise<AgentProposal> {
    const now = new Date();

    const result = await db.execute(sql`
      UPDATE agent_proposals
      SET status = 'EXECUTED', executed_at = ${now}, execution_hash = ${executionHash || null}
      WHERE id = ${proposalId}
      RETURNING *
    `);

    const proposal = result.rows?.[0];
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    return this.formatProposal(proposal);
  }

  /**
   * Auto-expire old proposals
   */
  async expireOldProposals(): Promise<number> {
    const now = new Date();

    const result = await db.execute(sql`
      UPDATE agent_proposals
      SET status = 'EXPIRED'
      WHERE status = 'PENDING' AND expires_at <= ${now}
    `);

    return result.rowCount || 0;
  }

  /**
   * Get proposals for agent (for dashboard)
   */
  async getAgentProposalStats(agentId: string) {
    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [pending, approved, rejected, executed] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) as count FROM agent_proposals
        WHERE agent_id = ${agentId} AND status = 'PENDING' AND expires_at > ${now}
      `),

      db.execute(sql`
        SELECT COUNT(*) as count FROM agent_proposals
        WHERE agent_id = ${agentId} AND status = 'APPROVED' AND created_at >= ${oneDayAgo}
      `),

      db.execute(sql`
        SELECT COUNT(*) as count FROM agent_proposals
        WHERE agent_id = ${agentId} AND status = 'REJECTED' AND created_at >= ${oneDayAgo}
      `),

      db.execute(sql`
        SELECT COUNT(*) as count FROM agent_proposals
        WHERE agent_id = ${agentId} AND status = 'EXECUTED' AND executed_at >= ${oneDayAgo}
      `),
    ]);

    const pendingRow = (pending?.rows?.[0] as any) || {};
    const approvedRow = (approved?.rows?.[0] as any) || {};
    const rejectedRow = (rejected?.rows?.[0] as any) || {};
    const executedRow = (executed?.rows?.[0] as any) || {};

    return {
      pendingCount: parseInt(pendingRow.count || 0),
      approvedToday: parseInt(approvedRow.count || 0),
      rejectedToday: parseInt(rejectedRow.count || 0),
      executedToday: parseInt(executedRow.count || 0),
    };
  }

  /**
   * Private helper: format proposal from DB
   */
  private formatProposal(dbProposal: any): AgentProposal {
    return {
      ...dbProposal,
      proposed_args: typeof dbProposal.proposed_args === 'string'
        ? JSON.parse(dbProposal.proposed_args)
        : dbProposal.proposed_args,
      risk_breakdown: typeof dbProposal.risk_breakdown === 'string'
        ? JSON.parse(dbProposal.risk_breakdown)
        : dbProposal.risk_breakdown,
    };
  }

  /**
   * Calculate expiration time based on risk category
   * LOW: 5 minutes
   * MEDIUM: 1 hour
   * HIGH: 4 hours
   */
  private calculateExpirationTime(now: Date): Date {
    // This will be called after risk analysis, so we can't determine category here
    // Default to 1 hour - the calling service should adjust if needed
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
}

export default new AgentProposalService();
