// shared/types/dashboard.ts  

export interface BalanceSource {
  source: 'okedi' | 'exchange' | 'bank' | 'custodial' | 'subprofile' | 'dao' | 'escrow';
  custodyType: 'non-custodial' | 'custodial' | 'linked';
  amount: number;
  currency: string;
  label: string;
  description?: string;
  parentLabel?: string;
  updatedAt: string;
  status?: 'verified' | 'pending' | 'error';
  icon?: string;
}

export interface OkediDashboardData {
  selectedDaoId?: string;

  // Identity
  currentUser: {
    id: string;
    name: string;
    walletAddress?: string;
    votingPower?: number;
  };

  // Balance
  totalBalance: number;
  cryptoCurrency: string;        // 'cUSD'
  fiatCurrency: string;          // 'USD' | 'KES'
  balances?: BalanceSource[];    // optional until service constructs it

  // Scores
  trustScore: number;
  governanceScore: number;
  votesCount: number;
  proposalsCreated: number;
  memberSince: string;
  daoCount: number;
  memberCount?: number;
  treasuryExposure?: number;

  // KYC — add these to service from user table
  kycStatus: 'not-started' | 'pending' | 'verified';
  kycProgress: number;
  transferLimits: {
    daily: number;
    monthly: number;
    verifiedDaily: number;
    verifiedMonthly: number;
  };

  // DAOs — use server shape, not client's old DAOInfo
  myDAOs: Array<{
    id: string;
    name: string;
    description?: string;
    role: 'founder' | 'admin' | 'member' | 'elder' | 'proposer';
    memberCount: number;
    treasuryBalance: number;
    onboarding?: {
      complete: boolean;
      inviteSent: boolean;
      firstContribution: boolean;
      firstVote: boolean;
      walletConfigured: boolean;
    };
  }>;

  // Proposals — use server shape
  activeProposals: Array<{
    id: string;
    title: string;
    description?: string;
    votesRequired: number;
    currentVotes: number;
    status: 'draft' | 'active' | 'passed' | 'failed' | 'executed';
    daysLeft?: number;
    daoName?: string;
    daoId?: string;
    createdBy?: string;
  }>;

  // Transactions
  recentTransactions: Array<{
    id: string;
    type: 'send' | 'receive' | 'transfer' | 'deposit' | 'escrow' | 'referral_reward' | string;
    amount: number;
    currency: string;
    from?: string;
    to?: string;
    timestamp: string;
    status: 'pending' | 'confirmed' | 'completed' | 'failed';
    hash?: string;
  }>;

  // Escrows
  activeEscrows: Array<{
    id: string;
    amount: number;
    currency: string;
    description: string;
    status: 'locked' | 'pending-release' | 'released' | 'disputed' | 'pending';
    daysLeft: number;
    participantName?: string;
  }>;

  // Governance
  governanceStats: {
    votesCast: number;
    proposalsVoted: number;
    governancePower: number;
    daoMemberCount: number;
    influenceRank?: number;
  };

  // Referrals
  referralStats?: {
    totalEarnings: number;
    activeReferrals: number;
    referralLink: string;
    tier?: 'bronze' | 'silver' | 'gold';
  };

  // Chat
  daoChat?: {
    daoId: string;
    daoName: string;
    messages: Array<{
      id: string;
      author: string;
      text: string;
      timestamp: string;
    }>;
    unreadCount?: number;
  };

  // GlobalStateBar extras — add to service
  marketRegime?: 'bull' | 'bear' | 'neutral';
  pendingActionsCount?: number;
  connectedExchanges?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}
