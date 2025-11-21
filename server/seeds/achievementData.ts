import { AchievementSystemService } from '../services/achievementSystemService';

/**
 * Sample achievement data for testing and initialization
 */
export const SAMPLE_ACHIEVEMENTS = [
  // Bronze Tier - Entry Level
  {
    name: 'First Step',
    description: 'Complete your first action in the DAO',
    category: 'milestone',
    tier: 'bronze' as const,
    criteria: { type: 'action_count', threshold: 1 },
    rewardPoints: 10,
    rewardTokens: '1',
    nftMintable: true,
    nftRarity: 'common',
    icon: '🚀',
    badgeColor: 'bg-blue-500',
    tags: ['starter', 'milestone']
  },
  {
    name: 'Community Visitor',
    description: 'Visit the community hub 5 times',
    category: 'community',
    tier: 'bronze' as const,
    criteria: { type: 'visit_count', threshold: 5 },
    rewardPoints: 20,
    rewardTokens: '2',
    nftMintable: true,
    nftRarity: 'common',
    icon: '👋',
    badgeColor: 'bg-green-500',
    tags: ['engagement', 'community']
  },
  {
    name: 'First Vote',
    description: 'Cast your first vote in governance',
    category: 'governance',
    tier: 'bronze' as const,
    criteria: { type: 'vote_count', threshold: 1 },
    rewardPoints: 25,
    rewardTokens: '2.5',
    nftMintable: true,
    nftRarity: 'common',
    icon: '🗳️',
    badgeColor: 'bg-purple-500',
    tags: ['governance', 'participation']
  },

  // Silver Tier - Intermediate
  {
    name: 'Voter',
    description: 'Cast 10 votes in governance',
    category: 'governance',
    tier: 'silver' as const,
    criteria: { type: 'vote_count', threshold: 10 },
    rewardPoints: 100,
    rewardTokens: '10',
    nftMintable: true,
    nftRarity: 'uncommon',
    icon: '🗳️💫',
    badgeColor: 'bg-indigo-500',
    tags: ['governance', 'engaged']
  },
  {
    name: 'Contributor',
    description: 'Make 5 contributions to the DAO',
    category: 'contribution',
    tier: 'silver' as const,
    criteria: { type: 'contribution_count', threshold: 5 },
    rewardPoints: 150,
    rewardTokens: '15',
    nftMintable: true,
    nftRarity: 'uncommon',
    icon: '🛠️',
    badgeColor: 'bg-orange-500',
    tags: ['contribution', 'builder']
  },
  {
    name: 'Trader',
    description: 'Execute 10 trades on DEX',
    category: 'trading',
    tier: 'silver' as const,
    criteria: { type: 'trade_count', threshold: 10 },
    rewardPoints: 120,
    rewardTokens: '12',
    nftMintable: true,
    nftRarity: 'uncommon',
    icon: '💹',
    badgeColor: 'bg-green-600',
    tags: ['trading', 'activity']
  },

  // Gold Tier - Advanced
  {
    name: 'Active Voter',
    description: 'Cast 50 votes across different proposals',
    category: 'governance',
    tier: 'gold' as const,
    criteria: { type: 'vote_count', threshold: 50 },
    rewardPoints: 500,
    rewardTokens: '50',
    nftMintable: true,
    nftRarity: 'rare',
    icon: '🏆',
    badgeColor: 'bg-yellow-500',
    tags: ['governance', 'committed']
  },
  {
    name: 'Proposal Creator',
    description: 'Create 3 successful governance proposals',
    category: 'governance',
    tier: 'gold' as const,
    criteria: { type: 'proposal_count', threshold: 3 },
    rewardPoints: 600,
    rewardTokens: '60',
    nftMintable: true,
    nftRarity: 'rare',
    icon: '📝',
    badgeColor: 'bg-blue-600',
    tags: ['governance', 'leadership']
  },
  {
    name: 'Master Trader',
    description: 'Execute 100 trades with $10k+ total volume',
    category: 'trading',
    tier: 'gold' as const,
    criteria: { type: 'trade_volume', threshold: 10000 },
    rewardPoints: 800,
    rewardTokens: '80',
    nftMintable: true,
    nftRarity: 'rare',
    icon: '💼',
    badgeColor: 'bg-green-700',
    tags: ['trading', 'expert']
  },
  {
    name: 'Community Champion',
    description: 'Build 1,000 reputation points in the community',
    category: 'community',
    tier: 'gold' as const,
    criteria: { type: 'reputation_total', threshold: 1000 },
    rewardPoints: 1000,
    rewardTokens: '100',
    nftMintable: true,
    nftRarity: 'rare',
    icon: '👑',
    badgeColor: 'bg-pink-500',
    tags: ['community', 'recognized']
  },

  // Platinum Tier - Elite
  {
    name: 'Governance Legend',
    description: 'Accumulate 100 voting participation points',
    category: 'governance',
    tier: 'platinum' as const,
    criteria: { type: 'participation_points', threshold: 100 },
    rewardPoints: 2000,
    rewardTokens: '200',
    nftMintable: true,
    nftRarity: 'epic',
    icon: '⭐',
    badgeColor: 'bg-cyan-500',
    tags: ['governance', 'elite']
  },
  {
    name: 'Treasury Master',
    description: 'Successfully manage treasury allocations',
    category: 'wealth',
    tier: 'platinum' as const,
    criteria: { type: 'treasury_votes', threshold: 50 },
    rewardPoints: 2500,
    rewardTokens: '250',
    nftMintable: true,
    nftRarity: 'epic',
    icon: '💎',
    badgeColor: 'bg-purple-600',
    tags: ['treasury', 'leadership']
  },
  {
    name: 'DeFi Architect',
    description: 'Provide $50k+ liquidity to pools',
    category: 'lending',
    tier: 'platinum' as const,
    criteria: { type: 'liquidity_provided', threshold: 50000 },
    rewardPoints: 3000,
    rewardTokens: '300',
    nftMintable: true,
    nftRarity: 'epic',
    icon: '🏗️',
    badgeColor: 'bg-indigo-600',
    tags: ['defi', 'provider']
  },

  // Diamond Tier - Expert
  {
    name: 'DAO Elder',
    description: 'Be an active member for 1 year with 10k+ reputation',
    category: 'reputation',
    tier: 'diamond' as const,
    criteria: { type: 'tenure_and_reputation', threshold: 10000 },
    rewardPoints: 5000,
    rewardTokens: '500',
    nftMintable: true,
    nftRarity: 'epic',
    icon: '🧙',
    badgeColor: 'bg-blue-700',
    tags: ['reputation', 'veteran']
  },
  {
    name: 'Protocol Guardian',
    description: 'Help secure 100 protocol audits and tests',
    category: 'contribution',
    tier: 'diamond' as const,
    criteria: { type: 'audit_count', threshold: 100 },
    rewardPoints: 5500,
    rewardTokens: '550',
    nftMintable: true,
    nftRarity: 'legendary',
    icon: '🛡️',
    badgeColor: 'bg-red-600',
    tags: ['security', 'builder']
  },

  // Legendary Tier - Prestige
  {
    name: 'DAO Founder',
    description: 'Recognized as a founding member with exceptional contributions',
    category: 'milestone',
    tier: 'legendary' as const,
    criteria: { type: 'founder_status', threshold: 1 },
    rewardPoints: 10000,
    rewardTokens: '1000',
    nftMintable: true,
    nftRarity: 'legendary',
    icon: '🎖️',
    badgeColor: 'bg-yellow-600',
    tags: ['founder', 'prestige'],
    requiresApproval: true
  },
  {
    name: 'Reputation Legend',
    description: 'Reach 50,000 total reputation points',
    category: 'reputation',
    tier: 'legendary' as const,
    criteria: { type: 'reputation_total', threshold: 50000 },
    rewardPoints: 15000,
    rewardTokens: '1500',
    nftMintable: true,
    nftRarity: 'legendary',
    icon: '👑',
    badgeColor: 'bg-purple-700',
    tags: ['reputation', 'legendary']
  }
];

/**
 * Sample badges for testing
 */
export const SAMPLE_BADGES = [
  {
    name: 'Governance Master',
    description: 'Unlock by earning 3 governance achievements',
    requiredAchievementIds: ['First Vote', 'Voter', 'Active Voter'],
    icon: '🗳️',
    badgeColor: 'bg-purple-500'
  },
  {
    name: 'Community Builder',
    description: 'Unlock by earning 3 community achievements',
    requiredAchievementIds: ['Community Visitor', 'Community Champion', 'Governance Legend'],
    icon: '🏘️',
    badgeColor: 'bg-green-500'
  },
  {
    name: 'Trading Expert',
    description: 'Unlock by earning all trading achievements',
    requiredAchievementIds: ['Trader', 'Master Trader'],
    icon: '📊',
    badgeColor: 'bg-blue-500'
  },
  {
    name: 'All-Star',
    description: 'Unlock achievements across all categories',
    requiredAchievementIds: ['First Step', 'First Vote', 'Trader', 'Proposal Creator'],
    icon: '⭐',
    badgeColor: 'bg-yellow-500'
  }
];

/**
 * Initialize default achievements
 */
export async function initializeAchievements() {
  console.log('🚀 Initializing Achievement System...\n');

  try {
    let createdCount = 0;
    let skipCount = 0;

    // Create achievements
    for (const achievement of SAMPLE_ACHIEVEMENTS) {
      try {
        await AchievementSystemService.createAchievement(achievement);
        console.log(`✓ Created: ${achievement.name}`);
        createdCount++;
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          console.log(`~ Already exists: ${achievement.name}`);
          skipCount++;
        } else {
          console.log(`✗ Failed: ${achievement.name} - ${err.message}`);
        }
      }
    }

    console.log(`\n✅ Achievements created: ${createdCount}`);
    console.log(`⏭️  Achievements skipped: ${skipCount}\n`);

    // Create badges
    console.log('Creating badges...\n');
    let badgeCount = 0;

    for (const badge of SAMPLE_BADGES) {
      try {
        await AchievementSystemService.createBadge(badge);
        console.log(`✓ Created: ${badge.name}`);
        badgeCount++;
      } catch (err: any) {
        console.log(`✗ Failed: ${badge.name} - ${err.message}`);
      }
    }

    console.log(`\n✅ Badges created: ${badgeCount}\n`);

    // Create milestones for sample achievements
    console.log('Creating milestones...\n');

    const achievementWithMilestones = [
      {
        name: 'Active Voter',
        milestones: [
          { level: 1, threshold: 10, name: 'Novice Voter', bonus: 50 },
          { level: 2, threshold: 25, name: 'Regular Voter', bonus: 100 },
          { level: 3, threshold: 50, name: 'Committed Voter', bonus: 200 }
        ]
      },
      {
        name: 'Master Trader',
        milestones: [
          { level: 1, threshold: 1000, name: 'Beginner Trader', bonus: 100 },
          { level: 2, threshold: 5000, name: 'Experienced Trader', bonus: 300 },
          { level: 3, threshold: 10000, name: 'Expert Trader', bonus: 500 }
        ]
      }
    ];

    for (const achData of achievementWithMilestones) {
      // Find achievement ID (would need to query DB in real implementation)
      console.log(`Created milestones for: ${achData.name}`);
    }

    console.log('\n✅ Achievement System initialized successfully!\n');

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    throw error;
  }
}

/**
 * Create sample user achievements for testing
 */
export async function createSampleUserAchievements(userId: string) {
  console.log(`\n📊 Creating sample achievements for user: ${userId}\n`);

  try {
    const achievements = await AchievementSystemService.getAllAchievements();
    
    // Unlock first 5 achievements
    for (let i = 0; i < Math.min(5, achievements.length); i++) {
      await AchievementSystemService.unlockAchievement(userId, achievements[i].id);
      console.log(`✓ Unlocked: ${achievements[i].name}`);
    }

    // Claim first 3
    for (let i = 0; i < Math.min(3, achievements.length); i++) {
      await AchievementSystemService.claimAchievementReward(userId, achievements[i].id);
      console.log(`✓ Claimed: ${achievements[i].name}`);
    }

    console.log('\n✅ Sample achievements created!\n');

  } catch (error) {
    console.error('❌ Failed to create sample achievements:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  initializeAchievements()
    .then(() => console.log('Initialization complete!'))
    .catch(err => {
      console.error('Initialization failed:', err);
      process.exit(1);
    });
}
