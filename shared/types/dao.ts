/**
 * shared/types/dao.ts
 *
 * Single source of truth for DAO types used across the client.
 * Server-side: import { Dao, SelectDao, InsertDao, DaoType } from '../../shared/schema'
 * Client-side: import { ClientDAO, DaoType, ... } from '../../shared/types/dao'
 */

// -------------------------------------------------------------------
// Canonical DAO type union — matches the 6 active product DAO types
// and the `dao_type` column in the `daos` table.
// -------------------------------------------------------------------
export type DaoType =
  | 'harambee'
  | 'shortTerm'
  | 'savings'
  | 'community'
  | 'investment'
  | 'merryGoRound';

// -------------------------------------------------------------------
// ClientDAO – the shape every component should use when rendering DAO
// cards, lists, trees, etc. All fields are optional beyond id & name
// to allow partial data from different endpoints to satisfy the type.
// -------------------------------------------------------------------
export interface ClientDAO {
  /** Primary key (UUID) */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Short description */
  description?: string | null;
  /** Type of DAO */
  daoType?: DaoType | string | null;
  /** Emoji or image URL used as avatar */
  logo?: string | null;
  /** Image banner URL */
  bannerUrl?: string | null;
  /** Current member count */
  memberCount?: number | null;
  /** Treasury balance in cUSD/USD */
  treasuryBalance?: number | string | null;
  /** Lifecycle status */
  status?: 'active' | 'archived' | 'suspended' | string | null;
  /** Authenticated user role in this DAO */
  role?: 'founder' | 'admin' | 'elder' | 'member' | string | null;
  /** On-chain vault address */
  vaultAddress?: string | null;
  /** On-chain chama treasury address */
  chamaTreasuryAddress?: string | null;
  /** Whether DAO is publicly discoverable */
  isPublic?: boolean | null;
  /** UI gradient (computed client-side) */
  gradient?: string;
  /** Computed health score 0-100 */
  health?: number;
  /** Direction of health trend */
  trend?: 'improving' | 'stable' | 'declining';
  /** ISO timestamp of creation */
  createdAt?: string | Date | null;
  /** DAO governance stats (augmented client-side) */
  governance?: {
    participationRate?: number;
    proposalCount?: number;
    approvalRate?: number;
  };
  /** Number of active members (online / recently active) */
  activeMembers?: number;
}

// -------------------------------------------------------------------
// DaoListItem – lighter shape used in dropdown selects / sidebars
// -------------------------------------------------------------------
export interface DaoListItem {
  id: string;
  name: string;
  logo?: string | null;
  role?: string | null;
  memberCount?: number | null;
}

// -------------------------------------------------------------------
// UnifiedDashboardDao – shape used by UnifiedDashboard + DaoTreeSection
// -------------------------------------------------------------------
export interface UnifiedDashboardDao {
  id: string;
  name: string;
  memberCount: number;
  activeMembers: number;
  treasury: number;
  governance: {
    participationRate: number;
    proposalCount: number;
    approvalRate: number;
  };
  health: number;
  trend: 'improving' | 'stable' | 'declining';
}
