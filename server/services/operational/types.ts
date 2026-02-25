/**
 * Operational Framework Types
 * Strict TypeScript interfaces for system mapping, auditing, and secure configuration
 * No narrative placeholders or speculative logic - all types are functional and auditable
 */

// ============================================================================
// SERVICE IDENTIFICATION & REGISTRY
// ============================================================================

export enum ServiceType {
  API_SERVER = 'api_server',
  DATABASE = 'database',
  CACHE = 'cache',
  MONITORING = 'monitoring',
  LOAD_BALANCER = 'load_balancer',
  AGENT_SYSTEM = 'agent_system',
  PAYMENT_GATEWAY = 'payment_gateway',
  BLOCKCHAIN_NODE = 'blockchain_node',
  WEBSOCKET_HUB = 'websocket_hub',
  MESSAGE_QUEUE = 'message_queue',
  LLM_SERVICE = 'llm_service',
  EXTERNAL_API = 'external_api',
}

export enum ServiceHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown',
}

export enum PrivilegeLevel {
  ROOT = 'root',
  ADMIN = 'admin',
  SERVICE = 'service',
  USER = 'user',
  GUEST = 'guest',
}

export enum TrustLevel {
  TRUSTED = 'trusted',
  UNTRUSTED = 'untrusted',
  CONDITIONAL = 'conditional',
}

/**
 * Core service instance representation
 * Immutable once created; updates tracked via audit trail
 */
export interface ServiceInstance {
  id: string; // UUID - unique service identifier
  name: string; // Human readable name (e.g., "Postgres API DB")
  type: ServiceType;
  host: string; // Hostname or IP
  port: number;
  protocol: 'http' | 'https' | 'tcp' | 'udp' | 'ws' | 'wss';
  version?: string; // Service version if available
  healthCheckUrl?: string; // Endpoint to verify health
  healthCheckMethod?: 'GET' | 'POST';
  responseExpectation?: number; // Expected HTTP status code (default 200)
  lastHealthCheck?: Date;
  healthStatus: ServiceHealthStatus;
  responseTimes?: number[]; // Last 10 response times in ms for trend analysis
  
  // Trust & privilege relationships
  trustLevel: TrustLevel;
  privilegeLevel: PrivilegeLevel;
  canAccess: string[]; // Array of service IDs this can access
  canBeAccessedBy: string[]; // Array of service IDs that can access this
  
  // Metadata
  owner?: string; // Team/service owner
  description?: string;
  dependencies: string[]; // Service IDs this depends on
  criticalityLevel: 'critical' | 'high' | 'medium' | 'low';
  createdAt: Date;
  discoveredAt: Date;
  lastModifiedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ServiceRegistry {
  services: Map<string, ServiceInstance>;
  lastUpdated: Date;
  sourceAgent: string; // Which system component performed the discovery
}

// ============================================================================
// AUDIT & ACCOUNTABILITY
// ============================================================================

export enum AuditActionType {
  SERVICE_DISCOVERED = 'service_discovered',
  SERVICE_LOST = 'service_lost',
  SERVICE_HEALTH_CHANGED = 'service_health_changed',
  CONFIG_CHANGED = 'config_changed',
  CREDENTIAL_ROTATED = 'credential_rotated',
  PRIVILEGE_GRANTED = 'privilege_granted',
  PRIVILEGE_REVOKED = 'privilege_revoked',
  REMEDIATION_EXECUTED = 'remediation_executed',
  AUDIT_LOG_ACCESSED = 'audit_log_accessed',
  ARCHITECTURE_VALIDATED = 'architecture_validated',
  SECRET_ACCESSED = 'secret_accessed',
  DEPLOYMENT_INITIATED = 'deployment_initiated',
}

export interface AuditEvent {
  id: string; // UUID
  timestamp: Date;
  action: AuditActionType;
  actor: string; // User, service, or system
  targetService?: string; // Service ID affected
  targetResource?: string; // Database, config file, etc.
  
  // State transition
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  
  // Signature for immutability validation
  eventHash: string; // SHA256(timestamp + action + actor + previousState + newState)
  previousEventHash?: string; // Hash chain for integrity
  
  description?: string;
  metadata?: Record<string, unknown>;
  
  // For critical operations
  requiresApproval: boolean;
  approvedBy?: string;
  approvalTimestamp?: Date;
}

export interface AuditTrail {
  events: AuditEvent[];
  lastEventHash: string;
  integrityVerified: boolean;
}

// ============================================================================
// SECURE CONFIGURATION & SECRETS MANAGEMENT
// ============================================================================

export enum CredentialType {
  API_KEY = 'api_key',
  DATABASE_PASSWORD = 'database_password',
  JWT_SECRET = 'jwt_secret',
  PRIVATE_KEY = 'private_key',
  OAUTH_TOKEN = 'oauth_token',
  WEBHOOK_SECRET = 'webhook_secret',
  TLS_CERTIFICATE = 'tls_certificate',
  SERVICE_ACCOUNT_KEY = 'service_account_key',
}

export enum SecretRotationPolicy {
  NEVER = 'never',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  DAILY = 'daily',
  ON_DEMAND = 'on_demand',
}

/**
 * Secure credential storage
 * Never persisted to disk or logs; only in-memory or encrypted vault storage
 */
export interface SecureCredential {
  id: string; // UUID
  serviceId: string; // Which service this belongs to
  credentialType: CredentialType;
  
  // Metadata only - secret never stored in this object
  secretHash: string; // SHA256 of secret for verification without revealing secret
  
  rotationPolicy: SecretRotationPolicy;
  lastRotated: Date;
  nextRotationDue: Date;
  expiresAt?: Date;
  
  // Usage tracking (accessed timestamps, not the secret itself)
  lastAccessedAt?: Date;
  accessCount: number;
  accessedByServices: string[]; // Service IDs that have accessed
  
  isExpired: boolean;
  isCompromised?: boolean;
}

export interface SecureVault {
  credentials: Map<string, SecureCredential>;
  rotationSchedule: Map<string, Date>; // Service ID -> next rotation date
  driftDetections: DriftDetection[]; // Found hardcoded secrets
}

export interface DriftDetection {
  id: string;
  detectedAt: Date;
  type: 'hardcoded_secret' | 'missing_credential' | 'expired_credential' | 'unused_credential';
  location: string; // File path or service
  severity: 'critical' | 'high' | 'medium' | 'low';
  remediation: string; // Suggested fix
  resolved: boolean;
}

// ============================================================================
// SYSTEM TOPOLOGY & ARCHITECTURE MODELING
// ============================================================================

export enum DependencyType {
  HTTP_REQUEST = 'http_request',
  DATABASE_QUERY = 'database_query',
  CACHE_ACCESS = 'cache_access',
  WEBSOCKET = 'websocket',
  MESSAGE_QUEUE = 'message_queue',
  BLOCKCHAIN_RPC = 'blockchain_rpc',
  WEBHOOK = 'webhook',
  EXTERNAL_API = 'external_api',
}

export interface ServiceDependency {
  sourceServiceId: string;
  targetServiceId: string;
  type: DependencyType;
  dataClassification: 'public' | 'internal' | 'confidential' | 'secret';
  privilegeRequired: PrivilegeLevel;
  isAuthenticatedConnection: boolean;
  
  // Risk indicators
  potentialEscalationPath: boolean;
  circularDependency: boolean;
}

export interface SystemMetadata {
  id: string;
  version: string; // Versioned snapshots
  capturedAt: Date;
  services: ServiceInstance[];
  dependencies: ServiceDependency[];
  privilegeMatrix: Record<string, string[]>; // {sourceServiceId: [targetServiceId, ...]}
  
  // Gap analysis
  expectedServices: ServiceInstance[];
  missingServices: ServiceInstance[];
  unexpectedServices: ServiceInstance[];
  
  // Integrity indicators
  topologyHash: string; // SHA256 of full topology for change detection
  previousTopologyHash?: string;
  changesSinceLastCapture?: string[];
}

export interface DependencyGraph {
  nodes: Map<string, ServiceInstance>;
  edges: Map<string, ServiceDependency[]>; // Source service ID -> dependencies
  cycles: string[][]; // Circular dependency chains
  riskZones: RiskZone[];
}

export interface RiskZone {
  serviceIds: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  escalationPaths: string[][];
}

// ============================================================================
// VALIDATION & GAP DETECTION
// ============================================================================

export interface ArchitectureGap {
  id: string;
  detectedAt: Date;
  category: 'missing_component' | 'broken_dependency' | 'unhealthy_service' | 'privilege_violation' | 'config_drift' | 'communication_failure';
  severity: 'critical' | 'warning' | 'info';
  affectedServices: string[];
  description: string;
  impact: string;
  suggestedRemediation: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ArchitectureValidationReport {
  id: string;
  generatedAt: Date;
  systemMetadata: SystemMetadata;
  gaps: ArchitectureGap[];
  healthStatus: 'healthy' | 'degraded' | 'critical';
  
  // Statistics
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  offlineServices: number;
  totalDependencies: number;
  brokenDependencies: number;
  circularDependencies: number[];
  
  recommendations: string[];
}

// ============================================================================
// REMEDIATION & RECOVERY
// ============================================================================

export enum RemediationType {
  RESTART_SERVICE = 'restart_service',
  REPROVISION_CONNECTION = 'reprovision_connection',
  ROTATE_CREDENTIALS = 'rotate_credentials',
  SCALE_INSTANCE = 'scale_instance',
  FAILOVER = 'failover',
  REBUILD_CONNECTION_POOL = 'rebuild_connection_pool',
  CLEAR_CACHE = 'clear_cache',
  UPDATE_CONFIG = 'update_config',
  EMERGENCY_STOP = 'emergency_stop',
}

export interface RemediationAction {
  id: string;
  remediationType: RemediationType;
  targetServiceId: string;
  gapId: string; // Which gap this addresses
  
  // Execution control
  requiresApproval: boolean;
  executionMode: 'dry_run' | 'approved' | 'emergency';
  estimatedDuration?: number; // Milliseconds
  
  // State
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  
  // Results
  success: boolean;
  output?: string;
  errorMessage?: string;
  
  // Rate limiting
  previousAttemptsIn24h: number;
  maxAttemptsAllowedIn24h: number;
}

// ============================================================================
// OPERATIONAL STATE & MONITORING
// ============================================================================

export interface OperationalState {
  id: string;
  timestamp: Date;
  
  // Current state snapshot
  registry: ServiceRegistry;
  metadata: SystemMetadata;
  dependencyGraph: DependencyGraph;
  vault: SecureVault;
  
  // Change tracking
  recentAuditEvents: AuditEvent[];
  recentRemediations: RemediationAction[];
  recentGaps: ArchitectureGap[];
  
  // Indicators
  overallHealth: 'healthy' | 'degraded' | 'critical';
  lastValidationTime: Date;
  nextValidationTime: Date;
  
  // Warnings
  criticalAlerts: string[];
  warningAlerts: string[];
}

// ============================================================================
// CONFIGURATION & STARTUP
// ============================================================================

export interface OperationalFrameworkConfig {
  // Discovery settings
  discovery: {
    enabled: boolean;
    intervalMs: number; // How often to check service health
    healthCheckTimeout: number; // Milliseconds per check
    retryAttempts: number;
    expectedServices: Array<{
      name: string;
      type: ServiceType;
      host: string;
      port: number;
      protocol: string;
    }>;
  };

  // Audit settings
  audit: {
    enabled: boolean;
    storageBackend: 'postgresql' | 'file'; // Must be PostgreSQL for production
    immutabilityEnabled: boolean;
    hashChainVerification: boolean;
  };

  // Vault settings
  vault: {
    enabled: boolean;
    rotationEnabled: boolean;
    rotationIntervalDays: number;
    driftDetectionEnabled: boolean;
  };

  // Validation settings
  validation: {
    enabled: boolean;
    intervalMs: number;
    criticalityThreshold: 'critical' | 'high' | 'medium' | 'low';
  };

  // Remediation settings
  remediation: {
    enabled: boolean;
    requiresApprovalForDestructive: boolean;
    maxAttemptsPerService24h: number;
    autoRemediateNonDestructive: boolean;
  };
}

// ============================================================================
// ERROR & EXCEPTION TYPES
// ============================================================================

export class OperationalFrameworkError extends Error {
  constructor(
    message: string,
    public readonly category: string,
    public readonly severity: 'critical' | 'high' | 'medium' | 'low',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OperationalFrameworkError';
  }
}

export class ServiceDiscoveryError extends OperationalFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SERVICE_DISCOVERY', 'high', context);
    this.name = 'ServiceDiscoveryError';
  }
}

export class AuditIntegrityError extends OperationalFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUDIT_INTEGRITY', 'critical', context);
    this.name = 'AuditIntegrityError';
  }
}

export class VaultError extends OperationalFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VAULT_MANAGEMENT', 'critical', context);
    this.name = 'VaultError';
  }
}

export class RemediationError extends OperationalFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'REMEDIATION', 'high', context);
    this.name = 'RemediationError';
  }
}
