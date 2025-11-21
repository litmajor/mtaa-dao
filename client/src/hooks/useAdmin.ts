import { useState, useCallback } from 'react';
import {
  AnalyticsMetrics,
  SystemHealth,
  SystemSettings,
  AdminUser,
  BetaAccessUser,
  DAO,
  AuditLog,
  PaginationParams,
  PaginatedResponse,
  AdminApiResponse,
} from '../types/admin';

const API_BASE = '/api/admin';

export function useAdminAnalytics() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMetrics(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  return { metrics, loading, error, fetchMetrics };
}

export function useAdminHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setHealth(data.data?.health);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
    } finally {
      setLoading(false);
    }
  }, []);

  return { health, loading, error, fetchHealth };
}

export function useAdminSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSettings(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<SystemSettings>) => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setSettings(data.data);
        setError(null);
        return data.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update settings';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { settings, loading, error, fetchSettings, updateSettings };
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (params: Partial<PaginationParams> = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: (params.page || 1).toString(),
        limit: (params.limit || 20).toString(),
        ...(params.sortBy && { sortBy: params.sortBy }),
        ...(params.sortOrder && { sortOrder: params.sortOrder }),
      });
      const response = await fetch(`${API_BASE}/users/list?${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setUsers(data.data.users);
      setPagination(data.data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const banUser = useCallback(async (userId: string, reason: string) => {
    try {
      const response = await fetch(`${API_BASE}/users/${userId}/ban`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchUsers({ page: pagination.page, limit: pagination.limit });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to ban user';
      setError(message);
      throw err;
    }
  }, [fetchUsers, pagination.page, pagination.limit]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await fetchUsers({ page: pagination.page, limit: pagination.limit });
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      setError(message);
      throw err;
    }
  }, [fetchUsers, pagination.page, pagination.limit]);

  return { users, pagination, loading, error, fetchUsers, banUser, deleteUser };
}

export function useAdminBetaAccess() {
  const [users, setUsers] = useState<BetaAccessUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBetaUsers = useCallback(async (params: Partial<PaginationParams> = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: (params.page || 1).toString(),
        limit: (params.limit || 20).toString(),
      });
      const response = await fetch(`${API_BASE}/beta-access?${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setUsers(data.data.users);
      setPagination(data.data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch beta users');
    } finally {
      setLoading(false);
    }
  }, []);

  const grantBetaAccess = useCallback(
    async (userIds: string[], features: string[]) => {
      try {
        const response = await fetch(`${API_BASE}/beta-access/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ userIds, features }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await fetchBetaUsers({ page: pagination.page, limit: pagination.limit });
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to grant beta access';
        setError(message);
        throw err;
      }
    },
    [fetchBetaUsers, pagination.page, pagination.limit]
  );

  const revokeBetaAccess = useCallback(
    async (userIds: string[], features?: string[]) => {
      try {
        const response = await fetch(`${API_BASE}/beta-access/bulk`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ userIds, features }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await fetchBetaUsers({ page: pagination.page, limit: pagination.limit });
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke beta access';
        setError(message);
        throw err;
      }
    },
    [fetchBetaUsers, pagination.page, pagination.limit]
  );

  return { users, pagination, loading, error, fetchBetaUsers, grantBetaAccess, revokeBetaAccess };
}

export function useAdminDAOs() {
  const [daos, setDAOs] = useState<DAO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDAOs = useCallback(async (params: Partial<PaginationParams> = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: (params.page || 1).toString(),
        limit: (params.limit || 20).toString(),
      });
      const response = await fetch(`${API_BASE}/daos/list?${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setDAOs(data.data.daos);
      setPagination(data.data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch DAOs');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDAOStatus = useCallback(
    async (daoId: string, status: 'active' | 'inactive' | 'suspended') => {
      try {
        const response = await fetch(`${API_BASE}/daos/${daoId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await fetchDAOs({ page: pagination.page, limit: pagination.limit });
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update DAO status';
        setError(message);
        throw err;
      }
    },
    [fetchDAOs, pagination.page, pagination.limit]
  );

  return { daos, pagination, loading, error, fetchDAOs, updateDAOStatus };
}

export function useAdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (params: Partial<PaginationParams> = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: (params.page || 1).toString(),
        limit: (params.limit || 50).toString(),
      });
      const response = await fetch(`${API_BASE}/activity-logs?${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setLogs(data.data.logs);
      setPagination(data.data.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, pagination, loading, error, fetchLogs };
}
