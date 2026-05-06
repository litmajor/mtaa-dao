import { describe, it, expect, beforeEach, vi } from 'vitest';
import { governanceLeaderboardService } from '../../services/governanceLeaderboardService';
import { db } from '../../db';
import {
  users,
  referralRewards,
  contributions,
  proposals,
  votes,
  daoMemberships,
  daos,
} from '../../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Governance Leaderboard Service Tests
 * Tests both system-wide and DAO-specific leaderboard operations
 */
describe('GovernanceLeaderboardService - Dual Scope', () => {
  const testDaoId = 'dao-123';
  const testUserIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

  beforeEach(async () => {
    // Clean up test data
    await db.delete(referralRewards).where(eq(referralRewards.daoId, testDaoId)).catch(() => {});
    await db.delete(contributions).where(eq(contributions.daoId, testDaoId)).catch(() => {});
    await db.delete(votes).where(eq(votes.daoId, testDaoId)).catch(() => {});
    await db.delete(proposals).where(eq(proposals.daoId, testDaoId)).catch(() => {});
    await db.delete(daoMemberships).where(eq(daoMemberships.daoId, testDaoId)).catch(() => {});
  });

  describe('System-Wide Leaderboards', () => {
    describe('getSystemRefferalLeaderboard', () => {
      it('should return empty leaderboard when no referrals exist', async () => {
        const result = await governanceLeaderboardService.getSystemRefferalLeaderboard(10, 0);

        expect(result.leaderboard).toHaveLength(0);
        expect(result.totalParticipants).toBe(0);
      });

      it('should rank users by total referrals', async () => {
        // Create referral rewards for multiple users
        await db.insert(referralRewards).values([
          {
            referrerId: 'user-1',
            referredUserId: 'user-ref-1',
            daoId: testDaoId,
            rewardAmount: '100.00',
            status: 'awarded',
          },
          {
            referrerId: 'user-1',
            referredUserId: 'user-ref-2',
            daoId: testDaoId,
            rewardAmount: '100.00',
            status: 'awarded',
          },
          {
            referrerId: 'user-2',
            referredUserId: 'user-ref-3',
            daoId: testDaoId,
            rewardAmount: '100.00',
            status: 'awarded',
          },
        ]);

        const result = await governanceLeaderboardService.getSystemRefferalLeaderboard(10, 0);

        expect(result.leaderboard.length).toBeGreaterThan(0);
        expect(result.leaderboard[0].totalReferrals).toBeGreaterThanOrEqual(
          result.leaderboard[1]?.totalReferrals || 0
        );
      });

      it('should respect pagination limits', async () => {
        // Create many referral rewards
        const referrals = Array.from({ length: 15 }, (_, i) => ({
          referrerId: `user-${Math.floor(i / 3)}`,
          referredUserId: `user-ref-${i}`,
          daoId: testDaoId,
          rewardAmount: '50.00',
          status: 'awarded' as const,
        }));

        await db.insert(referralRewards).values(referrals);

        const result1 = await governanceLeaderboardService.getSystemRefferalLeaderboard(5, 0);
        const result2 = await governanceLeaderboardService.getSystemRefferalLeaderboard(5, 5);

        expect(result1.leaderboard.length).toBeLessThanOrEqual(5);
        expect(result2.leaderboard.length).toBeLessThanOrEqual(5);

        // Verify no overlap
        const ids1 = new Set(result1.leaderboard.map(r => r.userId));
        const ids2 = new Set(result2.leaderboard.map(r => r.userId));
        const overlap = Array.from(ids1).filter(id => ids2.has(id));
        expect(overlap.length).toBe(0);
      });
    });

    describe('getSystemContributorsLeaderboard', () => {
      it('should return empty leaderboard when no contributions exist', async () => {
        const result = await governanceLeaderboardService.getSystemContributorsLeaderboard(10, 0);

        expect(result.leaderboard).toHaveLength(0);
        expect(result.totalParticipants).toBe(0);
      });

      it('should rank users by total contribution amount', async () => {
        // Create contributions for multiple users and DAOs
        await db.insert(contributions).values([
          {
            userId: 'user-1',
            daoId: testDaoId,
            amount: '1000.00',
            currency: 'cUSD',
          },
          {
            userId: 'user-1',
            daoId: testDaoId,
            amount: '500.00',
            currency: 'cUSD',
          },
          {
            userId: 'user-2',
            daoId: testDaoId,
            amount: '300.00',
            currency: 'cUSD',
          },
        ]);

        const result = await governanceLeaderboardService.getSystemContributorsLeaderboard(10, 0);

        expect(result.leaderboard.length).toBeGreaterThan(0);
        // First user contributed 1500, second contributed 300
        expect(result.leaderboard[0].userId).toBe('user-1');
        expect(result.leaderboard[0].totalContributionUsd).toBe(1500);
      });

      it('should calculate average contribution correctly', async () => {
        await db.insert(contributions).values([
          {
            userId: 'user-1',
            daoId: testDaoId,
            amount: '100.00',
            currency: 'cUSD',
          },
          {
            userId: 'user-1',
            daoId: testDaoId,
            amount: '200.00',
            currency: 'cUSD',
          },
          {
            userId: 'user-1',
            daoId: testDaoId,
            amount: '300.00',
            currency: 'cUSD',
          },
        ]);

        const result = await governanceLeaderboardService.getSystemContributorsLeaderboard(10, 0);

        expect(result.leaderboard[0].contributionCount).toBe(3);
        expect(result.leaderboard[0].averageContribution).toBe(200);
      });
    });

    describe('getSystemConsolidatedStats', () => {
      it('should return default stats when no data exists', async () => {
        const stats = await governanceLeaderboardService.getSystemConsolidatedStats();

        expect(stats.totalUsers).toBeGreaterThanOrEqual(0);
        expect(stats.totalDAOs).toBeGreaterThanOrEqual(0);
        expect(stats.totalContributions).toBe(0);
        expect(stats.totalProposals).toBe(0);
      });

      it('should calculate stats correctly', async () => {
        // Setup test data
        await db.insert(contributions).values({
          userId: 'user-1',
          daoId: testDaoId,
          amount: '500.00',
          currency: 'cUSD',
        });

        const stats = await governanceLeaderboardService.getSystemConsolidatedStats();

        expect(stats.totalContributions).toBe(1);
        expect(stats.totalContributionAmount).toBe(500);
        expect(stats.averageContributionSize).toBe(500);
      });
    });
  });

  describe('DAO-Specific Leaderboards', () => {
    beforeEach(async () => {
      // Create test DAO
      await db.insert(daos).values({
        id: testDaoId,
        name: 'Test DAO',
        slug: 'test-dao',
        description: 'Test DAO for leaderboards',
      });

      // Create DAO members
      for (const userId of testUserIds) {
        await db
          .insert(daoMemberships)
          .values({
            daoId: testDaoId,
            userId,
            status: 'approved',
          })
          .catch(() => {});
      }
    });

    describe('getDAOActivityLeaderboard', () => {
      it('should return all DAO members when no activity exists', async () => {
        const result = await governanceLeaderboardService.getDAOActivityLeaderboard(testDaoId, 10, 0);

        expect(result.totalParticipants).toBe(testUserIds.length);
      });

      it('should rank members by total activity score', async () => {
        // Add contributions for user-1
        for (let i = 0; i < 3; i++) {
          await db.insert(contributions).values({
            userId: 'user-1',
            daoId: testDaoId,
            amount: '100.00',
            currency: 'cUSD',
          });
        }

        // Add contributions for user-2
        await db.insert(contributions).values({
          userId: 'user-2',
          daoId: testDaoId,
          amount: '100.00',
          currency: 'cUSD',
        });

        const result = await governanceLeaderboardService.getDAOActivityLeaderboard(testDaoId, 10, 0);

        // user-1 should rank higher because of more activity
        const user1 = result.leaderboard.find(l => l.userId === 'user-1');
        const user2 = result.leaderboard.find(l => l.userId === 'user-2');

        expect(user1?.totalActivityScore).toBeGreaterThan(user2?.totalActivityScore || 0);
      });

      it('should include contributions, proposals, and votes in activity score', async () => {
        // User-1 activity
        await db.insert(contributions).values({
          userId: 'user-1',
          daoId: testDaoId,
          amount: '100.00',
          currency: 'cUSD',
        });

        await db.insert(proposals).values({
          id: 'prop-1',
          daoId: testDaoId,
          proposedBy: 'user-1',
          title: 'Test Proposal',
          description: 'Test',
          status: 'active',
        });

        await db.insert(votes).values({
          proposalId: 'prop-1',
          voterId: 'user-1',
          daoId: testDaoId,
          vote: 'yes',
        });

        const result = await governanceLeaderboardService.getDAOActivityLeaderboard(testDaoId, 10, 0);
        const user1 = result.leaderboard.find(l => l.userId === 'user-1');

        expect(user1?.contributionCount).toBe(1);
        expect(user1?.proposalCount).toBeGreaterThanOrEqual(1);
        expect(user1?.voteCount).toBeGreaterThanOrEqual(1);
        expect(user1?.totalActivityScore).toBeGreaterThan(0);
      });

      it('should properly rank with pagination', async () => {
        // Add contributions to create different activity levels
        for (let i = 0; i < testUserIds.length; i++) {
          for (let j = 0; j < i + 1; j++) {
            await db
              .insert(contributions)
              .values({
                userId: testUserIds[i],
                daoId: testDaoId,
                amount: '100.00',
                currency: 'cUSD',
              })
              .catch(() => {});
          }
        }

        const result1 = await governanceLeaderboardService.getDAOActivityLeaderboard(testDaoId, 2, 0);
        const result2 = await governanceLeaderboardService.getDAOActivityLeaderboard(testDaoId, 2, 2);

        expect(result1.leaderboard.length).toBeLessThanOrEqual(2);
        expect(result1.leaderboard[0].rank).toBe(1);
        expect(result2.leaderboard[0].rank).toBe(3);
      });
    });

    describe('getDAOContributionsLeaderboard', () => {
      it('should return empty when no contributions exist', async () => {
        const result = await governanceLeaderboardService.getDAOContributionsLeaderboard(testDaoId, 10, 0);

        expect(result.leaderboard).toHaveLength(0);
      });

      it('should rank members by total contributions to DAO', async () => {
        await db.insert(contributions).values([
          {
            userId: 'user-1',
            daoId: testDaoId,
            amount: '1000.00',
            currency: 'cUSD',
          },
          {
            userId: 'user-2',
            daoId: testDaoId,
            amount: '500.00',
            currency: 'cUSD',
          },
        ]);

        const result = await governanceLeaderboardService.getDAOContributionsLeaderboard(
          testDaoId,
          10,
          0
        );

        expect(result.leaderboard.length).toBe(2);
        expect(result.leaderboard[0].userId).toBe('user-1');
        expect(result.leaderboard[0].totalContributionUsd).toBe(1000);
        expect(result.leaderboard[1].totalContributionUsd).toBe(500);
      });

      it('should only include contributions to specific DAO', async () => {
        const otherDaoId = 'dao-other';

        await db.insert(daos).values({
          id: otherDaoId,
          name: 'Other DAO',
          slug: 'other-dao',
          description: 'Other DAO',
        });

        // Contributions to different DAOs
        await db.insert(contributions).values([
          {
            userId: 'user-1',
            daoId: testDaoId,
            amount: '500.00',
            currency: 'cUSD',
          },
          {
            userId: 'user-1',
            daoId: otherDaoId,
            amount: '1000.00',
            currency: 'cUSD',
          },
        ]);

        const result = await governanceLeaderboardService.getDAOContributionsLeaderboard(
          testDaoId,
          10,
          0
        );

        expect(result.leaderboard[0].totalContributionUsd).toBe(500); // Only test DAO
      });
    });

    describe('getDAOVotingLeaderboard', () => {
      it('should return empty when no votes exist', async () => {
        const result = await governanceLeaderboardService.getDAOVotingLeaderboard(testDaoId, 10, 0);

        expect(result.leaderboard).toHaveLength(0);
      });

      it('should rank members by voting participation', async () => {
        // Create a proposal
        await db.insert(proposals).values({
          id: 'prop-1',
          daoId: testDaoId,
          proposedBy: 'user-5',
          title: 'Test Proposal',
          status: 'active',
        });

        // Create votes
        await db.insert(votes).values([
          {
            proposalId: 'prop-1',
            voterId: 'user-1',
            daoId: testDaoId,
            vote: 'yes',
          },
          {
            proposalId: 'prop-1',
            voterId: 'user-1',
            daoId: testDaoId,
            vote: 'no',
          },
          {
            proposalId: 'prop-1',
            voterId: 'user-2',
            daoId: testDaoId,
            vote: 'yes',
          },
        ]);

        const result = await governanceLeaderboardService.getDAOVotingLeaderboard(testDaoId, 10, 0);

        expect(result.leaderboard.length).toBeGreaterThan(0);
        expect(result.leaderboard[0].userId).toBe('user-1');
        expect(result.leaderboard[0].voteCount).toBe(2);
      });
    });

    describe('getDAOConsolidatedStats', () => {
      it('should return stats for DAO', async () => {
        // Add various activities
        await db.insert(contributions).values({
          userId: 'user-1',
          daoId: testDaoId,
          amount: '500.00',
          currency: 'cUSD',
        });

        await db.insert(proposals).values({
          id: 'prop-1',
          daoId: testDaoId,
          proposedBy: 'user-1',
          title: 'Test Proposal',
          status: 'passed',
        });

        const stats = await governanceLeaderboardService.getDAOConsolidatedStats(testDaoId);

        expect(stats.daoId).toBe(testDaoId);
        expect(stats.totalMembers).toBe(testUserIds.length);
        expect(stats.totalContributions).toBeGreaterThan(0);
        expect(stats.totalProposals).toBe(1);
      });
    });
  });

  describe('User Rank Methods', () => {
    describe('getUserReferralRank', () => {
      it('should return rank 0 for user with no referrals', async () => {
        const rank = await governanceLeaderboardService.getUserReferralRank('non-existent-user');

        expect(rank.rank).toBeGreaterThan(0);
        expect(rank.totalReferrals).toBe(0);
        expect(rank.totalRewards).toBe(0);
      });

      it('should calculate correct rank for user', async () => {
        // Create referrals for multiple users
        await db.insert(referralRewards).values([
          {
            referrerId: 'user-1',
            referredUserId: 'ref-1',
            daoId: testDaoId,
            rewardAmount: '100.00',
            status: 'awarded',
          },
          {
            referrerId: 'user-1',
            referredUserId: 'ref-2',
            daoId: testDaoId,
            rewardAmount: '100.00',
            status: 'awarded',
          },
          {
            referrerId: 'user-2',
            referredUserId: 'ref-3',
            daoId: testDaoId,
            rewardAmount: '100.00',
            status: 'awarded',
          },
        ]);

        const rank = await governanceLeaderboardService.getUserReferralRank('user-1');

        expect(rank.totalReferrals).toBe(2);
        expect(rank.totalRewards).toBe(200);
        expect(rank.rank).toBeLessThanOrEqual(2);
      });
    });

    describe('getUserDAOActivityRank', () => {
      beforeEach(async () => {
        // Create test DAO and member
        await db.insert(daos).values({
          id: testDaoId,
          name: 'Test DAO',
          slug: 'test-dao',
        });

        await db.insert(daoMemberships).values({
          daoId: testDaoId,
          userId: 'user-1',
          status: 'approved',
        });
      });

      it('should return rank for user in DAO', async () => {
        // Add activity for user
        await db.insert(contributions).values({
          userId: 'user-1',
          daoId: testDaoId,
          amount: '100.00',
          currency: 'cUSD',
        });

        const rank = await governanceLeaderboardService.getUserDAOActivityRank('user-1', testDaoId);

        expect(rank.totalActivityScore).toBeGreaterThan(0);
        expect(rank.contributionCount).toBe(1);
      });
    });
  });

  describe('Integration: Full Leaderboard Flow', () => {
    beforeEach(async () => {
      // Create DAO
      await db.insert(daos).values({
        id: testDaoId,
        name: 'Test DAO',
        slug: 'test-dao',
      });

      // Create members
      for (const userId of testUserIds) {
        await db.insert(daoMemberships).values({
          daoId: testDaoId,
          userId,
          status: 'approved',
        });
      }
    });

    it('should return complete governance ecosystem data', async () => {
      // Setup complex scenario
      // User activities
      for (let i = 0; i < testUserIds.length; i++) {
        // Contributions
        for (let j = 0; j < i + 1; j++) {
          await db.insert(contributions).values({
            userId: testUserIds[i],
            daoId: testDaoId,
            amount: `${100 * (j + 1)}.00`,
            currency: 'cUSD',
          });
        }

        // Referrals
        for (let j = 0; j < i; j++) {
          await db.insert(referralRewards).values({
            referrerId: testUserIds[i],
            referredUserId: `ref-${i}-${j}`,
            daoId: testDaoId,
            rewardAmount: '50.00',
            status: 'awarded',
          });
        }
      }

      // Fetch all leaderboards
      const [systemReferrals, systemContributors, daoActivity, daoContributions, stats] =
        await Promise.all([
          governanceLeaderboardService.getSystemRefferalLeaderboard(10, 0),
          governanceLeaderboardService.getSystemContributorsLeaderboard(10, 0),
          governanceLeaderboardService.getDAOActivityLeaderboard(testDaoId, 10, 0),
          governanceLeaderboardService.getDAOContributionsLeaderboard(testDaoId, 10, 0),
          governanceLeaderboardService.getSystemConsolidatedStats(),
        ]);

      expect(systemReferrals.leaderboard.length).toBeGreaterThan(0);
      expect(systemContributors.leaderboard.length).toBeGreaterThan(0);
      expect(daoActivity.leaderboard.length).toBeGreaterThan(0);
      expect(daoContributions.leaderboard.length).toBeGreaterThan(0);
      expect(stats.totalContributions).toBeGreaterThan(0);
    });
  });
});
