/**
 * Morio Data Hub Type Definitions
 * 
 * Comprehensive type system for all Morio components
 */

/**
 * Dashboard metric severity levels
 */
export type MetricSeverity = 'success' | 'warning' | 'danger' | 'info';

/**
 * Data trend directions
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Single dashboard metric
 */
export interface DashboardMetric {
  label: string;
  value: string | number;
  unit: string;
  trend?: TrendDirection;
  severity?: MetricSeverity;
  percentChange?: number;
  description?: string;
}

/**
 * Complete dashboard section
 */
export interface DashboardSection {
  section: 'elders' | 'agents' | 'nutu-kwetu' | 'treasury' | 'governance';
  title: string;
  description: string;
  icon: string;
  data: DashboardMetric[];
  lastUpdated: string;
}

/**
 * Complete dashboard view
 */
export interface DashboardData {
  success: boolean;
  sections: {
    elders: DashboardSection;
    agents: DashboardSection;
    community: DashboardSection;
    treasury: DashboardSection;
    governance: DashboardSection;
  };
  aggregatedMetrics: {
    overallHealth: number;
    systemStatus: string;
    activeThreats: number;
    memberEngagement: number;
  };
  timestamp: string;
}

/**
 * System health component status
 */
export interface ComponentStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime?: number;
  latency?: number;
  errorRate?: number;
  lastCheck: string;
}

/**
 * Overall system status
 */
export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, ComponentStatus>;
  aggregatedMetrics: {
    avgUptime: number;
    avgLatency: number;
    totalRequests: number;
    totalErrors: number;
  };
  lastCheck: string;
}

/**
 * Real-time alert
 */
export interface Alert {
  id: string;
  severity: MetricSeverity;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    link?: string;
    callback?: () => void;
  };
  section?: string;
  daoId?: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  uptime: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  requestsPerSecond: number;
  errorRate: number;
  throughput: number;
  activeConnections: number;
  lastUpdate: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  keys: number;
  hitRate: number;
  missRate: number;
  deletes: number;
  sets: number;
}

/**
 * Elders overview data
 */
export interface EldersOverview extends DashboardSection {
  section: 'elders';
  eldScry: {
    threatCount: number;
    uptime: number;
    activePolicies: number;
  };
  eldKaizen: {
    optimizations: number;
    avgResponseTime: number;
    successRate: number;
  };
  eldLumen: {
    totalReviewed: number;
    approvalRate: number;
    avgReviewTime: number;
  };
}

/**
 * Agents overview data
 */
export interface AgentsOverview extends DashboardSection {
  section: 'agents';
  activeAgents: number;
  totalAgents: number;
  agentStatuses: Array<{
    name: string;
    status: 'online' | 'offline';
    lastHeartbeat: string;
    messagesProcessed: number;
  }>;
  systemHealth: number;
}

/**
 * Community (Nutu-Kwetu) overview data
 */
export interface CommunityOverview extends DashboardSection {
  section: 'nutu-kwetu';
  memberCount: number;
  activeMembers: number;
  engagementRate: number;
  eventAttendance: number;
  communityScore: number;
}

/**
 * Treasury overview data
 */
export interface TreasuryOverview extends DashboardSection {
  section: 'treasury';
  totalBalance: number;
  monthlyBurnRate: number;
  runway: number;
  activeProposals: number;
  allocations: number;
  investmentPools: number;
}

/**
 * Governance overview data
 */
export interface GovernanceOverview extends DashboardSection {
  section: 'governance';
  activeProposals: number;
  votingParticipation: number;
  passedProposals: number;
  avgVoteDuration: number;
  delegateRate: number;
  policyUpdates: number;
}

/**
 * WebSocket subscription options
 */
export interface SubscriptionOptions {
  daoId?: string;
  section?: string;
  frequency?: 'realtime' | 'frequent' | 'standard' | 'rare';
}

/**
 * WebSocket event types
 */
export namespace WebSocketEvents {
  export const CONNECT = 'connect';
  export const DISCONNECT = 'disconnect';
  export const ERROR = 'error';
  
  export const SUBSCRIBE_DASHBOARD = 'subscribe:dashboard';
  export const SUBSCRIBE_ALERTS = 'subscribe:alerts';
  export const SUBSCRIBE_PERFORMANCE = 'subscribe:performance';
  export const SUBSCRIBE_SECTION = 'subscribe:section';
  
  export const UNSUBSCRIBE_DASHBOARD = 'unsubscribe:dashboard';
  export const UNSUBSCRIBE_ALERTS = 'unsubscribe:alerts';
  export const UNSUBSCRIBE_SECTION = 'unsubscribe:section';
  
  export const DATA_SYSTEM_STATUS = 'data:system-status';
  export const DATA_ALERTS = 'data:alerts';
  export const DATA_PERFORMANCE = 'data:performance';
  export const NEW_ALERT = 'new:alert';
  export const UPDATE_SECTION = 'update:section';
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Filter options for queries
 */
export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  severity?: MetricSeverity;
  section?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  refreshInterval: number; // ms
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
  realtimeUpdates: boolean;
  sections: {
    elders: boolean;
    agents: boolean;
    community: boolean;
    treasury: boolean;
    governance: boolean;
  };
}

/**
 * User dashboard preferences
 */
export interface DashboardPreferences {
  userId: string;
  daoId: string;
  pinnedMetrics: string[];
  hiddenSections: string[];
  alertsEnabled: boolean;
  realtimeEnabled: boolean;
  refreshInterval: number;
  theme: 'light' | 'dark';
}

/**
 * Historical data for charts
 */
export interface HistoricalData {
  timestamp: string;
  values: Record<string, number>;
}

/**
 * Chart data format
 */
export interface ChartData {
  label: string;
  data: HistoricalData[];
  description?: string;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv' | 'pdf';

/**
 * Export request
 */
export interface ExportRequest {
  sections: string[];
  format: ExportFormat;
  dateRange?: {
    start: string;
    end: string;
  };
  includeCharts?: boolean;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, {
    status: string;
    lastCheck: string;
  }>;
  uptime: number;
  version: string;
}
