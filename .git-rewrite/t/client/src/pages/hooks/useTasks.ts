import { useState, useEffect, useCallback } from "react";
import { Task } from "../../components/TaskBountyBoard";
import { useToast } from "../../components/ui/use-toast";

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTasks = useCallback(async (filters?: {
    daoId?: string;
    status?: string;
    category?: string;
    difficulty?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (filters?.daoId) params.append('daoId', filters.daoId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.difficulty) params.append('difficulty', filters.difficulty);
      
      const response = await fetch(`/api/tasks?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      
      const data = await response.json();
      setTasks(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const claimTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to claim task');
      }

      toast({
        title: "Success",
        description: "Task claimed successfully!",
      });

      // Refresh tasks
      await fetchTasks();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to claim task';
      toast({
        title: "Error", 
        description: errorMsg,
        variant: "destructive"
      });
      return false;
    }
  }, [fetchTasks]);

  const submitTask = useCallback(async (taskId: string, verification: {
    proofUrl: string;
    description: string;
    screenshots?: string[];
  }) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verification)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit task');
      }

      toast({
        title: "Success",
        description: "Task submitted for verification!",
      });

      await fetchTasks();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit task';
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
      return false;
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    claimTask,
    submitTask,
    refetch: fetchTasks
  };
};
