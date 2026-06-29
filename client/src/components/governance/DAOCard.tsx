import React, { useCallback, useState } from 'react';
import { Users } from '../../lib/icons';
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
    role?: 'member' | 'elder' | 'admin' | 'founder' | 'secretary';
    treasury?: number;
    activityPoints?: number;
    promotionEligible?: boolean;
    type?: 'free' | 'short_term' | 'collective' | 'meta';
    // extended optional fields
    nextRoleThreshold?: number;
    governance?: { activeProposals?: number };
    lastActiveAt?: string; // ISO date string
    healthScore?: number; // 0 - 100
    membersDelta?: number; // change in members (weekly)
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
  // archetype accent mapping
  const archetypeAccent = (t?: string) => {
    switch (t) {
      case 'collective':
        return 'bg-emerald-400';
      case 'meta':
        return 'bg-sky-500';
      case 'short_term':
        return 'bg-amber-400';
      case 'free':
      default:
        return 'bg-slate-500';
    }
  };

  const accentClass = archetypeAccent(dao?.type);

  const initials = (name?: string) => {
    if (!name) return '🛡️';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const progressPercent = Math.min(100, ((dao?.activityPoints || 0) / (dao?.nextRoleThreshold || 50)) * 100);

  return (
    <div
      className={`relative bg-slate-800/40 rounded-lg p-4 transform transition duration-150 hover:-translate-y-0.5 hover:shadow-lg`} 
      onMouseEnter={() => setHoverShowProgress(true)}
      onMouseLeave={() => setHoverShowProgress(false)}
    >
        {/* Accent bar */}
        <div className={`absolute left-0 top-0 h-1 w-full rounded-t-lg ${accentClass}`} />

        {/* HEADER: Identity row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">{initials(dao?.name)}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link to={`/dao/${dao?.id}`} className="text-white font-semibold truncate hover:underline">{dao?.name || 'Unnamed DAO'}</Link>
                <Badge className="text-xs bg-white/6 text-white/90 ml-2">{dao?.type || 'free'}</Badge>
                {dao?.promotionEligible && <Badge className="text-xs bg-yellow-500 text-black ml-2">Promotion Ready</Badge>}
              </div>
              <div className="text-slate-400 text-xs mt-1 truncate">{dao?.description || 'A community DAO'}</div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Badge className="text-xs bg-slate-700/40 text-slate-200">{dao?.role || 'member'}</Badge>
          </div>
        </div>

        {/* METRICS ROW: compact stat capsules */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/30 text-xs text-slate-200"><Users className="w-3 h-3" />{(dao?.memberCount || 0).toLocaleString()} members</span>
            {dao?.treasury !== undefined && (
              <span className="px-2 py-0.5 rounded-full bg-slate-700/30 text-xs text-slate-200">${Number(dao.treasury).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-slate-700/20 text-xs text-slate-300">{dao?.activityPoints || 0} pts</span>
            {dao?.governance?.activeProposals !== undefined && (
              <span className="px-2 py-0.5 rounded-full bg-slate-700/20 text-xs text-slate-300">{dao.governance.activeProposals} proposals</span>
            )}
            {typeof dao?.membersDelta === 'number' && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${dao.membersDelta > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{dao.membersDelta > 0 ? `+${dao.membersDelta}` : dao.membersDelta} wk</span>
            )}
          </div>
        </div>

        {/* compact role progress (thin) - expands on hover to RoleProgressCard */}
        {showRoleProgress && (
          <div className="mt-3">
            <RoleProgressCard
              currentRole={(dao?.role as any) || 'member'}
              activityPoints={dao?.activityPoints || 0}
              promotionEligible={!!dao?.promotionEligible}
              pointsNeeded={dao?.nextRoleThreshold || 50}
              daoName={dao?.name}
              inline={true}
            />
            {hoverShowProgress && (
              <div className="mt-2">
                <RoleProgressCard
                  currentRole={(dao?.role as any) || 'member'}
                  activityPoints={dao?.activityPoints || 0}
                  promotionEligible={!!dao?.promotionEligible}
                  pointsNeeded={dao?.nextRoleThreshold || 50}
                  daoName={dao?.name}
                  inline={false}
                />
              </div>
            )}
          </div>
        )}

        {/* ACTIONS: prioritize Vote, then Open, then Proposal */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote(e as any); }}>Vote</Button>
            <Link to={`/dao/${dao?.id}`}>
              <Button size="sm" variant="outline" className="bg-purple-600 text-white hover:bg-purple-700">Open DAO</Button>
            </Link>
            {canCreateProposal && (
              <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateProposal(e as any); }}>Create Proposal</Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <details className="relative">
              <summary className="list-none cursor-pointer px-2 py-1 rounded-md text-sm text-slate-300 bg-slate-700/20">⋯</summary>
              <div className="absolute right-0 mt-2 w-40 bg-slate-800/60 rounded-md shadow-md p-2">
                <button className="w-full text-left text-sm px-2 py-1 hover:bg-slate-700/40 rounded" onClick={(e)=>{e.preventDefault(); e.stopPropagation(); handleSend(e as any);}}>Send</button>
                {dao?.role === 'admin' && <button className="w-full text-left text-sm px-2 py-1 hover:bg-slate-700/40 rounded" onClick={(e)=>{e.preventDefault(); e.stopPropagation(); handleManage(e as any);}}>Manage</button>}
              </div>
            </details>
          </div>
        </div>
      </div>
  );
}

export default DAOCard;
