import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/utils/authClient';

export type DaoRole = 'member' | 'proposer' | 'admin' | 'elder';

export interface DaoSummary {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  avatar?: string;
  role: DaoRole;
  memberCount?: number;
  treasuryUSD?: number;
  treasuryBalance?: number;
  isJoined?: boolean;
  isPrimary?: boolean;
  joinedAt?: string;
  createdAt?: string;
  recentActivity?: string;
  gradient?: string;
  type?: string;
}

interface DaoContextValue {
  daos: DaoSummary[];
  selectedDaoId: string | null;
  selectedDao: DaoSummary | null;
  isLoading: boolean;
  error: string | null;
  refreshDaos: () => Promise<void>;
  selectDao: (daoId: string) => void;
  clearSelectedDao: () => void;
}

const DaoContext = createContext<DaoContextValue | undefined>(undefined);

const STORAGE_KEY = 'mtaa_dao_selected_dao_id';

type DaoApiValue = Record<string, unknown> | null | undefined;

function normalizeDao(dao: DaoApiValue): DaoSummary {
  const id = String(dao?.id ?? dao?.daoId ?? '');

  return {
    id,
    name: String(dao?.name ?? 'Untitled DAO'),
    description: typeof dao?.description === 'string' ? dao.description : '',
    imageUrl: typeof dao?.imageUrl === 'string' ? dao.imageUrl : typeof dao?.avatar === 'string' ? dao.avatar : undefined,
    avatar: typeof dao?.avatar === 'string' ? dao.avatar : typeof dao?.imageUrl === 'string' ? dao.imageUrl : undefined,
    role: (String(dao?.userRole ?? dao?.role ?? 'member') as DaoRole),
    memberCount: Number(dao?.memberCount ?? dao?.membersCount ?? 0),
    treasuryUSD: Number(dao?.treasuryUSD ?? dao?.treasuryBalance ?? dao?.treasury ?? 0),
    treasuryBalance: Number(dao?.treasuryBalance ?? dao?.treasuryUSD ?? dao?.treasury ?? 0),
    isJoined: Boolean(dao?.isJoined ?? true),
    isPrimary: Boolean(dao?.isPrimary ?? false),
    joinedAt: typeof dao?.joinedAt === 'string' ? dao.joinedAt : undefined,
    createdAt: typeof dao?.createdAt === 'string' ? dao.createdAt : undefined,
    recentActivity: typeof dao?.recentActivity === 'string' ? dao.recentActivity : undefined,
    gradient: typeof dao?.gradient === 'string' ? dao.gradient : undefined,
    type: typeof dao?.type === 'string' ? dao.type : undefined,
  };
}

function pickDefaultDao(daos: DaoSummary[], preferredId?: string | null): string | null {
  if (!daos.length) return null;

  if (preferredId && daos.some((dao) => dao.id === preferredId)) {
    return preferredId;
  }

  const primary = daos.find((dao) => dao.isPrimary);
  if (primary) return primary.id;

  const joined = daos.find((dao) => dao.isJoined !== false);
  if (joined) return joined.id;

  return daos[0].id;
}

export function DaoProvider({
  children,
  userId,
  initialDaoId,
}: {
  children: React.ReactNode;
  userId?: string;
  initialDaoId?: string | null;
}) {
  const [daos, setDaos] = useState<DaoSummary[]>([]);
  const [selectedDaoId, setSelectedDaoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistSelectedDao = useCallback((daoId: string | null) => {
    if (typeof window === 'undefined') return;

    if (daoId) {
      localStorage.setItem(STORAGE_KEY, daoId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshDaos = useCallback(async () => {
    if (!userId) {
      setDaos([]);
      setSelectedDaoId(null);
      persistSelectedDao(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authClient.get<{ daos?: any[] } | any[]>('/api/users/my-daos');
      const list = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.daos)
          ? (response as any).daos
          : [];

      const normalized = list
        .map((entry: DaoApiValue) => normalizeDao(entry))
        .filter((dao: DaoSummary) => Boolean(dao.id));
      setDaos(normalized);

      const savedDaoId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const nextDaoId = pickDefaultDao(normalized, initialDaoId || savedDaoId);
      setSelectedDaoId(nextDaoId);
      persistSelectedDao(nextDaoId);
    } catch (err) {
      console.error('Failed to load your groups:', err);
      setDaos([]);
      setSelectedDaoId(null);
      setError(err instanceof Error ? err.message : 'Failed to load your groups');
    } finally {
      setIsLoading(false);
    }
  }, [initialDaoId, persistSelectedDao, userId]);

  useEffect(() => {
    void refreshDaos();
  }, [refreshDaos]);

  useEffect(() => {
    if (!initialDaoId || !daos.length) return;
    if (daos.some((dao) => dao.id === initialDaoId) && selectedDaoId !== initialDaoId) {
      setSelectedDaoId(initialDaoId);
      persistSelectedDao(initialDaoId);
    }
  }, [daos, initialDaoId, persistSelectedDao, selectedDaoId]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setSelectedDaoId(event.newValue || null);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const selectedDao = useMemo(() => {
    if (!selectedDaoId) return null;
    return daos.find((dao) => dao.id === selectedDaoId) || null;
  }, [daos, selectedDaoId]);

  const selectDao = useCallback((daoId: string) => {
    setSelectedDaoId(daoId);
    persistSelectedDao(daoId);
  }, [persistSelectedDao]);

  const clearSelectedDao = useCallback(() => {
    setSelectedDaoId(null);
    persistSelectedDao(null);
  }, [persistSelectedDao]);

  const value = useMemo<DaoContextValue>(() => ({
    daos,
    selectedDaoId,
    selectedDao,
    isLoading,
    error,
    refreshDaos,
    selectDao,
    clearSelectedDao,
  }), [daos, error, isLoading, refreshDaos, clearSelectedDao, selectDao, selectedDao, selectedDaoId]);

  return <DaoContext.Provider value={value}>{children}</DaoContext.Provider>;
}

export function useDaoContext() {
  const context = useContext(DaoContext);
  if (!context) {
    throw new Error('useDaoContext must be used within a DaoProvider');
  }
  return context;
}

export default DaoContext;
