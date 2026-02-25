import React, { useState } from 'react';
import { Trophy, TrendingUp, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type UserRole = 'member' | 'elder' | 'admin';

interface RoleProgressCardProps {
  /** Current user role in this DAO */
  currentRole: UserRole;
  /** Activity points earned in this DAO */
  activityPoints: number;
  /** Whether user is eligible for Elder promotion */
  promotionEligible: boolean;
  /** Called when user accepts Elder promotion */
  onAcceptPromotion?: () => void;
  /** Called when user requests promotion */
  onRequestPromotion?: () => void;
  /** Optional: Points needed for next role (default: 50 for member→elder) */
  pointsNeeded?: number;
  /** Optional: DAO name for context */
  daoName?: string;
  /** Optional: Whether to show inline (compact) or full view */
  inline?: boolean;
}

/**
 * RoleProgressCard - Shows user's role, activity points, and promotion eligibility
 * 
 * Used in:
 * 1. Governance Stats sidebar (compact inline view)
 * 2. DAO Cards (shows progress per DAO)
 * 3. Full governance page (detailed view)
 * 4. Role management modal (large view)
 * 
 * Features:
 * - Shows current role (Member/Elder/Admin)
 * - Shows activity points progress bar
 * - Shows promotion eligibility
 * - Accept/decline promotion flow
 * - Request early promotion option
 */
export function RoleProgressCard({
  currentRole,
  activityPoints,
  promotionEligible,
  onAcceptPromotion,
  onRequestPromotion,
  pointsNeeded = 50,
  daoName,
  inline = false,
}: RoleProgressCardProps) {
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionResponse, setPromotionResponse] = useState<'accept' | 'decline' | null>(null);

  // Only members can progress; Elders and Admins are at top
  const isMaxRole = currentRole === 'admin';
  const isMember = currentRole === 'member';
  const isElder = currentRole === 'elder';

  // Calculate progress
  const progress = isMember ? Math.min((activityPoints / pointsNeeded) * 100, 100) : 100;
  const pointsRemaining = Math.max(pointsNeeded - activityPoints, 0);

  // Role display configs
  const roleConfig = {
    member: {
      emoji: '👤',
      label: 'Member',
      color: 'text-gray-400',
      bgColor: 'bg-gray-600/20',
      borderColor: 'border-gray-500/30',
      progressColor: 'bg-blue-500',
    },
    elder: {
      emoji: '👥',
      label: 'Elder',
      color: 'text-purple-400',
      bgColor: 'bg-purple-600/20',
      borderColor: 'border-purple-500/30',
      progressColor: 'bg-purple-500',
    },
    admin: {
      emoji: '👑',
      label: 'Admin',
      color: 'text-red-400',
      bgColor: 'bg-red-600/20',
      borderColor: 'border-red-500/30',
      progressColor: 'bg-red-500',
    },
  };

  const config = roleConfig[currentRole];

  // Inline (compact) view - for Governance Stats sidebar
  if (inline) {
    return (
      <div className="bg-slate-700 rounded p-2 border border-slate-600">
        {/* Header: DAO name + Role */}
        <div className="flex justify-between items-start gap-2 mb-1">
          {daoName && (
            <p className="text-xs font-semibold text-white line-clamp-1 flex-1">{daoName}</p>
          )}
          <p className={`text-xs font-bold whitespace-nowrap ${config.color}`}>
            {config.emoji} {config.label}
          </p>
        </div>

        {/* Progress bar - only for members */}
        {isMember && (
          <>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-1">
              <div
                className={`${config.progressColor} h-2 transition-all duration-300`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-300">
                {activityPoints}/{pointsNeeded} points
              </p>
              {promotionEligible && (
                <span className="text-xs font-bold text-green-400">✅ Ready!</span>
              )}
            </div>
          </>
        )}

        {/* Elder status message */}
        {isElder && (
          <p className="text-xs text-purple-300 mt-1">
            You have leadership responsibilities
          </p>
        )}

        {/* Admin status message */}
        {isMaxRole && (
          <p className="text-xs text-red-300 mt-1">
            You have full control
          </p>
        )}
      </div>
    );
  }

  // Full view - for detailed cards and modals
  return (
    <div className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className={`h-5 w-5 ${config.color}`} />
          <p className="text-sm text-gray-300">Your Role</p>
        </div>
        <p className={`text-2xl font-bold ${config.color}`}>
          {config.emoji} {config.label}
        </p>
      </div>

      {/* Member Progress Section */}
      {isMember && (
        <>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-gray-200">Activity Score</p>
              <p className="text-sm font-bold text-gray-300">
                {activityPoints}/{pointsNeeded}
              </p>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`${config.progressColor} h-4 transition-all duration-300 rounded-full`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Status Message */}
          {promotionEligible ? (
            <div className="p-3 bg-green-900/30 border border-green-700/50 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-300">
                    You're eligible for Elder status!
                  </p>
                  <p className="text-xs text-green-200 mt-1">
                    You've earned enough activity points. Accept Elder status to unlock proposal creation.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-300">
                    {pointsRemaining} more points to unlock Elder
                  </p>
                  <p className="text-xs text-blue-200 mt-1">
                    Vote, comment, and participate to earn activity points. Help your DAO thrive!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* How to Earn Points */}
          <div className="mb-4 p-3 bg-slate-700 rounded-lg">
            <p className="text-xs font-semibold text-gray-200 mb-2">How to earn points:</p>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>✅ Vote on proposals (5 pts each)</li>
              <li>✅ Comment on proposals (3 pts each)</li>
              <li>✅ Attend meetings (10 pts)</li>
              <li>✅ Complete DAO tasks (20 pts)</li>
              <li>✅ Invite members who join (10 pts)</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {promotionEligible && (
              <>
                <Button
                  onClick={() => {
                    setShowPromotionModal(true);
                    setPromotionResponse('accept');
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept Elder Status
                </Button>
                <Button
                  onClick={() => setPromotionResponse('decline')}
                  variant="outline"
                  className="w-full text-gray-300 border-gray-600 hover:bg-gray-700"
                >
                  Maybe Later
                </Button>
              </>
            )}

            {!promotionEligible && (
              <Button
                onClick={onRequestPromotion}
                variant="outline"
                className="w-full text-blue-400 border-blue-600 hover:bg-blue-900/20"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Request Early Promotion
              </Button>
            )}
          </div>
        </>
      )}

      {/* Elder Section */}
      {isElder && (
        <>
          <div className="p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg mb-4">
            <p className="text-sm text-purple-200">
              You have leadership responsibilities in this DAO.
            </p>
          </div>

          <div className="p-3 bg-slate-700 rounded-lg mb-4">
            <p className="text-xs font-semibold text-gray-200 mb-2">You can:</p>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>✅ Create proposals (general & budget)</li>
              <li>✅ Vote with 2x weight</li>
              <li>✅ Create emergency proposals</li>
              <li>✅ Suggest members for promotion</li>
            </ul>
          </div>

          <Button
            onClick={onAcceptPromotion}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Ready to Lead
          </Button>
        </>
      )}

      {/* Admin Section */}
      {isMaxRole && (
        <>
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg mb-4">
            <p className="text-sm text-red-200">
              You have full administrative control of this DAO.
            </p>
          </div>

          <div className="p-3 bg-slate-700 rounded-lg">
            <p className="text-xs font-semibold text-gray-200 mb-2">You can:</p>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>✅ Create all proposal types</li>
              <li>✅ Execute proposals</li>
              <li>✅ Manage treasury & multi-sig</li>
              <li>✅ Add/remove members</li>
              <li>✅ Change governance settings</li>
            </ul>
          </div>
        </>
      )}

      {/* Promotion Response Modal */}
      {showPromotionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-sm w-full border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
              <h3 className="text-lg font-bold text-white">Congratulations!</h3>
            </div>

            <p className="text-gray-300 mb-6">
              You've earned Elder status through your active participation. This unlocks the ability to create proposals and help guide your DAO's future.
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => {
                  onAcceptPromotion?.();
                  setShowPromotionModal(false);
                  setPromotionResponse(null);
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                Accept & Continue
              </Button>
              <Button
                onClick={() => {
                  setShowPromotionModal(false);
                  setPromotionResponse(null);
                }}
                variant="outline"
                className="w-full text-gray-300 border-gray-600 hover:bg-gray-700"
              >
                Remind Me Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleProgressCard;
