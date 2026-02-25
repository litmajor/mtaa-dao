/**
 * Governance Types & Interfaces
 *
 * Shared type definitions for Phase 2 governance system
 * Used across frontend, backend, and API contracts
 */

// ============================================
// ENUMS
// ============================================

export enum ActivityType {
  VOTE = 'vote',
  PROPOSAL = 'proposal',
  COMMENT = 'comment',
  MEETING = 'meeting',
  TASK = 'task',
  INVITE = 'invite',
}

export enum UserRole {
  MEMBER = 'member',
  ELDER = 'elder',
  ADMIN = 'admin',
}

export enum ProposalType {
  GENERAL = 'general',
  BUDGET = 'budget',
  POLL = 'poll',
  EMERGENCY = 'emergency',
}

export enum ProposalStatus {
  VOTING = 'voting',
  PASSED = 'passed',
  FAILED = 'failed',
  EXECUTED = 'executed',
}

export enum VoteType {
  FOR = 'for',
  AGAINST = 'against',
  ABSTAIN = 'abstain',
}

export enum PromotionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// ============================================
// ACTIVITY TYPES
// ============================================

export interface ActivityRecord {
  id: string;
  userId: string;
  daoId: string;
  type: ActivityType;
  points: number;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ActivityStats {
  totalPoints: number;
  daysActive: number;
  lastActivityDate: Date | null;
  activityBreakdown: Record<ActivityType, { count: number; points: number }>;
  averagePointsPerDay: number;
  totalPointsWithDecay?: number;
}

export interface ActivityHistoryItem {
  id: string;
  type: ActivityType;
  label: string;
  points: number;
  date: Date;
  metadata?: Record<string, any>;
}

// ============================================
// PROMOTION TYPES
// ============================================

export interface PromotionRecord {
  id: string;
  userId: string;
  daoId: string;
  fromRole: UserRole;
  toRole: UserRole;
  reason: string;
  promotedBy: 'system' | 'admin' | 'request';
  createdAt: Date;
}

export interface PromotionRequest {
  id: string;
  userId: string;
  daoId: string;
  currentRole: UserRole;
  requestedRole: UserRole;
  status: PromotionStatus;
  reason?: string;
  currentPoints: number;
  memberDays: number;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface PromotionEligibility {
  isEligible: boolean;
  currentRole: UserRole;
  nextRole?: UserRole;
  currentPoints: number;
  requiredPoints: number;
  pointsProgress: number; // 0-100
  memberDays: number;
  minimumDays: number;
  dayProgress: number; // 0-100
  blockers: string[];
}

// ============================================
// PROPOSAL TYPES
// ============================================

export interface ProposalDetails {
  id: string;
  title: string;
  description: string;
  type: ProposalType;
  status: ProposalStatus;
  daoId: string;
  daoName: string;
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  votingEndsAt: Date;
  currentVotes: {
    for: number;
    against: number;
    abstain: number;
  };
  votesRequired: number;
  yourVote?: VoteType;
  userVotingPower: number;
  votingDetails: {
    totalVoters: number;
    participationRate: number;
    quorumRequired: number;
  };
}

export interface ProposalResult {
  id: string;
  title: string;
  daoName: string;
  status: ProposalStatus;
  type: ProposalType;
  createdAt: Date;
  votingEndsAt: Date;
  votes: {
    for: number;
    against: number;
    abstain: number;
  };
  votesRequired: number;
  totalVoters: number;
  participationRate: number;
  quorumRequired: number;
  outcome?: {
    passedAt?: Date;
    failedAt?: Date;
    executedAt?: Date;
    margin: number; // percentage of votes
  };
  yourVote?: VoteType;
}

export interface ProposalVotePayload {
  proposalId: string;
  voteType: VoteType;
  votingPower: number;
}

// ============================================
// LEADERBOARD TYPES
// ============================================

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  daysActive: number;
  rank?: number;
}

export interface LeaderboardResponse {
  daoId: string;
  entries: LeaderboardEntry[];
  generatedAt: Date;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface AwardActivityRequest {
  userId: string;
  type: ActivityType;
  description: string;
  points?: number;
  metadata?: Record<string, any>;
}

export interface AwardActivityResponse {
  success: boolean;
  activity: ActivityRecord;
}

export interface GetActivityHistoryResponse {
  success: boolean;
  history: ActivityRecord[];
}

export interface GetActivityStatsResponse {
  success: boolean;
  stats: ActivityStats;
}

export interface GetLeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
}

export interface CheckEligibilityResponse {
  success: boolean;
  eligibility: PromotionEligibility;
}

export interface RequestPromotionPayload {
  reason?: string;
}

export interface RequestPromotionResponse {
  success: boolean;
  request: PromotionRequest;
}

export interface GetPromotionHistoryResponse {
  success: boolean;
  history: PromotionRecord[];
}

export interface AcceptPromotionPayload {
  requestId: string;
}

export interface AcceptPromotionResponse {
  success: boolean;
  promotion: PromotionRecord;
}

export interface RejectPromotionPayload {
  requestId: string;
  reason?: string;
}

export interface RejectPromotionResponse {
  success: boolean;
  message: string;
}

export interface SubmitVotePayload {
  voteType: VoteType;
  votingPower: number;
}

export interface SubmitVoteResponse {
  success: boolean;
  message: string;
  votes?: {
    for: number;
    against: number;
    abstain: number;
  };
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface RoleProgressCardProps {
  userId?: string;
  daoId?: string;
  mode?: 'inline' | 'full';
  showPoints?: boolean;
  onActivityClick?: () => void;
  compact?: boolean;
}

export interface RoleProgressModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  daoId: string;
}

export interface VoteProposalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: ProposalDetails;
  onVoteSuccess?: () => void;
  onClose?: () => void;
}

export interface ProposalResultsCardProps {
  proposal: ProposalResult;
  onViewDetails?: () => void;
  onExecute?: () => void;
  onViewProposal?: () => void;
  compact?: boolean;
}

// ============================================
// UTILITY TYPES
// ============================================

export type ActivityTypeLabel = {
  [key in ActivityType]: string;
};

export type RoleLabel = {
  [key in UserRole]: string;
};

export type ProposalTypeLabel = {
  [key in ProposalType]: string;
};

export type ProposalStatusLabel = {
  [key in ProposalStatus]: string;
};

export type VoteTypeLabel = {
  [key in VoteType]: string;
};

// ============================================
// CONSTANTS
// ============================================

export const ACTIVITY_POINTS: Record<ActivityType, number> = {
  [ActivityType.VOTE]: 5,
  [ActivityType.PROPOSAL]: 15,
  [ActivityType.COMMENT]: 3,
  [ActivityType.MEETING]: 10,
  [ActivityType.TASK]: 20,
  [ActivityType.INVITE]: 10,
};

export const ACTIVITY_LABELS: ActivityTypeLabel = {
  [ActivityType.VOTE]: 'Cast Vote',
  [ActivityType.PROPOSAL]: 'Create Proposal',
  [ActivityType.COMMENT]: 'Post Comment',
  [ActivityType.MEETING]: 'Attend Meeting',
  [ActivityType.TASK]: 'Complete Task',
  [ActivityType.INVITE]: 'Invite Member',
};

export const ROLE_LABELS: RoleLabel = {
  [UserRole.MEMBER]: 'Member',
  [UserRole.ELDER]: 'Elder',
  [UserRole.ADMIN]: 'Admin',
};

export const PROPOSAL_TYPE_LABELS: ProposalTypeLabel = {
  [ProposalType.GENERAL]: 'General Proposal',
  [ProposalType.BUDGET]: 'Budget Proposal',
  [ProposalType.POLL]: 'Poll',
  [ProposalType.EMERGENCY]: 'Emergency Proposal',
};

export const PROPOSAL_STATUS_LABELS: ProposalStatusLabel = {
  [ProposalStatus.VOTING]: 'Voting',
  [ProposalStatus.PASSED]: 'Passed',
  [ProposalStatus.FAILED]: 'Failed',
  [ProposalStatus.EXECUTED]: 'Executed',
};

export const VOTE_TYPE_LABELS: VoteTypeLabel = {
  [VoteType.FOR]: 'For',
  [VoteType.AGAINST]: 'Against',
  [VoteType.ABSTAIN]: 'Abstain',
};

export const PROMOTION_CONFIG = {
  [UserRole.MEMBER]: {
    nextRole: UserRole.ELDER,
    pointsRequired: 50,
    pointsWindow: 30,
    minMemberDays: 7,
    bonusPoints: 50,
  },
  [UserRole.ELDER]: {
    nextRole: UserRole.ADMIN,
    pointsRequired: 200,
    pointsWindow: 90,
    minMemberDays: 30,
    bonusPoints: 100,
  },
};

// ============================================
// TYPE GUARDS
// ============================================

export function isActivityType(value: unknown): value is ActivityType {
  return Object.values(ActivityType).includes(value as ActivityType);
}

export function isUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

export function isProposalType(value: unknown): value is ProposalType {
  return Object.values(ProposalType).includes(value as ProposalType);
}

export function isProposalStatus(value: unknown): value is ProposalStatus {
  return Object.values(ProposalStatus).includes(value as ProposalStatus);
}

export function isVoteType(value: unknown): value is VoteType {
  return Object.values(VoteType).includes(value as VoteType);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getActivityIcon(type: ActivityType): string {
  const icons: Record<ActivityType, string> = {
    [ActivityType.VOTE]: '👍',
    [ActivityType.PROPOSAL]: '📝',
    [ActivityType.COMMENT]: '💬',
    [ActivityType.MEETING]: '📅',
    [ActivityType.TASK]: '✅',
    [ActivityType.INVITE]: '🔗',
  };
  return icons[type];
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    [UserRole.MEMBER]: 'text-gray-400',
    [UserRole.ELDER]: 'text-yellow-400',
    [UserRole.ADMIN]: 'text-purple-400',
  };
  return colors[role];
}

export function getRoleBgColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    [UserRole.MEMBER]: 'bg-gray-900/30',
    [UserRole.ELDER]: 'bg-yellow-900/30',
    [UserRole.ADMIN]: 'bg-purple-900/30',
  };
  return colors[role];
}

export function getProposalTypeColor(type: ProposalType): string {
  const colors: Record<ProposalType, string> = {
    [ProposalType.GENERAL]: 'bg-blue-600/40 text-blue-200',
    [ProposalType.BUDGET]: 'bg-green-600/40 text-green-200',
    [ProposalType.POLL]: 'bg-yellow-600/40 text-yellow-200',
    [ProposalType.EMERGENCY]: 'bg-red-600/40 text-red-200',
  };
  return colors[type];
}

export function calculateVotePercentage(votes: number, total: number): number {
  if (total === 0) return 0;
  return (votes / total) * 100;
}

export function calculateDaysRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function calculateHoursRemaining(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60));
}

export function isVotingClosed(endDate: Date): boolean {
  return new Date() > endDate;
}

export function formatPoints(points: number): string {
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}k`;
  }
  return points.toString();
}

export function getProgressPercentage(current: number, required: number): number {
  if (required === 0) return 100;
  return Math.min(100, (current / required) * 100);
}
