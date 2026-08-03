import { describe, expect, it } from 'vitest';
import { PerformanceTracker } from '../core/elders/kaizen/performance-tracker';
import { OptimizationEngine } from '../core/elders/kaizen/optimization-engine';

describe('PerformanceTracker scoring', () => {
  it('uses the community growth metric from analyzer output instead of defaulting to a neutral score', () => {
    const tracker = new PerformanceTracker();
    const analysis = {
      metrics: {
        engagementScore: 0.8,
        retentionRate: 0.7,
        communityGrowthRate: 0.2,
        totalMembers: 100,
        activeMembers: 50,
      },
    } as any;

    const result = (tracker as any).extractCommunityMetrics(analysis);

    expect(result.communityHealth).toBeGreaterThan(70);
    expect(result.communityHealth).toBeLessThanOrEqual(100);
  });

  it('returns a neutral governance score when there is no governance activity data yet', () => {
    const tracker = new PerformanceTracker();
    const analysis = {
      metrics: {
        avgParticipationRate: 0,
        proposalSuccessRate: 0,
        avgQuorum: 0,
        delegatedVotes: 0,
        uniqueVoters: 0,
        totalProposals: 0,
      },
    } as any;

    const result = (tracker as any).extractGovernanceMetrics(analysis);

    expect(result.governanceHealth).toBe(50);
  });

  it('does not produce maximum confidence for low data quality across DAO metrics', () => {
    const optimizationEngine = new OptimizationEngine();
    const metrics = {
      scores: {
        overall: 50,
        treasury: 50,
        governance: 50,
        community: 50,
        system: 50
      },
      treasury: {
        balance: 0,
        burnRate: 0,
        runway: 0
      },
      governance: {
        participationRate: 0,
        proposalSuccessRate: 0,
        quorumMet: 0
      },
      community: {
        engagementScore: 0,
        retentionRate: 0
      },
      system: {
        responseTime: 1200,
        errorRate: 10,
        uptime: 50,
        resourceUtilization: 0
      },
      dao: {
        memberCount: 0,
        activeMemberCount: 0
      },
      wallet: {
        securityScore: 0
      }
    } as any;

    const confidenceScore = optimizationEngine['calculateConfidenceScore'](metrics, 1);

    expect(confidenceScore).toBeGreaterThanOrEqual(10);
    expect(confidenceScore).toBeLessThan(70);
  });

  it('low data quality yields a conservative confidence score even with some system score', () => {
    const optimizationEngine = new OptimizationEngine();
    const metrics = {
      scores: {
        overall: 60,
        treasury: 60,
        governance: 60,
        community: 60,
        system: 60
      },
      treasury: {
        balance: 100,
        burnRate: 0,
        runway: 5
      },
      governance: {
        participationRate: 10,
        proposalSuccessRate: 5,
        quorumMet: 15
      },
      community: {
        engagementScore: 5,
        retentionRate: 10
      },
      system: {
        responseTime: 800,
        errorRate: 5,
        uptime: 50,
        resourceUtilization: 0
      },
      dao: {
        memberCount: 2,
        activeMemberCount: 1
      },
      wallet: {
        securityScore: 10
      }
    } as any;

    const confidenceScore = optimizationEngine['calculateConfidenceScore'](metrics, 2);

    expect(confidenceScore).toBeLessThan(70);
    expect(confidenceScore).toBeGreaterThanOrEqual(10);
  });
});
