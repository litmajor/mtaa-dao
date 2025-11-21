
import { Router } from 'express';
import { db } from '../db';
import { logger } from '../utils/logger';
import {
  users,
  daos,
  daoMemberships,
  vaults,
  proposals,
  vaultTransactions,
  userActivities,
  sessions,
  subscriptions,
  tasks,
  referralRewards,
  votes,
  contributions,
  betaAccess,
  config,
  auditLogs
} from '../../shared/schema';
import { eq, desc, sql, and, gte, or, like, count } from 'drizzle-orm';
import { requireRole } from '../middleware/rbac';
import { featureFlags, betaAccessEnabled, betaTesterGroup } from '../../shared/config';
import os from 'os';

const router = Router();

// Middleware to ensure user is super_admin
const requireSuperAdmin = requireRole('super_admin');


// =====================================================
// SUPERUSER/ADMIN AUTH ENDPOINTS
// =====================================================


import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Type guard for user record
function isUser(obj: any): obj is { id: string; email: string; passwordHash: string; roles: string } {
  return obj && typeof obj.id === 'string' && typeof obj.email === 'string' && typeof obj.passwordHash === 'string' && typeof obj.roles === 'string';
}

// POST /api/auth/admin-login

router.post('/auth/admin-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    const userArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userArr[0];
    if (!isUser(user) || (user.roles !== 'super_admin' && user.roles !== 'admin')) {
      return res.status(401).json({ message: 'Invalid credentials or not an admin/superuser' });
    }
    if (!user.passwordHash) {
      return res.status(401).json({ message: 'No password set for this user' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.roles }, process.env.JWT_SECRET || 'changeme', { expiresIn: '1d' });
    
    // Return user object with superuser flag
    const responseUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || null,
      role: user.roles,
      isSuperUser: user.roles === 'super_admin',
      isAdmin: user.roles === 'admin' || user.roles === 'super_admin',
      walletAddress: user.walletAddress || null,
      isEmailVerified: user.emailVerified || false,
      isPhoneVerified: user.phoneVerified || false,
      profilePicture: user.profileImageUrl || null,
    };
    
    res.json({ 
      success: true, 
      data: { 
        user: responseUser, 
        accessToken: token,
      } 
    });
  } catch (err) {
    logger.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/superuser-register

router.post('/auth/superuser-register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    const existingArr = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingArr[0]) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      password: hash,
      firstName: firstName || '',
      lastName: lastName || '',
      roles: 'super_admin',
      createdAt: new Date(),
    }).returning();
    if (!isUser(newUser)) {
      return res.status(500).json({ message: 'User creation failed' });
    }
    const token = jwt.sign({ id: newUser.id, role: newUser.roles }, process.env.JWT_SECRET || 'changeme', { expiresIn: '1d' });
    res.json({ success: true, data: { user: newUser, accessToken: token } });
  } catch (err) {
    logger.error('Superuser register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================================================
// ANALYTICS & DASHBOARD
// =====================================================

// GET /api/admin/analytics - Comprehensive system analytics
router.get('/analytics', requireSuperAdmin, async (req, res) => {
  try {
    // Platform-wide stats
    const [
      totalDaos,
      totalMembers,
      totalSubscriptions,
      activeVaults,
      totalTransactions,
      pendingTasks,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(daos),
      db.select({ count: sql<number>`count(DISTINCT ${users.id})` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(eq(subscriptions.status, 'active')),
  db.select({ count: sql<number>`count(*)` }).from(vaults).where(eq(vaults.isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(vaultTransactions),
      db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, 'open')),
    ]);

    // Calculate total treasury value (sum of all vault balances)
    const treasuryValue = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${vaults.balance} AS NUMERIC)), 0)` })
      .from(vaults);

    // Revenue metrics (from database - count premium subscriptions)
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [monthlyResult, quarterlyResult, annualResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(subscriptions)
        .where(and(
          gte(subscriptions.createdAt, monthAgo),
          eq(subscriptions.status, 'active'),
          eq(subscriptions.plan, 'premium')
        )),
      db
        .select({ count: sql<number>`count(*)` })
        .from(subscriptions)
        .where(and(
          gte(subscriptions.createdAt, quarterAgo),
          eq(subscriptions.status, 'active'),
          eq(subscriptions.plan, 'premium')
        )),
      db
        .select({ count: sql<number>`count(*)` })
        .from(subscriptions)
        .where(and(
          gte(subscriptions.createdAt, yearAgo),
          eq(subscriptions.status, 'active'),
          eq(subscriptions.plan, 'premium')
        )),
    ]);

    // Calculate revenue (premium subscription at ~$99/month)
    const premiumPrice = 99;
    const revenueMetrics = {
      monthly: monthlyResult[0].count * premiumPrice,
      quarterly: quarterlyResult[0].count * premiumPrice * 3,
      annual: annualResult[0].count * premiumPrice * 12,
    };

    // Recent DAOs (last 5)
    const recentDaos = await db
      .select({
        id: daos.id,
        name: daos.name,
        createdAt: daos.createdAt,
        plan: daos.plan,
      })
      .from(daos)
      .orderBy(desc(daos.createdAt))
      .limit(5);

    // Count members for each recent DAO
    const recentDaosWithMembers = await Promise.all(
      recentDaos.map(async (dao) => {
        const memberCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(daoMemberships)
          .where(eq(daoMemberships.daoId, dao.id));
        
        return {
          name: dao.name,
          createdAt: dao.createdAt?.toISOString().split('T')[0] || 'N/A',
          members: memberCount[0].count,
          plan: dao.plan || 'free',
        };
      })
    );

    // Top members by activity score (calculated from contributions and votes)
    const topMembers = await db
      .select({
        userId: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        activityCount: sql<number>`COUNT(DISTINCT ${userActivities.id})`,
        contributionCount: sql<number>`COUNT(DISTINCT ${contributions.id})`,
        voteCount: sql<number>`COUNT(DISTINCT ${votes.id})`,
      })
      .from(users)
      .leftJoin(userActivities, eq(userActivities.userId, users.id))
      .leftJoin(contributions, eq(contributions.userId, users.id))
      .leftJoin(votes, eq(votes.userId, users.id))
      .groupBy(users.id, users.username, users.firstName, users.lastName)
      .orderBy(sql`COUNT(DISTINCT ${userActivities.id}) + COUNT(DISTINCT ${contributions.id}) + COUNT(DISTINCT ${votes.id}) DESC`)
      .limit(10);

    const topMembersFormatted = topMembers.map((user: any) => {
      // Calculate reputation score: activities*1 + contributions*5 + votes*2
      const score = (user.activityCount || 0) * 1 + (user.contributionCount || 0) * 5 + (user.voteCount || 0) * 2;
      return {
        name: user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous',
        score,
        activities: user.activityCount || 0,
        contributions: user.contributionCount || 0,
        votes: user.voteCount || 0,
      };
    });

    // System health checks (actual connectivity tests)
    const systemHealth: Record<string, 'healthy' | 'warning' | 'critical'> = {
      database: 'healthy',
      blockchain: 'healthy',
      payments: 'healthy',
      api: 'healthy',
    };

    // Check database health
    try {
      await db.execute(sql`SELECT 1`);
    } catch (err) {
      systemHealth.database = 'critical';
      logger.error('Database health check failed', err);
    }

    // Check blockchain (RPC) health
    try {
      const rpcUrl = process.env.RPC_URL || 'https://alfajores-forno.celo-testnet.org';
      const blockchainResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });
      if (!blockchainResponse.ok) {
        systemHealth.blockchain = 'critical';
      }
    } catch (err) {
      systemHealth.blockchain = 'warning';
      logger.warn('Blockchain health check failed', err);
    }

    // Check payment processor health (mock for now - would integrate with actual provider)
    // This would check Stripe/payment provider API
    try {
      // Placeholder for actual payment health check
      const recentPayments = await db
        .select({ count: sql<number>`count(*)` })
        .from(vaultTransactions)
        .where(gte(vaultTransactions.createdAt, new Date(Date.now() - 3600000))); // Last hour
      
      if (recentPayments[0].count < 0) {
        systemHealth.payments = 'warning';
      }
    } catch (err) {
      systemHealth.payments = 'warning';
      logger.warn('Payments health check failed', err);
    }

    // System info
    const uptime = process.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
    
    const systemInfo = {
      uptime: uptimeFormatted,
      version: process.env.npm_package_version || '1.0.0',
      status: 'Online',
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      cpu: `${os.cpus().length} cores`,
    };

    // Chain info (from RPC or cached)
    let chainInfo = {
      chain: process.env.BLOCKCHAIN_NETWORK || 'Celo Alfajores',
      block: 'Unknown',
      blockNumber: 0,
      timestamp: new Date(),
    };
    
    try {
      // Try to fetch latest block number if RPC is available
      const rpcUrl = process.env.RPC_URL || 'https://alfajores-forno.celo-testnet.org';
      const blockResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      const blockData = await blockResponse.json();
      if (blockData.result) {
        chainInfo.blockNumber = parseInt(blockData.result, 16);
        chainInfo.block = `Block #${chainInfo.blockNumber}`;
      }
    } catch (err) {
      logger.warn('Could not fetch blockchain info from RPC', { error: err });
      chainInfo.block = 'Connection error';
    }

    // Critical alerts (check for issues)
    const criticalAlerts: any[] = [];
    
    // Check for failed transactions (example)
    const failedTxCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(vaultTransactions)
      .where(eq(vaultTransactions.status, 'failed'));
    
  if (failedTxCount[0].count > 10) {
      criticalAlerts.push({
        type: 'warning',
        message: `${failedTxCount[0].count} failed transactions detected`,
        timestamp: new Date().toISOString(),
        resolved: false,
      });
    }

    // System logs (last 10 activities)
    const recentActivities = await db
      .select({
        activityType: userActivities.type,
        createdAt: userActivities.createdAt,
        userId: userActivities.userId,
      })
      .from(userActivities)
      .orderBy(desc(userActivities.createdAt))
      .limit(10);

    const systemLogs = recentActivities.map(activity => 
      `[${activity.createdAt?.toISOString()}] ${activity.activityType} by user ${activity.userId}`
    );

    // Contract addresses (from env)
    const contractAddresses = [
      process.env.MAONO_CONTRACT_ADDRESS || 'Not configured',
      process.env.VOTING_TOKEN_ADDRESS || 'Not configured',
    ].filter(addr => addr !== 'Not configured');

    // ======================
    // TOKENOMICS DATA
    // ======================
    const totalVotingTokens = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${users.votingPower} AS NUMERIC)), 0)` })
      .from(users);

    const totalReferralRewards = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(${referralRewards.rewardAmount} AS NUMERIC)), 0)` })
      .from(referralRewards);

    const tokenomics = {
      totalSupply: 1000000000, // 1 Billion MTAA (from your tokenomics)
      circulatingSupply: Number(totalVotingTokens[0].total) + Number(totalReferralRewards[0].total),
      distributedVotingTokens: Number(totalVotingTokens[0].total),
      referralRewards: Number(totalReferralRewards[0].total),
      treasuryReserve: Number(treasuryValue[0].total),
    };

    // ======================
    // VESTING SCHEDULES
    // ======================
    const pendingVesting = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(SUM(CAST(${referralRewards.rewardAmount} AS NUMERIC)), 0)` })
      .from(referralRewards)
      .where(eq(referralRewards.claimed, false));

    const claimedRewards = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(SUM(CAST(${referralRewards.rewardAmount} AS NUMERIC)), 0)` })
      .from(referralRewards)
      .where(eq(referralRewards.claimed, true));

    const vestingData = {
      pendingRewards: pendingVesting[0].count,
      pendingAmount: Number(pendingVesting[0].total),
      claimedRewards: claimedRewards[0].count,
      claimedAmount: Number(claimedRewards[0].total),
      vestingPeriod: '90 days', // Standard vesting period
    };

    // ======================
    // WALLET ANALYTICS
    // ======================
    const topWalletHolders = await db
      .select({
        userId: users.id,
        email: users.email,
        username: users.username,
        balance: users.votingPower,
      })
      .from(users)
      .orderBy(desc(users.votingPower))
      .limit(10);

    const totalWalletVolume = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(CAST(${vaultTransactions.amount} AS NUMERIC)), 0)`,
        count: sql<number>`count(*)` 
      })
      .from(vaultTransactions);

    const walletAnalytics = {
      topHolders: topWalletHolders.map(holder => ({
        user: holder.username || (holder.email || '').split('@')[0],
        balance: Number(holder.balance || 0),
      })),
      totalTransactionVolume: Number(totalWalletVolume[0].total),
      totalWalletTransactions: totalWalletVolume[0].count,
    };

    // ======================
    // TOP DAOs RANKINGS
    // ======================
    const allDaos = await db
      .select({
        id: daos.id,
        name: daos.name,
        createdAt: daos.createdAt,
      })
      .from(daos)
      .orderBy(desc(daos.createdAt))
      .limit(20);

    const daoRankings = await Promise.all(
      allDaos.map(async (dao) => {
        const [memberCount, proposalCount, activityCount] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(daoMemberships).where(eq(daoMemberships.daoId, dao.id)),
          db.select({ count: sql<number>`count(*)` }).from(proposals).where(eq(proposals.daoId, dao.id)),
          db.select({ count: sql<number>`count(*)` }).from(userActivities).where(eq(userActivities.dao_id, dao.id)),
        ]);

        return {
          id: dao.id,
          name: dao.name,
          members: memberCount[0].count,
          proposals: proposalCount[0].count,
          activity: activityCount[0].count,
          createdAt: dao.createdAt,
        };
      })
    );

    // Sort by members
    const topDaosByMembers = [...daoRankings].sort((a, b) => b.members - a.members).slice(0, 10);
    
    // Sort by activity
    const topDaosByActivity = [...daoRankings].sort((a, b) => b.activity - a.activity).slice(0, 10);

    // ======================
    // TOP USERS RANKINGS
    // ======================
    const topUsersByVotingPower = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        votingTokenBalance: users.votingPower,
      })
      .from(users)
      .orderBy(desc(users.votingTokenBalance))
      .limit(10);

    const topContributors = await db
      .select({
        userId: contributions.userId,
        username: users.username,
        email: users.email,
        count: sql<number>`count(*)`,
      })
      .from(contributions)
      .leftJoin(users, eq(contributions.userId, users.id))
      .groupBy(contributions.userId, users.username, users.email)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    const topVoters = await db
      .select({
        userId: votes.userId,
        username: users.username,
        email: users.email,
        count: sql<number>`count(*)`,
      })
      .from(votes)
      .leftJoin(users, eq(votes.userId, users.id))
      .groupBy(votes.userId, users.username, users.email)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    const userRankings = {
      byVotingPower: topUsersByVotingPower.map(user => ({
        name: user.username || (user.email || '').split('@')[0],
        votingPower: Number(user.votingTokenBalance || 0),
      })),
      byContributions: topContributors.map(c => ({
        name: c.username || c.email?.split('@')[0] || 'Unknown',
        contributions: c.count,
      })),
      byVotes: topVoters.map(v => ({
        name: v.username || v.email?.split('@')[0] || 'Unknown',
        votes: v.count,
      })),
    };

    // ======================
    // SUBSCRIPTION DETAILS
    // ======================
    const subscriptionStats = await db
      .select({
        status: subscriptions.status,
        plan: subscriptions.plan,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .groupBy(subscriptions.status, subscriptions.plan);

    const subscriptionData = {
      total: totalSubscriptions[0].count,
      active: subscriptionStats.filter(s => s.status === 'active').reduce((sum, s) => sum + s.count, 0),
      expired: subscriptionStats.filter(s => s.status === 'expired').reduce((sum, s) => sum + s.count, 0),
      cancelled: subscriptionStats.filter(s => s.status === 'cancelled').reduce((sum, s) => sum + s.count, 0),
      byPlan: subscriptionStats.reduce((acc, s) => {
        const plan = s.plan || 'free';
        if (!acc[plan]) acc[plan] = 0;
        acc[plan] += s.count;
        return acc;
      }, {} as Record<string, number>),
    };

    // ======================
    // PAYMENT PROVIDER DATA
    // ======================
    const paymentStats = await db
      .select({
        provider: sql<string>`${vaultTransactions.provider}`,
        status: vaultTransactions.status,
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${vaultTransactions.amount} AS NUMERIC)), 0)`,
      })
      .from(vaultTransactions)
      .groupBy(sql`${vaultTransactions.provider}`, vaultTransactions.status);

    const failedPayments = paymentStats.filter(p => p.status === 'failed');

    const paymentProviderData = {
      totalProcessed: paymentStats.reduce((sum, p) => sum + p.count, 0),
      totalFailed: failedPayments.reduce((sum, p) => sum + p.count, 0),
      successRate: paymentStats.reduce((sum, p) => sum + p.count, 0) > 0
        ? ((paymentStats.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.count, 0) /
           paymentStats.reduce((sum, p) => sum + p.count, 0)) * 100).toFixed(2)
        : '0',
      byProvider: paymentStats.reduce((acc, p) => {
        const provider = p.provider || 'unknown';
        if (!acc[provider]) {
          acc[provider] = { total: 0, failed: 0, completed: 0, amount: 0 };
        }
        acc[provider].total += p.count;
        acc[provider].amount += Number(p.totalAmount);
        if (p.status === 'failed') acc[provider].failed += p.count;
        if (p.status === 'completed') acc[provider].completed += p.count;
        return acc;
      }, {} as Record<string, { total: number; failed: number; completed: number; amount: number }>),
      recentFailures: failedPayments.slice(0, 10),
    };

    // ======================
    // BLOCKCHAIN DATA
    // ======================
    let blockchainData: any = {
      network: process.env.NETWORK || 'Celo Alfajores',
      rpcUrl: process.env.RPC_URL || 'Not configured',
      latestBlock: 'N/A',
      gasPrice: 'N/A',
      networkStatus: 'Unknown',
      totalWallets: 0,
      activeWallets: 0,
    };

    try {
      // Try to get blockchain data from tokenService if available
      const { TokenService } = await import('../services/tokenService');
      if (process.env.RPC_URL && process.env.PRIVATE_KEY) {
        const tokenService = new TokenService(
          process.env.RPC_URL,
          process.env.PRIVATE_KEY,
          process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
        );

        // Get latest block
        const latestBlockNum = await tokenService.provider.getBlockNumber();
        blockchainData.latestBlock = latestBlockNum;

        // Get gas price (in Gwei)
        const feeData = await tokenService.provider.getFeeData();
        if (feeData.gasPrice) {
          blockchainData.gasPrice = `${(Number(feeData.gasPrice) / 1e9).toFixed(2)} Gwei`;
        }

        blockchainData.networkStatus = 'Connected';
      }
    } catch (err) {
      logger.warn('Could not fetch blockchain data:', err);
      blockchainData.networkStatus = 'Disconnected';
    }

    // Count wallets in database
    const walletCount = await db
      .select({ count: sql<number>`count(DISTINCT ${users.walletAddress})` })
      .from(users)
      .where(sql`${users.walletAddress} IS NOT NULL`);

    blockchainData.totalWallets = walletCount[0].count;

    // Count active wallets (with recent transactions)
    const activeWalletCount = await db
      .select({ count: sql<number>`count(DISTINCT ${vaultTransactions.fromAddress})` })
      .from(vaultTransactions)
      .where(gte(vaultTransactions.timestamp, sql`NOW() - INTERVAL '30 days'`));

    blockchainData.activeWallets = activeWalletCount[0].count;

    res.json({
      // Basic stats
      daos: totalDaos[0].count,
      treasury: Number(treasuryValue[0].total),
      members: totalMembers[0].count,
      subscriptions: totalSubscriptions[0].count,
      activeVaults: activeVaults[0].count,
      totalTransactions: totalTransactions[0].count,
      pendingTasks: pendingTasks[0].count,
      
      // System info
      chainInfo,
      system: systemInfo,
      systemHealth,
      systemLogs,
      criticalAlerts,
      contractAddresses,
      
      // Financial
      revenueMetrics,
      
      // Recent data
      recentDaos: recentDaosWithMembers,
      topMembers: topMembersFormatted,
      
      // Comprehensive oversight data
      tokenomics,
      vestingData,
      walletAnalytics,
      topDaosByMembers,
      topDaosByActivity,
      userRankings,
      
      // NEW: Subscription details
      subscriptionData,
      
      // NEW: Payment provider data
      paymentProviderData,
      
      // NEW: Blockchain data
      blockchainData,
    });
  } catch (error) {
    logger.error('Error fetching admin analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// =====================================================
// USER MANAGEMENT
// =====================================================

// GET /api/admin/users/list - List all users with pagination and filtering
router.get('/users/list', requireSuperAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '', role = '', status = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where conditions
    const conditions: any[] = [];
    
    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.firstName, `%${search}%`),
          like(users.lastName, `%${search}%`),
          like(users.username, `%${search}%`)
        )
      );
    }
    
    if (role && typeof role === 'string') {
      conditions.push(eq(users.roles, role));
    }
    
    if (status === 'banned') {
      conditions.push(eq(users.isBanned, true));
    } else if (status === 'active') {
      conditions.push(eq(users.isBanned, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch users
    const usersList = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        roles: users.roles,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        isBanned: users.isBanned,
        votingTokenBalance: users.votingTokenBalance,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get total count
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause);

    res.json({
      users: usersList,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// PUT /api/admin/users/:userId/ban - Ban/unban a user
router.put('/users/:userId/ban', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { banned, reason } = req.body;
    const adminId = (req.user as any).id;

    if (userId === adminId) {
      return res.status(400).json({ error: 'Cannot ban yourself' });
    }

    await db
      .update(users)
      .set({
        isBanned: banned,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info(`User ${banned ? 'banned' : 'unbanned'}`, {
      userId,
      reason,
      adminId,
    });

    res.json({
      success: true,
      message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
    });
  } catch (error) {
    logger.error('Error banning/unbanning user:', error);
    res.status(500).json({ error: 'Failed to update user ban status' });
  }
});

// DELETE /api/admin/users/:userId - Delete a user (hard delete - use with caution)
router.delete('/users/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = (req.user as any).id;

    if (userId === adminId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Delete user (cascade will handle related records)
    await db.delete(users).where(eq(users.id, userId));

    logger.warn('User deleted by admin', { userId, adminId });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// =====================================================
// DAO MANAGEMENT
// =====================================================

// GET /api/admin/daos/list - List all DAOs with pagination
router.get('/daos/list', requireSuperAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '20', search = '', status = '' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where conditions
    const conditions: any[] = [];
    
    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(like(daos.name, `%${search}%`));
    }
    
    if (status && typeof status === 'string') {
      conditions.push(eq(daos.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch DAOs
    const daosList = await db
      .select({
        id: daos.id,
        name: daos.name,
        description: daos.description,
        status: daos.status,
        subscriptionPlan: daos.subscriptionPlan,
        createdAt: daos.createdAt,
        founderId: daos.founderId,
      })
      .from(daos)
      .where(whereClause)
      .orderBy(desc(daos.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get member counts for each DAO
    const daosWithMemberCounts = await Promise.all(
      daosList.map(async (dao) => {
        const memberCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(daoMemberships)
          .where(eq(daoMemberships.daoId, dao.id));
        
        return {
          ...dao,
          memberCount: memberCount[0].count,
        };
      })
    );

    // Get total count
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(daos)
      .where(whereClause);

    res.json({
      daos: daosWithMemberCounts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error listing DAOs:', error);
    res.status(500).json({ error: 'Failed to list DAOs' });
  }
});

// PUT /api/admin/daos/:daoId/status - Update DAO status (approve, suspend, etc.)
router.put('/daos/:daoId/status', requireSuperAdmin, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { status, reason } = req.body;
    const adminId = (req.user as any).id;

    const validStatuses = ['active', 'pending', 'suspended', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db
      .update(daos)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(daos.id, daoId));

    logger.info('DAO status updated by admin', {
      daoId,
      status,
      reason,
      adminId,
    });

    res.json({
      success: true,
      message: `DAO status updated to ${status}`,
    });
  } catch (error) {
    logger.error('Error updating DAO status:', error);
    res.status(500).json({ error: 'Failed to update DAO status' });
  }
});

// =====================================================
// ACTIVITY LOGS
// =====================================================

// GET /api/admin/activity-logs - Get system activity logs with filtering
router.get('/activity-logs', requireSuperAdmin, async (req, res) => {
  try {
    const {
      page = '1',
      limit = '50',
      userId,
      activityType,
      startDate,
      endDate
    } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where conditions
    const conditions: any[] = [];
    
    if (userId && typeof userId === 'string') {
      conditions.push(eq(userActivities.userId, userId));
    }
    
    if (activityType && typeof activityType === 'string') {
      conditions.push(eq(userActivities.activityType, activityType));
    }
    
    if (startDate && typeof startDate === 'string') {
      conditions.push(gte(userActivities.createdAt, new Date(startDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch activity logs
    const logs = await db
      .select({
        id: userActivities.id,
        userId: userActivities.userId,
        activityType: userActivities.activityType,
        metadata: userActivities.metadata,
        createdAt: userActivities.createdAt,
        userName: users.username,
        userEmail: users.email,
      })
      .from(userActivities)
      .leftJoin(users, eq(userActivities.userId, users.id))
      .where(whereClause)
      .orderBy(desc(userActivities.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get total count
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(userActivities)
      .where(whereClause);

    res.json({
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// =====================================================
// FEATURE FLAGS & PROGRESSIVE RELEASES
// =====================================================

// GET /api/features - Get all feature flags (public endpoint)
// Returns feature flags that should be shown to current user
// If user is authenticated, includes their personalized enabledBetaFeatures from database
router.get('/features', async (req, res) => {
  try {
    const user = (req.user as any) || null;
    
    // Parse user's enabled beta features from database
    let userEnabledFeatures: string[] = [];
    if (user?.id) {
      try {
        const userRecord = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        
        if (userRecord.length > 0 && userRecord[0].enabledBetaFeatures) {
          const features = userRecord[0].enabledBetaFeatures;
          userEnabledFeatures = JSON.parse(typeof features === 'string' ? features : JSON.stringify(features));
        }
      } catch (e) {
        logger.warn('Failed to parse enabledBetaFeatures for user', { userId: user.id, error: e });
      }
    }
    
    const response = {
      // All features with their current enabled status
      features: featureFlags,
      
      // User-specific info
      user: user ? {
        id: user.id,
        role: user.role,
        betaAccess: userEnabledFeatures.length > 0,
        enabledBetaFeatures: userEnabledFeatures, // Features stored in database
      } : null,
      
      // Feature release schedule (for "Coming Soon" messages)
      releaseSchedule: {
        phase1: { 
          name: 'Core Platform', 
          startDate: '2025-12-01',
          endDate: '2026-01-15',
          status: 'live'
        },
        phase2: { 
          name: 'Capital Features (Locked Savings, Pools)', 
          startDate: '2026-01-15',
          endDate: '2026-03-01',
          status: 'coming'
        },
        phase3: { 
          name: 'AI & Analytics', 
          startDate: '2026-03-01',
          endDate: '2026-04-15',
          status: 'coming'
        },
        phase4: { 
          name: 'Governance Evolution (Elder Council)', 
          startDate: '2026-04-15',
          endDate: '2026-06-01',
          status: 'coming'
        },
        phase5: { 
          name: 'Multi-Chain & Scale', 
          startDate: '2026-06-01',
          endDate: '2026-08-01',
          status: 'coming'
        },
      },
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching features:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

// GET /api/admin/features - Get detailed feature info (admin only)
router.get('/features/admin', requireSuperAdmin, async (req, res) => {
  try {
    res.json({
      features: featureFlags,
      betaAccessEnabled,
      betaTesterGroup,
      environmentVariables: {
        note: 'Set these in .env.phases or .env file',
        all: Object.keys(featureFlags).map(key => ({
          flag: key,
          envVar: `FEATURE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`,
          enabled: featureFlags[key as keyof typeof featureFlags],
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching admin features:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

// POST /api/admin/beta-access - Grant beta access to features
// Persists beta feature access to users table enabledBetaFeatures column
router.post('/beta-access', requireSuperAdmin, async (req, res) => {
  try {
    const { userId, features: featuresToGrant } = req.body;
    
    if (!userId || !Array.isArray(featuresToGrant)) {
      return res.status(400).json({ error: 'userId and features array required' });
    }
    
    // Validate features exist in available features config
    const invalidFeatures = featuresToGrant.filter(
      f => !Object.keys(featureFlags).includes(f)
    );
    
    if (invalidFeatures.length > 0) {
      return res.status(400).json({
        error: 'Invalid features provided',
        invalidFeatures,
        availableFeatures: Object.keys(featureFlags),
      });
    }
    
    // Fetch current user to get existing features
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Parse existing features and merge with new ones
    let existingFeatures: string[] = [];
    try {
      const existing = userRecord[0].enabledBetaFeatures;
      if (existing) {
        existingFeatures = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
      }
    } catch (e) {
      existingFeatures = [];
    }
    
    // Merge and deduplicate
    const mergedFeatures = Array.from(new Set([...existingFeatures, ...featuresToGrant]));
    
    // Update user record with new features
    await db
      .update(users)
      .set({ enabledBetaFeatures: JSON.stringify(mergedFeatures) })
      .where(eq(users.id, userId));
    
    logger.info('Beta access granted and persisted to database', {
      userId,
      features: featuresToGrant,
      mergedFeatures,
      grantedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: 'Beta access granted and persisted',
      userId,
      grantedFeatures: featuresToGrant,
      allEnabledFeatures: mergedFeatures,
    });
  } catch (error) {
    logger.error('Error granting beta access:', error);
    res.status(500).json({ error: 'Failed to grant beta access' });
  }
});

// DELETE /api/admin/beta-access/:userId - Revoke beta access
// Removes all beta feature access from user (resets to empty array)
router.delete('/beta-access/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { features: featuresToRevoke } = req.body || {};
    
    // Fetch user record
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Parse existing features
    let existingFeatures: string[] = [];
    try {
      const existing = userRecord[0].enabledBetaFeatures;
      if (existing) {
        existingFeatures = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
      }
    } catch (e) {
      existingFeatures = [];
    }
    
    // If specific features provided, remove only those; otherwise clear all
    let newFeatures = existingFeatures;
    if (featuresToRevoke && Array.isArray(featuresToRevoke)) {
      newFeatures = existingFeatures.filter(f => !featuresToRevoke.includes(f));
    } else {
      newFeatures = [];
    }
    
    // Update user record
    await db
      .update(users)
      .set({ enabledBetaFeatures: JSON.stringify(newFeatures) })
      .where(eq(users.id, userId));
    
    logger.info('Beta access revoked and persisted to database', {
      userId,
      revokedFeatures: featuresToRevoke || 'all',
      remainingFeatures: newFeatures,
      revokedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });
    
    res.json({
      success: true,
      message: featuresToRevoke ? 'Specified features revoked' : 'All beta access revoked',
      userId,
      remainingFeatures: newFeatures,
    });
  } catch (error) {
    logger.error('Error revoking beta access:', error);
    res.status(500).json({ error: 'Failed to revoke beta access' });
  }
});

// GET /api/admin/beta-access/:userId - Get specific user's beta features
router.get('/beta-access/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userRecord.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let userBetaFeatures: string[] = [];
    try {
      const existing = userRecord[0].enabledBetaFeatures;
      if (existing) {
        userBetaFeatures = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
      }
    } catch (e) {
      logger.warn('Failed to parse enabledBetaFeatures for user', { userId, error: e });
    }
    
    res.json({
      success: true,
      userId,
      email: userRecord[0].email,
      username: userRecord[0].username,
      enabledBetaFeatures: userBetaFeatures,
      betaAccessEnabled: userBetaFeatures.length > 0,
    });
  } catch (error) {
    logger.error('Error fetching user beta features:', error);
    res.status(500).json({ error: 'Failed to fetch beta features' });
  }
});

// GET /api/admin/beta-access - List all users with beta access
router.get('/beta-access', requireSuperAdmin, async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const offset = (page - 1) * limit;

    // Get users with non-empty enabledBetaFeatures
    const usersWithBeta = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        enabledBetaFeatures: users.enabledBetaFeatures,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`enabled_beta_features IS NOT NULL AND enabled_beta_features != '[]'`)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`enabled_beta_features IS NOT NULL AND enabled_beta_features != '[]'`);

    const totalCount = countResult[0].count;
    const totalPages = Math.ceil(totalCount / limit);

    // Parse features for each user
    const parsedUsers = usersWithBeta.map(user => {
      let features: string[] = [];
      try {
        const existing = user.enabledBetaFeatures;
        if (existing) {
          features = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
        }
      } catch (e) {
        logger.warn('Failed to parse enabledBetaFeatures', { userId: user.id, error: e });
      }
      
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        enabledBetaFeatures: features,
        featureCount: features.length,
        createdAt: user.createdAt,
      };
    });

    res.json({
      success: true,
      users: parsedUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Error fetching users with beta access:', error);
    res.status(500).json({ error: 'Failed to fetch beta access list' });
  }
});

// POST /api/admin/beta-access/bulk - Grant beta access to multiple users
router.post('/beta-access/bulk', requireSuperAdmin, async (req, res) => {
  try {
    const { userIds, features: featuresToGrant } = req.body;
    
    if (!Array.isArray(userIds) || !Array.isArray(featuresToGrant)) {
      return res.status(400).json({ error: 'userIds and features arrays required' });
    }

    if (userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user ID required' });
    }

    if (featuresToGrant.length === 0) {
      return res.status(400).json({ error: 'At least one feature required' });
    }
    
    // Validate features exist in available features config
    const invalidFeatures = featuresToGrant.filter(
      f => !Object.keys(featureFlags).includes(f)
    );
    
    if (invalidFeatures.length > 0) {
      return res.status(400).json({
        error: 'Invalid features provided',
        invalidFeatures,
        availableFeatures: Object.keys(featureFlags),
      });
    }

    // Fetch all users
    const userRecords = await db
      .select()
      .from(users)
      .where(sql`id = ANY(${userIds})`);

    const notFoundIds = userIds.filter(
      id => !userRecords.some(u => u.id === id)
    );

    if (notFoundIds.length > 0) {
      return res.status(400).json({
        error: 'Some users not found',
        notFoundIds,
      });
    }

    // Update each user
    const updateResults = [];
    for (const userRecord of userRecords) {
      let existingFeatures: string[] = [];
      try {
        const existing = userRecord.enabledBetaFeatures;
        if (existing) {
          existingFeatures = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
        }
      } catch (e) {
        existingFeatures = [];
      }

      const mergedFeatures = Array.from(new Set([...existingFeatures, ...featuresToGrant]));

      await db
        .update(users)
        .set({ enabledBetaFeatures: JSON.stringify(mergedFeatures) })
        .where(eq(users.id, userRecord.id));

      updateResults.push({
        userId: userRecord.id,
        email: userRecord.email,
        grantedFeatures: featuresToGrant,
        allEnabledFeatures: mergedFeatures,
      });
    }

    logger.info('Bulk beta access granted', {
      userCount: userIds.length,
      features: featuresToGrant,
      grantedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: `Beta access granted to ${userIds.length} user(s)`,
      usersUpdated: userIds.length,
      results: updateResults,
    });
  } catch (error) {
    logger.error('Error granting bulk beta access:', error);
    res.status(500).json({ error: 'Failed to grant bulk beta access' });
  }
});

// DELETE /api/admin/beta-access/bulk - Revoke beta access from multiple users
router.delete('/beta-access/bulk', requireSuperAdmin, async (req, res) => {
  try {
    const { userIds, features: featuresToRevoke } = req.body;
    
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds array required' });
    }

    if (userIds.length === 0) {
      return res.status(400).json({ error: 'At least one user ID required' });
    }

    // Fetch all users
    const userRecords = await db
      .select()
      .from(users)
      .where(sql`id = ANY(${userIds})`);

    const notFoundIds = userIds.filter(
      id => !userRecords.some(u => u.id === id)
    );

    if (notFoundIds.length > 0) {
      return res.status(400).json({
        error: 'Some users not found',
        notFoundIds,
      });
    }

    // Validate features if provided
    if (featuresToRevoke) {
      if (!Array.isArray(featuresToRevoke)) {
        return res.status(400).json({ error: 'features must be an array' });
      }

      const invalidFeatures = featuresToRevoke.filter(
        f => !Object.keys(featureFlags).includes(f)
      );

      if (invalidFeatures.length > 0) {
        return res.status(400).json({
          error: 'Invalid features provided',
          invalidFeatures,
        });
      }
    }

    // Update each user
    const updateResults = [];
    for (const userRecord of userRecords) {
      let existingFeatures: string[] = [];
      try {
        const existing = userRecord.enabledBetaFeatures;
        if (existing) {
          existingFeatures = JSON.parse(typeof existing === 'string' ? existing : JSON.stringify(existing));
        }
      } catch (e) {
        existingFeatures = [];
      }

      let newFeatures = existingFeatures;
      if (featuresToRevoke && Array.isArray(featuresToRevoke)) {
        newFeatures = existingFeatures.filter(f => !featuresToRevoke.includes(f));
      } else {
        newFeatures = [];
      }

      await db
        .update(users)
        .set({ enabledBetaFeatures: JSON.stringify(newFeatures) })
        .where(eq(users.id, userRecord.id));

      updateResults.push({
        userId: userRecord.id,
        email: userRecord.email,
        revokedFeatures: featuresToRevoke || 'all',
        remainingFeatures: newFeatures,
      });
    }

    logger.info('Bulk beta access revoked', {
      userCount: userIds.length,
      features: featuresToRevoke || 'all',
      revokedBy: (req.user as any)?.id,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: `Beta access revoked for ${userIds.length} user(s)`,
      usersUpdated: userIds.length,
      results: updateResults,
    });
  } catch (error) {
    logger.error('Error revoking bulk beta access:', error);
    res.status(500).json({ error: 'Failed to revoke bulk beta access' });
  }
});

// =====================================================
// SYSTEM SETTINGS
// =====================================================

// GET /api/admin/settings - Get system settings
// GET /api/admin/settings - Get system settings (from database)
router.get('/settings', requireSuperAdmin, async (req, res) => {
  try {
    // Fetch all settings from config table
    const configRecords = await db.select().from(config);
    const configMap: Record<string, any> = {};
    
    configRecords.forEach(record => {
      configMap[record.key] = record.value;
    });

    const settings = {
      // Platform settings (from database or env fallback)
      platform: configMap.platform || {
        name: process.env.PLATFORM_NAME || 'MTAA DAO',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
        registrationEnabled: process.env.REGISTRATION_ENABLED !== 'false',
        requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
      },
      // Blockchain settings (from database or env fallback)
      blockchain: configMap.blockchain || {
        network: process.env.BLOCKCHAIN_NETWORK || 'alfajores',
        rpcUrl: process.env.RPC_URL || 'https://alfajores-forno.celo-testnet.org',
        maonoContractAddress: process.env.MAONO_CONTRACT_ADDRESS || 'Not configured',
      },
      // Feature flags
      features: featureFlags,
      // Rate limits (from database or defaults)
      rateLimits: configMap.rateLimits || {
        login: 5,
        register: 3,
        apiDefault: 100,
      },
    };

    res.json({
      success: true,
      settings,
      source: configRecords.length > 0 ? 'database' : 'environment',
    });
  } catch (error) {
    logger.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings - Update system settings (persisted to database)
router.put('/settings', requireSuperAdmin, async (req, res) => {
  try {
    const { section, key, value } = req.body;
    const adminId = (req.user as any)?.id;

    if (!section || !key || value === undefined) {
      return res.status(400).json({ error: 'section, key, and value are required' });
    }

    const configKey = `${section}.${key}`;

    // Check if config exists
    const existing = await db
      .select()
      .from(config)
      .where(eq(config.key, configKey))
      .limit(1);

    let result;
    if (existing.length > 0) {
      // Update existing config
      result = await db
        .update(config)
        .set({ value, updatedAt: new Date() })
        .where(eq(config.key, configKey))
        .returning();
    } else {
      // Insert new config
      result = await db
        .insert(config)
        .values({ key: configKey, value })
        .returning();
    }

    // Log audit trail
    if (adminId) {
      await db.insert(auditLogs).values({
        userId: adminId,
        action: 'UPDATE_SETTINGS',
        resource: 'config',
        resourceId: configKey,
        method: 'PUT',
        endpoint: '/api/admin/settings',
        ipAddress: (req.ip || 'unknown'),
        userAgent: (req.get('user-agent') || 'unknown'),
        status: 200,
        details: { section, key, oldValue: existing.length > 0 ? existing[0].value : null, newValue: value },
        severity: 'medium',
        category: 'settings',
      });
    }

    logger.info('System settings updated and persisted to database', {
      configKey,
      value,
      adminId,
    });

    res.json({
      success: true,
      message: 'Settings updated and persisted to database',
      updated: result[0],
    });
  } catch (error) {
    logger.error('Error updating system settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// =====================================================
// SECURITY & AUDIT
// =====================================================

// GET /api/admin/security/sessions - Get all active sessions
router.get('/security/sessions', requireSuperAdmin, async (req, res) => {
  try {
    const activeSessions = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        userEmail: users.email,
        userName: users.username,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.userId, users.id))
      .where(gte(sessions.expiresAt, new Date()))
      .orderBy(desc(sessions.createdAt))
      .limit(100);

    res.json({ sessions: activeSessions });
  } catch (error) {
    logger.error('Error fetching active sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /api/admin/security/sessions/:sessionId - Revoke a session
router.delete('/security/sessions/:sessionId', requireSuperAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const adminId = (req.user as any).id;

    await db.delete(sessions).where(eq(sessions.id, sessionId));

    logger.info('Session revoked by admin', { sessionId, adminId });

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    logger.error('Error revoking session:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// GET /api/admin/security/audit - Get security audit report
router.get('/security/audit', requireSuperAdmin, async (req, res) => {
  try {
    // Failed login attempts (mock - would need actual tracking)
    const failedLogins = 0;
    
    // Users with super_admin role
    const adminUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.roles, 'super_admin'));
    
    // Banned users
    const bannedUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isBanned, true));
    
    // Active sessions
    const activeSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(gte(sessions.expiresAt, new Date()));

    const auditReport = {
      timestamp: new Date().toISOString(),
      security: {
        failedLoginAttempts: failedLogins,
        adminUserCount: adminUsers[0].count,
        bannedUserCount: bannedUsers[0].count,
        activeSessionCount: activeSessions[0].count,
      },
      recommendations: [
        failedLogins > 100 && 'High number of failed login attempts detected',
        adminUsers[0].count > 5 && 'Consider limiting the number of super admin users',
      ].filter(Boolean),
    };

    res.json(auditReport);
  } catch (error) {
    logger.error('Error generating security audit:', error);
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

export default router;

