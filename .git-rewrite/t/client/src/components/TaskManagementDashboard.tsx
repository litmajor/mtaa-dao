
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Eye, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskVerificationModal } from './TaskVerificationModal';
import { useTasks } from '../pages/hooks/useTasks';

interface TaskManagementDashboardProps {
  daoId: string;
  userRole: string;
}

export const TaskManagementDashboard: React.FC<TaskManagementDashboardProps> = ({
  daoId,
  userRole
}) => {
  const { tasks, loading, fetchTasks } = useTasks();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTasks({ daoId });
  }, [daoId, fetchTasks]);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const canCreateTasks = ['admin', 'moderator'].includes(userRole);
  const canVerifyTasks = ['admin', 'moderator'].includes(userRole);

  const handleVerifyTask = async (taskId: string, approved: boolean, feedback?: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, feedback })
      });

      if (!response.ok) {
        throw new Error('Failed to verify task');
      }

      fetchTasks({ daoId });
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertTriangle className="w-4 h-4 text-blue-500" />;
      case 'claimed': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'submitted': return <Eye className="w-4 h-4 text-purple-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Task Management</h2>
        {canCreateTasks && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Tasks</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Open</p>
                <p className="text-2xl font-bold text-blue-600">
                  {tasks.filter(t => t.status === 'open').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {tasks.filter(t => t.status === 'claimed').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="claimed">Claimed</TabsTrigger>
              <TabsTrigger value="submitted">Submitted</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTasks.map(task => (
              <div key={task.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{task.title}</h3>
                    <p className="text-gray-600 text-sm mt-1">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <Badge variant="outline">{task.status}</Badge>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{task.category}</Badge>
                  <Badge className={getDifficultyColor(task.difficulty)}>
                    {task.difficulty}
                  </Badge>
                  <Badge variant="outline">
                    {task.reward} cUSD
                  </Badge>
                  {task.estimatedTime && (
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {task.estimatedTime}
                    </Badge>
                  )}
                </div>

                {/* Action buttons */}
                {canVerifyTasks && task.status === 'submitted' && (
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleVerifyTask(task.id, true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleVerifyTask(task.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
            
            {filteredTasks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No tasks found for the selected filter.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateTaskModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        daoId={daoId}
        onTaskCreated={() => fetchTasks({ daoId })}
      />
      
      {selectedTask && (
        <TaskVerificationModal
          open={verifyModalOpen}
          onClose={() => setVerifyModalOpen(false)}
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          onVerificationSubmitted={() => fetchTasks({ daoId })}
        />
      )}
    </div>
  );
};
