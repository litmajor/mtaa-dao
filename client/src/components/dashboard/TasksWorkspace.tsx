import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Plus, CheckCircle, Timer, AlertCircle, Award, Filter } from 'lucide-react';
import TaskBountyBoard, { Task } from '../TaskBountyBoard';
import { useAuth } from '../../pages/hooks/useAuth';

const CreateTaskModal = lazy(() => import('../CreateTaskModal').then(module => ({ default: module.CreateTaskModal })));
const ClaimTaskModal = lazy(() => import('../ClaimTaskModal').then(module => ({ default: module.ClaimTaskModal })));
const TaskVerificationModal = lazy(() => import('../TaskVerificationModal').then(module => ({ default: module.TaskVerificationModal })));
interface TasksWorkspaceProps {
  daoId: string;
  userRole?: 'admin' | 'elder' | 'member';
}

type StatusFilter = 'all' | 'open' | 'claimed' | 'completed';

export default function TasksWorkspace({ daoId, userRole = 'member' }: TasksWorkspaceProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'board' | 'mine' | 'manage'>('board');

  const isPrivileged = userRole === 'admin' || userRole === 'elder';

  const fetchTasks = useCallback(async () => {
    if (!daoId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/daos/${daoId}/tasks${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTasks(data.tasks || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [daoId, statusFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleClaim = async (taskId: string) => {
    setClaimingTaskId(taskId);
  };

  const handleClaimConfirm = async (taskId: string) => {
    try {
      const res = await fetch(`/api/v1/daos/${daoId}/tasks/${taskId}/claim`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      setClaimingTaskId(null);
      await fetchTasks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleVerify = (taskId: string) => setVerifyingTaskId(taskId);

  const handleVerifyConfirm = async (taskId: string) => {
    try {
      const res = await fetch(`/api/v1/daos/${daoId}/tasks/${taskId}/verify`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      setVerifyingTaskId(null);
      await fetchTasks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCancel = async (taskId: string) => {
    if (!window.confirm('Cancel this task?')) return;
    try {
      const res = await fetch(`/api/v1/daos/${daoId}/tasks/${taskId}/cancel`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchTasks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Stats
  const openCount = tasks.filter((t) => t.status === 'open').length;
  const claimedCount = tasks.filter((t) => t.status === 'claimed').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalRewards = tasks
    .filter((t) => t.status === 'open')
    .reduce((s, t) => s + (t.reward || 0), 0);

  const myTasks = tasks.filter((t: any) => t.claimer === user?.id);

  const tabs = [
    { id: 'board' as const, label: '🏆 Bounty Board', count: openCount },
    { id: 'mine' as const, label: '📌 My Tasks', count: myTasks.length },
    ...(isPrivileged ? [{ id: 'manage' as const, label: '⚙️ Manage', count: tasks.length }] : []),
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            DAO Tasks & Bounties
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Complete tasks to earn rewards and contribute to the DAO
          </p>
        </div>
        {isPrivileged && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: openCount, icon: <AlertCircle className="h-4 w-4" />, color: 'text-blue-400' },
          { label: 'In Progress', value: claimedCount, icon: <Timer className="h-4 w-4" />, color: 'text-amber-400' },
          { label: 'Completed', value: completedCount, icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-400' },
          { label: 'Total Rewards', value: `$${totalRewards.toLocaleString()}`, icon: <Award className="h-4 w-4" />, color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-800/60 rounded-xl p-3 flex items-center gap-3">
            <span className={stat.color}>{stat.icon}</span>
            <div>
              <div className="text-xs text-slate-400">{stat.label}</div>
              <div className="text-lg font-bold text-white">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-purple-500' : 'bg-slate-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status Filter (board tab) */}
      {activeTab === 'board' && (
        <div className="flex gap-2 items-center flex-wrap">
          <Filter className="h-4 w-4 text-slate-400" />
          {(['all', 'open', 'claimed', 'completed'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {activeTab === 'board' && (
            <TaskBountyBoard
              tasks={tasks}
              onClaim={handleClaim}
            />
          )}

          {activeTab === 'mine' && (
            <div className="space-y-3">
              {myTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Award className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>You haven't claimed any tasks yet.</p>
                  <button
                    onClick={() => setActiveTab('board')}
                    className="mt-3 text-purple-400 hover:text-purple-300 text-sm underline"
                  >
                    Browse the bounty board →
                  </button>
                </div>
              ) : (
                myTasks.map((t: any) => (
                  <div key={t.id} className="bg-slate-800/60 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{t.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{t.category} · Reward: ${t.reward}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      t.status === 'claimed' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'manage' && isPrivileged && (
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>No tasks yet. Create the first one!</p>
                </div>
              ) : (
                tasks.map((t: any) => (
                  <div key={t.id} className="bg-slate-800/60 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{t.title}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {t.category} · ${t.reward} · {t.difficulty}
                        {t.claimer && ` · Claimed by ${t.claimer}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        t.status === 'open' ? 'bg-blue-500/20 text-blue-300' :
                        t.status === 'claimed' ? 'bg-amber-500/20 text-amber-300' :
                        t.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                        'bg-slate-600 text-slate-300'
                      }`}>
                        {t.status}
                      </span>
                      {t.status === 'claimed' && (
                        <button
                          onClick={() => handleVerify(t.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                        >
                          Verify
                        </button>
                      )}
                      {t.status !== 'completed' && t.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancel(t.id)}
                          className="px-2 py-1 bg-red-800/50 hover:bg-red-700/60 text-red-300 rounded text-xs"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Suspense fallback={null}>
        {showCreateModal && (
          <CreateTaskModal
            open={true}
            daoId={daoId}
            onClose={() => setShowCreateModal(false)}
            onTaskCreated={() => { setShowCreateModal(false); fetchTasks(); }}
          />
        )}
        {claimingTaskId && (
          <ClaimTaskModal
            open={true}
            taskTitle={tasks.find(t => t.id === claimingTaskId)?.title || ''}
            onClose={() => setClaimingTaskId(null)}
            onConfirm={() => handleClaimConfirm(claimingTaskId!)}
          />
        )}
        {verifyingTaskId && (
          <TaskVerificationModal
            open={true}
            taskId={verifyingTaskId}
            taskTitle={tasks.find(t => t.id === verifyingTaskId)?.title || ''}
            onClose={() => setVerifyingTaskId(null)}
            onVerificationSubmitted={() => handleVerifyConfirm(verifyingTaskId!)}
          />
        )}
      </Suspense>
    </div>
  );
}
