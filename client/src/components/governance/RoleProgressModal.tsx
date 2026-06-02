import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight,
  Calendar,
  MessageSquare,
  Users,
  Award,
  AlertCircle,
  BarChart2
} from 'lucide-react';

export interface ActivityRecord {
  id: string;
  type: 'vote_cast' | 'proposal_created' | 'comment' | 'meeting_attended' | 'task_completed' | 'member_invited';
  label: string;
  points: number;
  date: Date;
  metadata?: {
    proposalTitle?: string;
    daoName?: string;
    description?: string;
  };
}

export interface RoleProgressionRecord {
  fromRole: 'member' | 'elder';
  toRole: 'elder' | 'admin';
  date: Date;
  promotedBy: 'system' | 'admin' | 'request';
  reason?: string;
}

export interface RoleProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  daoName: string;
  daoId: string;
  currentRole: 'member' | 'elder' | 'admin';
  currentActivityPoints: number;
  activityHistory?: ActivityRecord[];
  promotionHistory?: RoleProgressionRecord[];
  memberSince: Date;
  onRequestPromotion?: () => void;
  onAcceptPromotion?: () => void;
  promotionEligible?: boolean;
}

/**
 * RoleProgressModal - Full page activity and role progression view
 * 
 * Shows:
 * - Full activity history with points breakdown
 * - Role progression timeline
 * - Member since date
 * - Contribution breakdown by category
 * - Promotion request interface
 * - Leaderboard position
 * 
 * Used in:
 * - Governance activity page
 * - DAO member management
 * - User profile
 * - Activity tracking dashboard
 */
export function RoleProgressModal({
  isOpen,
  onClose,
  daoName,
  daoId,
  currentRole,
  currentActivityPoints,
  activityHistory = [],
  promotionHistory = [],
  memberSince,
  onRequestPromotion,
  onAcceptPromotion,
  promotionEligible = false,
}: RoleProgressModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'history' | 'contribution'>('overview');

  // Calculate statistics
  const stats = useMemo(() => {
    const totalPoints = activityHistory.reduce((sum, a) => sum + a.points, 0);
    const daysActive = Math.floor((Date.now() - memberSince.getTime()) / (1000 * 60 * 60 * 24));
    const avgPointsPerDay = daysActive > 0 ? (totalPoints / daysActive).toFixed(1) : '0';
    
    // Activity breakdown
    const breakdown: Record<string, { count: number; points: number }> = {};
    activityHistory.forEach((activity) => {
      if (!breakdown[activity.type]) {
        breakdown[activity.type] = { count: 0, points: 0 };
      }
      breakdown[activity.type].count += 1;
      breakdown[activity.type].points += activity.points;
    });

    return {
      totalPoints,
      daysActive,
      avgPointsPerDay,
      breakdown,
    };
  }, [activityHistory, memberSince]);

  // Role config
  const roleConfig = {
    member: {
      emoji: '👤',
      label: 'Member',
      color: 'text-gray-400',
      bgColor: 'bg-gray-600/20',
      nextRole: 'Elder',
      nextEmoji: '👥',
    },
    elder: {
      emoji: '👥',
      label: 'Elder',
      color: 'text-purple-400',
      bgColor: 'bg-purple-600/20',
      nextRole: 'Admin',
      nextEmoji: '👑',
    },
    admin: {
      emoji: '👑',
      label: 'Admin',
      color: 'text-red-400',
      bgColor: 'bg-red-600/20',
      nextRole: null,
    },
  };

  const config = roleConfig[currentRole];

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Activity type labels and icons
  const activityTypeInfo: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    vote_cast: {
      label: 'Vote Cast',
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'text-blue-400',
    },
    proposal_created: {
      label: 'Proposal Created',
      icon: <Award className="h-4 w-4" />,
      color: 'text-green-400',
    },
    comment: {
      label: 'Comment',
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-yellow-400',
    },
    meeting_attended: {
      label: 'Meeting Attended',
      icon: <Users className="h-4 w-4" />,
      color: 'text-pink-400',
    },
    task_completed: {
      label: 'Task Completed',
      icon: <Trophy className="h-4 w-4" />,
      color: 'text-purple-400',
    },
    member_invited: {
      label: 'Member Invited',
      icon: <Users className="h-4 w-4" />,
      color: 'text-teal-400',
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            {daoName} - Your Activity & Role
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-2">
          {/* Current Role Card */}
          <div className={`p-6 rounded-lg border ${config.bgColor} border-slate-700`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300 mb-2">Current Role</p>
                <p className={`text-3xl font-bold ${config.color}`}>
                  {config.emoji} {config.label}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Member since {formatDate(memberSince)}
                  {stats.daysActive > 0 && ` (${stats.daysActive} days)`}
                </p>
              </div>

              <div className="text-right">
                <div className="mb-4">
                  <p className="text-sm text-gray-300">Activity Points</p>
                  <p className="text-4xl font-bold text-blue-400">
                    {currentActivityPoints}
                  </p>
                  {currentRole === 'member' && (
                    <p className="text-xs text-gray-400 mt-1">
                      {Math.max(0, 50 - currentActivityPoints)} more to Elder
                    </p>
                  )}
                </div>

                {promotionEligible && currentRole === 'member' && (
                  <Button
                    onClick={onAcceptPromotion}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                    size="sm"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Accept Elder Status
                  </Button>
                )}

                {!promotionEligible && currentRole === 'member' && (
                  <Button
                    onClick={onRequestPromotion}
                    variant="outline"
                    className="text-blue-400 border-blue-600"
                    size="sm"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Request Promotion
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-gray-400 mb-1">Total Points</p>
              <p className="text-2xl font-bold text-white">{stats.totalPoints}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-gray-400 mb-1">Days Active</p>
              <p className="text-2xl font-bold text-white">{stats.daysActive}</p>
              <p className="text-xs text-gray-500 mt-1">Since joining</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-gray-400 mb-1">Avg Points/Day</p>
              <p className="text-2xl font-bold text-white">{stats.avgPointsPerDay}</p>
              <p className="text-xs text-gray-500 mt-1">Consistency</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-gray-400 mb-1">Activities</p>
              <p className="text-2xl font-bold text-white">{activityHistory.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total logged</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-700">
            {[
              { id: 'overview' as const, label: '📊 Overview' },
              { id: 'activity' as const, label: '📝 Activity' },
              { id: 'history' as const, label: '📜 Role History' },
              { id: 'contribution' as const, label: '💎 Contribution' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Activity Progress */}
              {currentRole === 'member' && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <p className="text-sm font-semibold text-white mb-3">Path to Elder</p>
                  <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden mb-2">
                    <div
                      className="bg-blue-500 h-4 transition-all"
                      style={{ width: `${(currentActivityPoints / 50) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{currentActivityPoints}/50 points</span>
                    <span>{promotionEligible ? '✅ Ready!' : `${50 - currentActivityPoints} more needed`}</span>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-sm font-semibold text-white mb-3">Key Metrics</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Membership Duration</span>
                    <span className="text-white font-medium">
                      {Math.floor(stats.daysActive / 30)} months {stats.daysActive % 30} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Engagement Rate</span>
                    <span className="text-white font-medium">
                      {((stats.avgPointsPerDay as any) * 100).toFixed(0)}% of max
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Activity</span>
                    <span className="text-white font-medium">
                      {activityHistory.length > 0 ? formatDate(activityHistory[0].date) : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activityHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                activityHistory.map((activity) => {
                  const info = activityTypeInfo[activity.type];
                  return (
                    <div
                      key={activity.id}
                      className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`mt-1 flex-shrink-0 ${info.color}`}>
                            {info.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{info.label}</p>
                            {activity.metadata?.description && (
                              <p className="text-xs text-gray-400 line-clamp-2">
                                {activity.metadata.description}
                              </p>
                            )}
                            {activity.metadata?.proposalTitle && (
                              <p className="text-xs text-gray-400 line-clamp-1">
                                {activity.metadata.proposalTitle}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(activity.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-green-400">
                            +{activity.points}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {promotionHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No role changes yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {promotionHistory.map((record, idx) => (
                    <div key={idx} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{roleConfig[record.fromRole]?.emoji}</span>
                          <span className="text-xl">→</span>
                          <span className="text-lg">{roleConfig[record.toRole]?.emoji}</span>
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {roleConfig[record.fromRole]?.label} → {roleConfig[record.toRole]?.label}
                        </p>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>📅 {formatDate(record.date)}</p>
                        <p>
                          🔄 Promoted by:{' '}
                          <span className="text-gray-300">
                            {record.promotedBy === 'system'
                              ? 'Automatic (merit-based)'
                              : record.promotedBy === 'admin'
                              ? 'Admin'
                              : 'Your request'}
                          </span>
                        </p>
                        {record.reason && (
                          <p>
                            💬 Reason: <span className="text-gray-300">{record.reason}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'contribution' && (
            <div className="space-y-3">
              {Object.entries(stats.breakdown).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No contribution data</p>
                </div>
              ) : (
                Object.entries(stats.breakdown).map(([type, data]) => {
                  const info = activityTypeInfo[type as keyof typeof activityTypeInfo];
                  const percentage = (data.points / stats.totalPoints) * 100;
                  return (
                    <div key={type} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={info.color}>{info.icon}</span>
                        <p className="text-sm font-medium text-white">{info.label}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{data.count} activities</span>
                          <span>{data.points} points ({percentage.toFixed(0)}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* How to Earn More */}
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-300 mb-2">💡 How to Earn More Points</p>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>✅ Vote on proposals (5 pts each)</li>
                  <li>✅ Comment on proposals (3 pts each)</li>
                  <li>✅ Create proposals (15 pts each)</li>
                  <li>✅ Attend meetings (10 pts each)</li>
                  <li>✅ Complete DAO tasks (20 pts each)</li>
                  <li>✅ Invite members (10 pts when they join)</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
          <Button onClick={onClose} variant="outline" className="text-gray-300 border-slate-600">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RoleProgressModal;
