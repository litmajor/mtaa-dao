import { useState, useCallback } from "react";
import { Task } from "../../components/TaskBountyBoard";

// Example: Replace with real API calls
const mockTasks: Task[] = [
  {
    id: "1",
    title: "Write documentation",
    description: "Document the new voting system.",
    reward: 10,
    status: "open",
  },
  {
    id: "2",
    title: "Fix bug #42",
    description: "Resolve the wallet connection issue.",
    reward: 20,
    status: "claimed",
    claimer: "0x123...abc",
  },
];

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate claiming a task
  const claimTask = useCallback(async (taskId: string, claimer: string) => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API delay
      await new Promise((res) => setTimeout(res, 800));
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId && task.status === "open"
            ? { ...task, status: "claimed", claimer }
            : task
        )
      );
    } catch (e) {
      setError("Failed to claim task.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Simulate refreshing tasks
  const refreshTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Replace with real fetch
      await new Promise((res) => setTimeout(res, 500));
      setTasks(mockTasks);
    } catch (e) {
      setError("Failed to refresh tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    tasks,
    loading,
    error,
    claimTask,
    refreshTasks,
  };
}
