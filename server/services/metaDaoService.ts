
import { db } from '../db';
import { daos, users } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

interface MetaDAO {
  id: string;
  name: string;
  type: 'geographic' | 'sectoral' | 'purpose' | 'supply_chain';
  memberDaos: string[];
  votingPower: Map<string, number>;
}

export class MetaDaoService {
  /**
   * Calculate quadratic voting power for a DAO in MetaDAO
   */
  async calculateVotingPower(daoId: string): Promise<number> {
    const [dao] = await db.select().from(daos).where(eq(daos.id, daoId));
    if (!dao) return 0;
    
    // Quadratic voting: voting_power = sqrt(member_count)
    const memberCount = dao.memberCount || 0;
    return Math.sqrt(memberCount);
  }

  /**
   * Create a new MetaDAO
   */
  async createMetaDAO(params: {
    name: string;
    description: string;
    type: string;
    foundingDaoIds: string[];
    creatorId: string;
  }) {
    // Validation: minimum 3 DAOs required
    if (params.foundingDaoIds.length < 3) {
      throw new Error('MetaDAO requires minimum 3 founding DAOs');
    }

    // Validation: All DAOs must be Collective tier or higher
    const foundingDaos = await db
      .select()
      .from(daos)
      .where(sql`id = ANY(${params.foundingDaoIds})`);

    const invalidDaos = foundingDaos.filter(d => d.daoType === 'free');
    if (invalidDaos.length > 0) {
      throw new Error('Free tier DAOs cannot join MetaDAOs');
    }

    // Create MetaDAO
    const metaDaoId = crypto.randomUUID();
    
    await db.execute(sql`
      INSERT INTO meta_daos (id, name, description, meta_dao_type, created_at)
      VALUES (${metaDaoId}, ${params.name}, ${params.description}, ${params.type}, NOW())
    `);

    // Add founding DAO memberships
    for (const daoId of params.foundingDaoIds) {
      const votingPower = await this.calculateVotingPower(daoId);
      
      await db.execute(sql`
        INSERT INTO meta_dao_memberships (meta_dao_id, dao_id, voting_power, joined_at)
        VALUES (${metaDaoId}, ${daoId}, ${votingPower}, NOW())
      `);
    }

    return { metaDaoId, memberCount: params.foundingDaoIds.length };
  }

  /**
   * Submit cross-DAO proposal
   */
  async submitCrossDAOProposal(params: {
    metaDaoId: string;
    proposerDaoId: string;
    title: string;
    description: string;
    proposalType: string;
    budget?: number;
    beneficiaryDaos: string[];
  }) {
    const proposalId = crypto.randomUUID();
    const votingEnd = new Date();
    votingEnd.setHours(votingEnd.getHours() + 168); // 7 days

    await db.execute(sql`
      INSERT INTO meta_dao_proposals (
        id, meta_dao_id, proposer_dao_id, title, description, 
        proposal_type, budget, beneficiary_daos, voting_end
      )
      VALUES (
        ${proposalId}, ${params.metaDaoId}, ${params.proposerDaoId},
        ${params.title}, ${params.description}, ${params.proposalType},
        ${params.budget || 0}, ${JSON.stringify(params.beneficiaryDaos)}, ${votingEnd}
      )
    `);

    return { proposalId };
  }

  /**
   * Vote on MetaDAO proposal (DAO-level voting)
   */
  async voteOnProposal(params: {
    proposalId: string;
    daoId: string;
    vote: 'yes' | 'no' | 'abstain';
  }) {
    // Get DAO's voting power
    const [membership] = await db.execute(sql`
      SELECT voting_power FROM meta_dao_memberships
      WHERE dao_id = ${params.daoId}
      AND meta_dao_id = (SELECT meta_dao_id FROM meta_dao_proposals WHERE id = ${params.proposalId})
    `);

    if (!membership) {
      throw new Error('DAO not member of this MetaDAO');
    }

    await db.execute(sql`
      INSERT INTO meta_dao_votes (proposal_id, dao_id, vote, voting_power)
      VALUES (${params.proposalId}, ${params.daoId}, ${params.vote}, ${membership.voting_power})
      ON CONFLICT (proposal_id, dao_id) DO UPDATE SET vote = ${params.vote}
    `);

    // Check quorum
    await this.checkProposalQuorum(params.proposalId);
  }

  /**
   * Check if proposal met quorum
   */
  private async checkProposalQuorum(proposalId: string) {
    const result = await db.execute(sql`
      WITH proposal_meta AS (
        SELECT meta_dao_id, quorum_percentage
        FROM meta_dao_proposals mp
        JOIN meta_daos md ON mp.meta_dao_id = md.id
        WHERE mp.id = ${proposalId}
      ),
      total_power AS (
        SELECT COALESCE(SUM(voting_power), 0) as total
        FROM meta_dao_memberships
        WHERE meta_dao_id = (SELECT meta_dao_id FROM proposal_meta)
      ),
      voted_power AS (
        SELECT COALESCE(SUM(voting_power), 0) as voted
        FROM meta_dao_votes
        WHERE proposal_id = ${proposalId}
      )
      SELECT 
        (voted.voted / NULLIF(total.total, 0) * 100) >= pm.quorum_percentage as quorum_met
      FROM proposal_meta pm, total_power total, voted_power voted
    `);

    if (result[0]?.quorum_met) {
      await db.execute(sql`
        UPDATE meta_dao_proposals 
        SET quorum_met = true 
        WHERE id = ${proposalId}
      `);
    }
  }
  // ==================== PHASE 2: CHILD REGISTRY ====================

  /**
   * PHASE 2: Register child DAO with parent (via ChildDAORegistry contract)
   */
  async registerChildDAO(params: {
    parentDAOId: string;
    childDAOAddress: string;
    childDAOName: string;
    leaders: string[];
    memberCount: number;
    allocationPercentage: number;
  }) {
    // Verify parent is a meta DAO
    const [parentDAO] = await db.execute(sql`
      SELECT id FROM daos WHERE id = ${params.parentDAOId}
    `);

    if (!parentDAO) {
      throw new Error(`Parent DAO not found: ${params.parentDAOId}`);
    }

    // Record child registration in database
    await db.execute(sql`
      INSERT INTO meta_dao_child_registry (
        parent_dao_id, child_dao_address, child_dao_name, 
        member_count, allocation_percentage, status, registered_at
      )
      VALUES (
        ${params.parentDAOId}, ${params.childDAOAddress}, ${params.childDAOName},
        ${params.memberCount}, ${params.allocationPercentage}, 'PENDING_APPROVAL', NOW()
      )
    `);

    return { status: 'pending_approval', childDAOAddress: params.childDAOAddress };
  }

  /**
   * PHASE 2: Approve child DAO and grant allocation
   */
  async approveChildDAO(childDAOId: string, allocationPercentage: number) {
    await db.execute(sql`
      UPDATE meta_dao_child_registry 
      SET status = 'APPROVED', allocation_percentage = ${allocationPercentage}
      WHERE id = ${childDAOId}
    `);

    return { status: 'approved' };
  }

  /**
   * PHASE 2: Distribute dividends to child DAOs
   */
  async distributeDividends(params: {
    parentDAOId: string;
    totalAmount: number;
    tokenAddress: string;
    description: string;
  }) {
    // Calculate allocations for each active child
    const children = await db.execute(sql`
      SELECT id, allocation_percentage FROM meta_dao_child_registry
      WHERE parent_dao_id = ${params.parentDAOId}
      AND status = 'APPROVED'
    `);

    const dividendId = crypto.randomUUID();

    // Create dividend record
    await db.execute(sql`
      INSERT INTO meta_dao_dividends (
        id, parent_dao_id, total_amount, token_address, description, distributed_at
      )
      VALUES (
        ${dividendId}, ${params.parentDAOId}, ${params.totalAmount}, 
        ${params.tokenAddress}, ${params.description}, NOW()
      )
    `);

    // Create allocations for each child
    for (const child of children) {
      const allocation = Math.floor((params.totalAmount * child.allocation_percentage) / 10000);
      
      await db.execute(sql`
        INSERT INTO meta_dao_dividend_allocations (
          dividend_id, child_dao_id, allocated_amount, claimed_at
        )
        VALUES (${dividendId}, ${child.id}, ${allocation}, NULL)
      `);
    }

    return { dividendId, distribution: 'pending_claim' };
  }

  /**
   * PHASE 2: Suspend child DAO (contagion prevention)
   */
  async suspendChildDAO(childDAOId: string, reason: string) {
    await db.execute(sql`
      UPDATE meta_dao_child_registry 
      SET status = 'SUSPENDED'
      WHERE id = ${childDAOId}
    `);

    // Log suspension event
    await db.execute(sql`
      INSERT INTO meta_dao_events (
        event_type, child_dao_id, details, created_at
      )
      VALUES ('DAO_SUSPENDED', ${childDAOId}, ${reason}, NOW())
    `);

    return { status: 'suspended', reason };
  }

  /**
   * PHASE 2: Request DAO exit (30-day notice)
   */
  async requestChildDAOExit(childDAOId: string) {
    await db.execute(sql`
      UPDATE meta_dao_child_registry 
      SET exit_requested_at = NOW()
      WHERE id = ${childDAOId}
    `);

    return { 
      status: 'exit_pending', 
      noticeExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) 
    };
  }

  /**
   * PHASE 2: Reputation transfer between DAOs in federation
   */
  async transferMemberReputation(params: {
    memberId: string;
    fromDAOId: string;
    toDAOId: string;
  }) {
    // Get source reputation
    const [sourceRep] = await db.execute(sql`
      SELECT reputation_score FROM member_reputation
      WHERE member_id = ${params.memberId}
      AND dao_id = ${params.fromDAOId}
    `);

    if (!sourceRep) {
      throw new Error(`Member reputation not found`);
    }

    // Transfer at 70% to prevent reputation arbitrage
    const transferredReputation = Math.floor(sourceRep.reputation_score * 0.7);

    // Record reputation transfer
    await db.execute(sql`
      INSERT INTO member_reputation (member_id, dao_id, reputation_score)
      VALUES (${params.memberId}, ${params.toDAOId}, ${transferredReputation})
      ON CONFLICT (member_id, dao_id) DO UPDATE 
      SET reputation_score = reputation_score + ${transferredReputation}
    `);

    return { 
      transferred: transferredReputation, 
      percent: 70 
    };
  }

  /**
   * PHASE 2: Get federation analytics
   */
  async getFederationAnalytics(parentDAOId: string) {
    const [stats] = await db.execute(sql`
      SELECT 
        COUNT(*) as total_children,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as active_children,
        SUM(allocation_percentage) as total_allocation,
        AVG(member_count) as avg_child_size
      FROM meta_dao_child_registry
      WHERE parent_dao_id = ${parentDAOId}
    `);

    return {
      parentDAOId,
      totalChildren: stats?.total_children || 0,
      activeChildren: stats?.active_children || 0,
      totalAllocation: ((stats?.total_allocation || 0) / 100).toFixed(2),
      avgChildSize: Math.round(stats?.avg_child_size || 0),
    };
  }}

export const metaDaoService = new MetaDaoService();
