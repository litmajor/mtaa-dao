import React, { useCallback, useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { RoleProgressCard } from './RoleProgressCard';

export interface DAOCardProps {
  dao?: {
    id: string;
    name: string;
    description?: string;
    memberCount?: number;
    role?: 'member' | 'elder' | 'admin';
    treasury?: number;
    activityPoints?: number;
    promotionEligible?: boolean;
    type?: 'free' | 'short_term' | 'collective' | 'meta';
  };
  onVote?: (id: string) => void;
  onSend?: (id: string) => void;
  onManage?: (id: string) => void;
  onCreateProposal?: (id: string) => void;  onActivityClick?: (daoId: string) => void;  showRoleProgress?: boolean;
}

/**
 * DAOCard - Shows DAO information with role progress and quick actions
 * 
 * Features:
 * - DAO name, description, member count
 * - User's role in DAO
 * - Activity points progress (inline RoleProgressCard)
 * - Treasury balance (if available)
 * - Quick action buttons:
 *   - View (navigate to DAO page)
 *   - Create Proposal (only if Elder/Admin)
 *   - Vote
 *   - Send $
 *   - Manage
 * 
 * Used in:
 * - Okedi Dashboard "My DAOs" section
 * - DAO discovery/listing pages
 * - Member profile DAO list
 */
export function DAOCard({
  dao,
  onVote,
  onSend,
  onManage,
  onCreateProposal,
  showRoleProgress = true,
}: DAOCardProps) {
  const [hoverShowProgress, setHoverShowProgress] = useState(false);

  const handleVote = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onVote?.(dao?.id || '');
    },
    [dao?.id, onVote]
  );

  const handleSend = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onSend?.(dao?.id || '');
    },
    [dao?.id, onSend]
  );

  const handleManage = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onManage?.(dao?.id || '');
    },
    [dao?.id, onManage]
  );

  const handleCreateProposal = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onCreateProposal?.(dao?.id || '');
    },
    [dao?.id, onCreateProposal]
  );

  // Can create proposal if Elder or Admin
  const canCreateProposal = ['elder', 'admin'].includes(dao?.role || '');

  return (
    <Link to={`/dao/${dao?.id}`}>
      <div
        className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors cursor-pointer border border-slate-600"
        onMouseEnter={() => setHoverShowProgress(true)}
        onMouseLeave={() => setHoverShowProgress(false)}
      >
        {/* Header: DAO name + Role badge */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <h4 className="text-white font-semibold flex-1">{dao?.name || 'Unnamed DAO'}</h4>
          <Badge className="text-xs bg-blue-600/40 text-blue-200 flex-shrink-0">
            {dao?.role || 'member'}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-slate-300 text-sm mb-3 line-clamp-2">
          {dao?.description || 'A community DAO'}
        </p>

        {/* Role Progress Card - Inline View (shown on hover or always) */}
        {showRoleProgress && (
          <div className="mb-3 opacity-0 hover:opacity-100 transition-opacity">
            <RoleProgressCard
              currentRole={dao?.role as 'member' | 'elder' | 'admin'}
              activityPoints={dao?.activityPoints || 0}
              promotionEligible={dao?.promotionEligible || false}
              daoName={undefined}
              inline={true}
            />
          </div>
        )}

        {/* Info row: Members + Treasury */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-3 border-b border-slate-600">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {(dao?.memberCount || 0).toLocaleString()} members
          </span>

          {dao?.treasury !== undefined && (
            <span className="text-xs text-slate-400">
              💰 ${Number(dao.treasury).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {/* View DAO */}
          <Button size="xs" variant="outline" className="flex-1">
            View
          </Button>

          {/* Create Proposal - Only if Elder or Admin */}
          {canCreateProposal && (
            <Button
              size="xs"
              variant="outline"
              onClick={handleCreateProposal}
              className="flex-1 text-green-400 border-green-600/50 hover:bg-green-900/20"
              title="Create a proposal for this DAO"
            >
              ➕ Propose
            </Button>
          )}

          {/* Vote */}
          <Button size="xs" variant="outline" onClick={handleVote} className="flex-1">
            Vote
          </Button>

          {/* Send Money */}
          <Button size="xs" variant="outline" onClick={handleSend} className="flex-1">
            Send $
          </Button>

          {/* Manage (Admin only) */}
          {dao?.role === 'admin' && (
            <Button
              size="xs"
              variant="outline"
              onClick={handleManage}
              className="flex-1 text-red-400 border-red-600/50 hover:bg-red-900/20"
            >
              ⚙️ Admin
            </Button>
          )}
        </div>

        {/* Role Progress Bar - Always visible below buttons */}
        {showRoleProgress && dao?.role === 'member' && (
          <div className="mt-3 pt-3 border-t border-slate-600">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs font-semibold text-gray-300">Activity Progress</p>
              <p className="text-xs font-bold text-gray-400">
                {dao.activityPoints || 0}/50
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 transition-all duration-300"
                style={{ width: `${Math.min(((dao.activityPoints || 0) / 50) * 100, 100)}%` }}
              />
            </div>
            {dao.promotionEligible && (
              <p className="text-xs text-green-400 font-semibold mt-1">
                ✅ You qualify for Elder status!
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default DAOCard;
