
import { Request, Response } from 'express';
import { db } from '../storage';
import { daos, daoMemberships } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

// Get DAO settings
export async function getDaoSettingsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { daoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin permissions
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      )
    });

    if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Admin permissions required' });
    }

    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Return DAO settings
    const settings = {
      basic: {
        name: dao.name,
        description: dao.description,
        imageUrl: dao.imageUrl,
        bannerUrl: dao.bannerUrl,
        access: dao.access,
        inviteOnly: dao.inviteOnly,
        inviteCode: dao.inviteCode
      },
      governance: {
        quorumPercentage: dao.quorumPercentage,
        votingPeriod: dao.votingPeriod,
        executionDelay: dao.executionDelay
      },
      financial: {
        treasuryBalance: dao.treasuryBalance,
        plan: dao.plan,
        planExpiresAt: dao.planExpiresAt,
        billingStatus: dao.billingStatus
      },
      members: {
        memberCount: dao.memberCount
      }
    };

    res.json({ settings });
  } catch (error: any) {
    console.error('Error fetching DAO settings:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch DAO settings' });
  }
}

// Update DAO settings
export async function updateDaoSettingsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { daoId } = req.params;
    const { category, updates } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin permissions
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      )
    });

    if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Admin permissions required' });
    }

    // Validate and prepare updates based on category
    let validUpdates: any = {};

    switch (category) {
      case 'basic':
        const allowedBasicFields = ['name', 'description', 'imageUrl', 'bannerUrl', 'access', 'inviteOnly'];
        for (const [key, value] of Object.entries(updates)) {
          if (allowedBasicFields.includes(key)) {
            validUpdates[key] = value;
          }
        }
        
        // Generate new invite code if inviteOnly is being enabled
        if (updates.inviteOnly && !updates.inviteCode) {
          validUpdates.inviteCode = generateInviteCode();
        }
        break;

      case 'governance':
        const allowedGovernanceFields = ['quorumPercentage', 'votingPeriod', 'executionDelay'];
        for (const [key, value] of Object.entries(updates)) {
          if (allowedGovernanceFields.includes(key)) {
            // Validate governance values
            if (key === 'quorumPercentage' && (value < 1 || value > 100)) {
              return res.status(400).json({ error: 'Quorum percentage must be between 1 and 100' });
            }
            if (key === 'votingPeriod' && value < 1) {
              return res.status(400).json({ error: 'Voting period must be at least 1 hour' });
            }
            if (key === 'executionDelay' && value < 0) {
              return res.status(400).json({ error: 'Execution delay cannot be negative' });
            }
            validUpdates[key] = value;
          }
        }
        break;

      case 'financial':
        // Only allow specific financial updates by admins
        if (membership.role === 'admin') {
          const allowedFinancialFields = ['plan'];
          for (const [key, value] of Object.entries(updates)) {
            if (allowedFinancialFields.includes(key)) {
              validUpdates[key] = value;
            }
          }
        } else {
          return res.status(403).json({ error: 'Only DAO admins can modify financial settings' });
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid settings category' });
    }

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    // Apply updates
    validUpdates.updatedAt = new Date();
    
    await db.update(daos)
      .set(validUpdates)
      .where(eq(daos.id, daoId));

    res.json({ 
      success: true, 
      message: `${category} settings updated successfully`,
      updates: validUpdates 
    });
  } catch (error: any) {
    console.error('Error updating DAO settings:', error);
    res.status(500).json({ error: error.message || 'Failed to update DAO settings' });
  }
}

// Reset invite code
export async function resetInviteCodeHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { daoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin permissions
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      )
    });

    if (!membership || !['admin', 'elder'].includes(membership.role || '')) {
      return res.status(403).json({ error: 'Admin permissions required' });
    }

    const newInviteCode = generateInviteCode();
    
    await db.update(daos)
      .set({ 
        inviteCode: newInviteCode,
        updatedAt: new Date()
      })
      .where(eq(daos.id, daoId));

    res.json({ 
      success: true, 
      inviteCode: newInviteCode,
      message: 'Invite code reset successfully' 
    });
  } catch (error: any) {
    console.error('Error resetting invite code:', error);
    res.status(500).json({ error: error.message || 'Failed to reset invite code' });
  }
}

// Get DAO analytics for settings
export async function getDaoAnalyticsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { daoId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has view permissions
    const membership = await db.query.daoMemberships.findFirst({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.userId, userId),
        eq(daoMemberships.status, 'approved')
      )
    });

    if (!membership) {
      return res.status(403).json({ error: 'DAO membership required' });
    }

    // Get basic DAO analytics
    const dao = await db.query.daos.findFirst({
      where: eq(daos.id, daoId)
    });

    if (!dao) {
      return res.status(404).json({ error: 'DAO not found' });
    }

    // Get member statistics
    const memberStats = await db.query.daoMemberships.findMany({
      where: and(
        eq(daoMemberships.daoId, daoId),
        eq(daoMemberships.status, 'approved')
      )
    });

    const roleDistribution = memberStats.reduce((acc: any, member) => {
      const role = member.role || 'member';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    // Get proposal statistics
    const proposalStats = await db.query.proposals.findMany({
      where: eq(proposals.daoId, daoId)
    });

    const proposalsByStatus = proposalStats.reduce((acc: any, proposal) => {
      acc[proposal.status] = (acc[proposal.status] || 0) + 1;
      return acc;
    }, {});

    const analytics = {
      dao: {
        name: dao.name,
        createdAt: dao.createdAt,
        memberCount: dao.memberCount,
        treasuryBalance: dao.treasuryBalance,
        plan: dao.plan
      },
      members: {
        total: memberStats.length,
        roleDistribution,
        recentJoins: memberStats.filter(m => 
          new Date(m.joinedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
        ).length
      },
      proposals: {
        total: proposalStats.length,
        statusDistribution: proposalsByStatus,
        recentProposals: proposalStats.filter(p => 
          new Date(p.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
        ).length
      }
    };

    res.json({ analytics });
  } catch (error: any) {
    console.error('Error fetching DAO analytics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch DAO analytics' });
  }
}

// Helper function to generate invite codes
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
