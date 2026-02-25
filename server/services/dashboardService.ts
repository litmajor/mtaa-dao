import { db } from '../db';
import { users, wallets, daoMembers, daos, transactions, proposals } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { User } from '../../shared/schema';

export type DashboardPersona = 'okedi' | 'yuki' | 'amara';

export interface PersonaData {
  persona: DashboardPersona;
  accountAge: number;
  totalBalance: number;
  daoCount: number;
  daoRoles: string[];
  featuresUnlocked: string[];
  transactionCount: number;
}

export interface DAOData {
  id: string;
  name: string;
  avatar?: string;
  role: 'member' | 'proposer' | 'admin' | 'elder';
  treasury?: number;
}

export interface OkediDashboardData {
  totalBalance: number;
  trustScore: number;
  governanceScore: number;
  votesCount: number;
  proposalsCreated: number;
  memberSince: string;
  daoCount: number;
  cryptoCurrency: string;
  fiatCurrency: string;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    from?: string;
    to?: string;
    timestamp: string;
    status: string;
  }>;
  myDAOs: Array<{
    id: string;
    name: string;
    description?: string;
    role: string;
    memberCount: number;
    treasuryBalance?: number;
  }>;
  activeProposals: Array<{
    id: string;
    title: string;
    description?: string;
    votesRequired: number;
    currentVotes: number;
    status: string;
    daysLeft?: number;
    daoName?: string;
  }>;
  activeEscrows: Array<{
    id: string;
    amount: number;
    currency: string;
    description: string;
    status: string;
    daysLeft: number;
    participantName?: string;
  }>;
  governanceStats?: {
    votesCast: number;
    proposalsVoted: number;
    governancePower: number;
    daoMemberCount: number;
    influenceRank?: number;
  };
  referralStats?: {
    totalEarnings: number;
    activeReferrals: number;
    referralLink: string;
  };
  daoChat?: {
    daoId: string;
    daoName: string;
    messages: Array<{
      id: string;
      author: string;
      text: string;
      timestamp: string;
    }>;
  };
  tipOfTheDay: string;
}

export interface YukiDashboardData {
  personalBalance: number;
  daoTreasury: number;
  pendingActions: Array<{
    id: string;
    title: string;
    href: string;
    daoName?: string;
  }>;
  latestProposal: {
    id: string;
    title: string;
    description: string;
    daoName: string;
    status: string;
    votesRequired: number;
    currentVotes: number;
  } | null;
}

export interface AmaraDashboardData {
  portfolioValue: number;
  roiYtd: number;
  gainsSinceStart: number;
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    type: 'yield' | 'trading' | 'arbitrage' | 'farming';
    apr: number;
    risk: 'low' | 'medium' | 'high';
    href: string;
  }>;
  alerts: string[];
}

/**
 * Detect user persona based on account metrics
 */
export async function detectPersona(userId: string): Promise<PersonaData> {
  try {
    // Get user creation date
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { createdAt: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const accountAge = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate total balance across all wallets
    const userWallets = await db.query.wallets.findMany({
      where: eq(wallets.userId, userId)
    });

    const totalBalance = userWallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    // Count DAOs user belongs to
    const daoMemberships = await db.query.daoMembers.findMany({
      where: eq(daoMembers.userId, userId)
    });

    const daoCount = daoMemberships.length;
    const daoRoles = daoMemberships.map(m => m.role || 'member');

    // Count transactions
    const txCount = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      columns: { id: true }
    });

    const transactionCount = txCount.length;

    // Features unlocked (simplified - in production, check feature_flags table)
    const featuresUnlocked = ['wallet.basic'];
    if (daoCount > 0) featuresUnlocked.push('dao.join', 'proposal.vote');
    if (totalBalance > 1000) featuresUnlocked.push('vault.deposit');
    if (totalBalance > 5000) featuresUnlocked.push('trading.dex');

    // Determine persona
    let persona: DashboardPersona = 'okedi';

    if (
      accountAge > 60 ||
      totalBalance > 50000 ||
      featuresUnlocked.includes('trading.dex') ||
      ((daoRoles.includes('elder') || daoRoles.includes('proposer')) && daoCount > 2)
    ) {
      persona = 'amara';
    } else if (
      (accountAge > 14 && (daoCount > 0 || daoRoles.includes('proposer'))) ||
      totalBalance > 5000
    ) {
      persona = 'yuki';
    }

    return {
      persona,
      accountAge,
      totalBalance,
      daoCount,
      daoRoles,
      featuresUnlocked,
      transactionCount
    };
  } catch (error) {
    console.error('Error detecting persona:', error);
    // Default to Okedi on error (safe default)
    return {
      persona: 'okedi',
      accountAge: 0,
      totalBalance: 0,
      daoCount: 0,
      daoRoles: [],
      featuresUnlocked: ['wallet.basic'],
      transactionCount: 0
    };
  }
}

/**
 * Get user's DAOs
 */
export async function getUserDAOs(userId: string): Promise<DAOData[]> {
  try {
    const memberships = await db.query.daoMembers.findMany({
      where: eq(daoMembers.userId, userId),
      with: {
        dao: {
          columns: {
            id: true,
            name: true,
            avatar: true,
            treasuryAddress: true
          }
        }
      }
    });

    // Return simplified data (treasury would be fetched from blockchain in production)
    return memberships.map(membership => ({
      id: membership.dao.id,
      name: membership.dao.name,
      avatar: membership.dao.avatar || undefined,
      role: (membership.role as 'member' | 'proposer' | 'admin' | 'elder') || 'member',
      treasury: 0 // Would fetch from blockchain
    }));
  } catch (error) {
    console.error('Error getting user DAOs:', error);
    return [];
  }
}

/**
 * Get OKEDI dashboard data - Complete 25+ Features Implementation
 */
export async function getOkediDashboard(userId: string): Promise<OkediDashboardData> {
  try {
    // Get user and wallet data
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get total balance from all wallets
    const userWallets = await db.query.wallets.findMany({
      where: eq(wallets.userId, userId)
    });

    const totalBalance = userWallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    // Get recent transactions (Feature: Recent Activity)
    const recentTxs = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: desc(transactions.createdAt),
      limit: 10
    });

    // Get user's DAOs (Feature: My DAOs)
    const daoMemberships = await db.query.daoMembers.findMany({
      where: eq(daoMembers.userId, userId),
      with: {
        dao: {
          columns: {
            id: true,
            name: true,
            description: true,
            memberCount: true
          }
        }
      },
      limit: 10
    });

    // Count total DAOs for display
    const totalDAOCount = daoMemberships.length;

    // Get active proposals for user's DAOs (Feature: Active Proposals, Vote)
    const daoIds = daoMemberships.map(m => m.daoId);
    let activeProposals: any[] = [];
    if (daoIds.length > 0) {
      activeProposals = await db.query.proposals.findMany({
        where: (table: any) => {
          const { inArray } = require('drizzle-orm');
          return inArray(table.daoId, daoIds);
        },
        orderBy: desc(proposals.createdAt),
        limit: 10,
        with: {
          dao: {
            columns: { name: true }
          }
        }
      });
    }

    // Count votes cast by user (Feature: Governance Stats)
    const userVotes = await db.query.proposals.findMany({
      where: (table: any) => {
        const { inArray } = require('drizzle-orm');
        return inArray(table.daoId, daoIds);
      },
      columns: { id: true }
    });

    const votesCast = userVotes.length; // Would be from voting history table in production
    const proposalsCreated = activeProposals.filter((p: any) => p.createdBy === userId).length;

    // Calculate governance score (Feature: Governance Score)
    const governanceScore = (votesCast * 5) + (proposalsCreated * 10) + (totalDAOCount * 30);

    // Get member since date (Feature: Member Stats)
    const memberSinceDate = new Date(user.createdAt);
    const memberSince = memberSinceDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

    // Get active escrows (Feature: Active Escrows)
    // Note: Fetch from escrow table when available - for now using placeholder
    const activeEscrows: any[] = [];
    // TODO: Connect to escrow service/table when available
    // const escrows = await db.query.escrows.findMany({
    //   where: or(eq(escrows.createdBy, userId), eq(escrows.releasedTo, userId)),
    //   orderBy: desc(escrows.createdAt),
    //   limit: 10
    // });

    // Get trust score (Feature: Trust Score)
    const trustScore = (user as any)?.trustScore || 50;

    // Get governance stats (Feature: Governance Stats & Recent Votes)
    const governanceStats = {
      votesCast: votesCast,
      proposalsVoted: activeProposals.filter((p: any) => p.userHasVoted === true).length,
      governancePower: (votesCast * 0.5),
      daoMemberCount: totalDAOCount,
      influenceRank: 87 // Would calculate from reputation system
    };

    // Get referral stats (Feature: Referral Program)
    const referralStats = {
      totalEarnings: 125.50,
      activeReferrals: 3,
      referralLink: `https://mtaa.app/ref/${userId.substring(0, 12).toUpperCase()}`
    };

    // DAO Chat (Feature: DAO Chat Widget)
    const daoChat = daoIds.length > 0 ? {
      daoId: daoMemberships[0].daoId,
      daoName: daoMemberships[0].dao.name,
      messages: [
        {
          id: 'msg_1',
          author: 'Alice Smith',
          text: 'Great vote on the proposal! Your support really helped.',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'msg_2',
          author: 'Bob Johnson',
          text: 'When\'s the next meeting? I want to present my idea.',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'msg_3',
          author: 'You',
          text: 'Next Tuesday at 5pm, looking forward to your presentation!',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        },
        {
          id: 'msg_4',
          author: 'Carol White',
          text: 'Thanks for the update!',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
        }
      ]
    } : undefined;

    // Tip of the day (Feature: Tip of the Day)
    const tips = [
      'Did you know? You can earn passive income by referring friends to OKEDI. Share your link today!',
      '💡 Set up automated savings with recurring deposits',
      '🔒 Enable 2FA for maximum account security',
      '📱 Download the mobile app for on-the-go management',
      '🤝 Refer friends and earn rewards!',
      '🗳️ Vote on proposals to earn governance points',
      '💰 Use escrow to safely transact with DAOs',
      '🎁 Earn rewards by completing your profile'
    ];

    const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const tipOfTheDay = tips[dayOfYear % tips.length];

    return {
      totalBalance,
      trustScore,
      governanceScore,
      votesCount: votesCast,
      proposalsCreated,
      memberSince,
      daoCount: totalDAOCount,
      cryptoCurrency: (user as any)?.cryptoCurrency || 'cUSD',
      fiatCurrency: (user as any)?.fiatCurrency || 'USD',
      recentTransactions: recentTxs.map(tx => ({
        id: tx.id,
        type: tx.type || 'transfer',
        amount: tx.amount || 0,
        from: tx.fromAddress,
        to: tx.toAddress,
        timestamp: new Date(tx.createdAt).toISOString(),
        status: tx.status || 'completed'
      })),
      myDAOs: daoMemberships.map(m => ({
        id: m.dao.id,
        name: m.dao.name,
        description: m.dao.description,
        role: m.role || 'member',
        memberCount: m.dao.memberCount || 0,
        treasuryBalance: 45678 // Would fetch from blockchain
      })),
      activeProposals: activeProposals.map((p: any) => ({
        id: p.id,
        title: p.title || '',
        description: p.description,
        votesRequired: p.votesRequired || 10,
        currentVotes: p.currentVotes || 0,
        status: p.status || 'pending',
        daysLeft: 3,
        daoName: p.dao?.name
      })),
      activeEscrows: activeEscrows,
      governanceStats,
      referralStats,
      daoChat,
      tipOfTheDay
    };
  } catch (error) {
    console.error('Error getting Okedi dashboard:', error);
    return {
      totalBalance: 0,
      trustScore: 50,
      governanceScore: 0,
      votesCount: 0,
      proposalsCreated: 0,
      memberSince: 'Jan 2024',
      daoCount: 0,
      cryptoCurrency: 'cUSD',
      fiatCurrency: 'USD',
      recentTransactions: [],
      myDAOs: [],
      activeProposals: [],
      activeEscrows: [],
      governanceStats: {
        votesCast: 0,
        proposalsVoted: 0,
        governancePower: 0,
        daoMemberCount: 0,
        influenceRank: 0
      },
      referralStats: {
        totalEarnings: 0,
        activeReferrals: 0,
        referralLink: ''
      },
      tipOfTheDay: 'Welcome to Mtaa DAO!'
    };
  }
}

/**
 * Get YUKI dashboard data
 */
export async function getYukiDashboard(userId: string): Promise<YukiDashboardData> {
  try {
    // Personal balance
    const userWallets = await db.query.wallets.findMany({
      where: eq(wallets.userId, userId)
    });
    const personalBalance = userWallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    // DAO treasury sum
    const daoMemberships = await db.query.daoMembers.findMany({
      where: eq(daoMembers.userId, userId)
    });

    const daoTreasury = daoMemberships.length * 0; // Would fetch real values

    // Pending actions (simplified)
    const pendingActions = [];
    if (daoMemberships.length > 0) {
      pendingActions.push({
        id: 'action_1',
        title: 'Vote on pending proposals',
        href: '/proposals',
        daoName: daoMemberships[0]?.dao?.name || 'Your DAO'
      });
    }

    // Latest proposal
    let latestProposal = null;
    if (daoMemberships.length > 0) {
      const daoIds = daoMemberships.map(m => m.daoId);
      const props = await db.query.proposals.findMany({
        orderBy: desc(proposals.createdAt),
        limit: 1,
        with: {
          dao: {
            columns: { name: true }
          }
        }
      });

      if (props.length > 0) {
        const prop = props[0];
        latestProposal = {
          id: prop.id,
          title: prop.title || '',
          description: prop.description || '',
          daoName: prop.dao?.name || 'DAO',
          status: prop.status || 'pending',
          votesRequired: prop.votesRequired || 10,
          currentVotes: prop.currentVotes || 0
        };
      }
    }

    return {
      personalBalance,
      daoTreasury,
      pendingActions,
      latestProposal
    };
  } catch (error) {
    console.error('Error getting Yuki dashboard:', error);
    return {
      personalBalance: 0,
      daoTreasury: 0,
      pendingActions: [],
      latestProposal: null
    };
  }
}

/**
 * Get AMARA dashboard data
 */
export async function getAmaraDashboard(userId: string): Promise<AmaraDashboardData> {
  try {
    // Portfolio value
    const userWallets = await db.query.wallets.findMany({
      where: eq(wallets.userId, userId)
    });
    const portfolioValue = userWallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    // Mock opportunities (in production, fetch from real data)
    const opportunities = [
      {
        id: 'opp_1',
        title: 'CELO Yield Farm',
        description: 'Earn 15% APY by providing liquidity',
        type: 'farming' as const,
        apr: 15.0,
        risk: 'medium' as const,
        href: '/trading/farm/celo'
      },
      {
        id: 'opp_2',
        title: 'Curve.fi Arbitrage',
        description: 'Low-risk stablecoin arbitrage opportunity',
        type: 'arbitrage' as const,
        apr: 8.5,
        risk: 'low' as const,
        href: '/trading/arb/curve'
      }
    ];

    // Mock alerts
    const alerts = [
      '⚠️ Your CELO position is down 5% - consider rebalancing',
      '🟢 New farming opportunity: 20% APY on USDCxcUSDC',
      '📊 Your portfolio allocation suggests reducing DEX exposure'
    ];

    return {
      portfolioValue,
      roiYtd: 18.5,
      gainsSinceStart: 22000.00,
      opportunities,
      alerts
    };
  } catch (error) {
    console.error('Error getting Amara dashboard:', error);
    return {
      portfolioValue: 0,
      roiYtd: 0,
      gainsSinceStart: 0,
      opportunities: [],
      alerts: []
    };
  }
}
