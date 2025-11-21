
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
}

export const metaDaoService = new MetaDaoService();
