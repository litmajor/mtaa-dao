import React, { useState } from "react";
import { Clock, DollarSign, User, CheckCircle, AlertCircle, Zap } from "lucide-react";

// Enhanced Task interface with additional properties
export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: "open" | "claimed" | "completed";
  claimer?: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  estimatedTime?: string;
  deadline?: string;
}

interface TaskBountyBoardProps {
  tasks: Task[];
  onClaim: (taskId: string) => void;
}

// Sample data for demonstration
const sampleTasks: Task[] = [
  {
    id: "1",
    title: "Build Landing Page Component",
    description: "Create a responsive landing page component with modern design patterns and animations",
    reward: 250,
    status: "open",
    difficulty: "medium",
    category: "Frontend",
    estimatedTime: "4-6 hours",
    deadline: "2 days"
  },
  {
    id: "2",
    title: "Smart Contract Audit",
    description: "Review and audit a DeFi smart contract for security vulnerabilities",
    reward: 500,
    status: "claimed",
    claimer: "0x742d35Cc6634C0532925a3b8D404d78e47C37C2c",
    difficulty: "hard",
    category: "Blockchain",
    estimatedTime: "8-12 hours",
    deadline: "5 days"
  },
  {
    id: "3",
    title: "API Integration Documentation",
    description: "Write comprehensive documentation for REST API integration with code examples",
    reward: 150,
    status: "completed",
    difficulty: "easy",
    category: "Documentation",
    estimatedTime: "2-3 hours",
    deadline: "1 day"
  },
  {
    id: "4",
    title: "Mobile App UI Design",
    description: "Design intuitive mobile interface for crypto wallet application",
    reward: 300,
    status: "open",
    difficulty: "medium",
    category: "Design",
    estimatedTime: "6-8 hours",
    deadline: "3 days"
  }
];

const TaskBountyBoard: React.FC<TaskBountyBoardProps> = ({ 
  tasks = sampleTasks, 
  onClaim = (taskId) => console.log(`Claimed task: ${taskId}`) 
}) => {
  const [filter, setFilter] = useState("all");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const filteredTasks = tasks.filter(task => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-green-100 text-green-800 border-green-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "hard": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Zap className="w-4 h-4 text-blue-500" />;
      case "claimed": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "completed": return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-50 border-blue-200 text-blue-800";
      case "claimed": return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "completed": return "bg-green-50 border-green-200 text-green-800";
      default: return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Task Bounty Board
          </h1>
          <p className="text-gray-600 text-lg">
            Discover and claim bounties for your skills
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Open Tasks</p>
                <p className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === 'open').length}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Rewards</p>
                <p className="text-2xl font-bold text-green-600">{tasks.reduce((sum, task) => sum + task.reward, 0)} cUSD</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-purple-600">{tasks.filter(t => t.status === 'completed').length}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["all", "open", "claimed", "completed"].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filter === status
                  ? "bg-blue-600 text-white shadow-lg scale-105"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Tasks Grid */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No tasks available for the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer ${
                  hoveredTask === task.id ? "ring-2 ring-blue-500 ring-opacity-50" : ""
                }`}
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
              >
                {/* Task Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{task.title}</h3>
                    <span className="inline-block px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {task.category}
                    </span>
                  </div>
                  <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(task.status)}`}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(task.status)}
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </div>
                  </div>
                </div>

                {/* Task Description */}
                <p className="text-gray-600 mb-4">{task.description}</p>

                {/* Task Details */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getDifficultyColor(task.difficulty)}`}>
                    {task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1)}
                  </span>
                  {task.estimatedTime && (
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {task.estimatedTime}
                    </span>
                  )}
                  {task.deadline && (
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      ⏰ {task.deadline}
                    </span>
                  )}
                </div>

                {/* Reward and Action */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">{task.reward}</span>
                    <span className="text-sm text-gray-500">cUSD</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {task.status === "open" ? (
                      <button
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={() => onClaim(task.id)}
                      >
                        Claim Task
                      </button>
                    ) : task.status === "claimed" ? (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">Claimed</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Completed</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Claimer Info */}
                {task.claimer && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <User className="w-4 h-4" />
                      <span>Claimed by: {task.claimer.slice(0, 6)}...{task.claimer.slice(-4)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskBountyBoard;