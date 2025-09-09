import React, { useState } from "react";
import TaskBountyBoard, { Task } from "../components/TaskBountyBoard";
import { ClaimTaskModal } from "../components/ClaimTaskModal";
import { useTasks } from "./hooks/useTasks";

// Example: Replace with actual user address from auth context or wallet
const mockUserAddress = "0xYourWalletAddress";

const TaskBountyBoardPage: React.FC = () => {
  const { tasks, loading, error, claimTask } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const handleClaim = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setModalOpen(true);
    }
  };

  const handleConfirmClaim = async () => {
    if (!selectedTask) return;
    setClaiming(true);
    await claimTask(selectedTask.id, mockUserAddress);
    setClaiming(false);
    setModalOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <TaskBountyBoard tasks={tasks} onClaim={handleClaim} />
      <ClaimTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmClaim}
        taskTitle={selectedTask?.title || ""}
        loading={claiming}
      />
    </div>
  );
};

export default TaskBountyBoardPage;
