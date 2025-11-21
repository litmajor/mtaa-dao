// Admin Dashboard Types

export interface AnalyticsMetrics {
  monthlyRevenue: number;
  quarterlyRevenue: number;
  annualRevenue: number;
  averageReputationScore: number;
  topReputationUsers: Array<{
    userId: string;
    username: string;
    score: number;
  }>;
  blockchainInfo: {
    blockNumber: string;
    chainId: string;
    status: 'healthy' | 'warning' | 'error';
  };
}

export interface SystemHealth {
  database: {
    status: 'healthy' | 'warning' | 'error';
    latency: number; // ms
    lastChecked: string;
  };
  blockchain: {
    status: 'healthy' | 'warning' | 'error';
    latency: number; // ms
    lastChecked: string;
    chainId: string;
  };
  payment: {
    status: 'healthy' | 'warning' | 'error';
    lastChecked: string;
    transactionStatus: string;
  };
}

export interface SystemSettings {
  platformSettings: {
    platform: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    maintenanceMode: boolean;
  };
  blockchainSettings: {
    rpcUrl: string;
    chainId: number;
    confirmationBlocks: number;
  };
  rateLimits: {
    requestsPerMinute: number;
    maxTransactionSize: number;
    dailyWithdrawalLimit: number;
  };
  featureFlags: {
    betaFeatures: boolean;
    newUI: boolean;
    advancedAnalytics: boolean;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'moderator' | 'super_admin';
  status: 'active' | 'inactive' | 'banned';
  createdAt: string;
  lastActive: string;
  reputation: number;
  activityCount: number;
}

export interface BetaAccessUser {
  userId: string;
  username: string;
  email: string;
  email_verified: boolean;
  features: string[];
  grantedAt: string;
  grantedBy: string;
}

export interface DAO {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'suspended';
  memberCount: number;
  treasuryBalance: number;
  createdAt: string;
  creator: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AdminApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
