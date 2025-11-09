
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock, Unlock, Target, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface GoalVault {
  id: string;
  name: string;
  goalAmount: string;
  currentAmount: string;
  isLocked: boolean;
  lockedUntil?: string;
  progress: number;
}

export default function GoalVaultsManager({ daoId }: { daoId: string }) {
  const [vaults, setVaults] = useState<GoalVault[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVault, setNewVault] = useState({ name: '', goalAmount: '', lockUntilGoal: false });
  const { toast } = useToast();

  useEffect(() => {
    fetchGoalVaults();
  }, [daoId]);

  const fetchGoalVaults = async () => {
    try {
      const data = await apiGet(`/api/daos/${daoId}/goal-vaults`);
      setVaults(data);
    } catch (error) {
      console.error('Failed to fetch goal vaults:', error);
    }
  };

  const createGoalVault = async () => {
    try {
      await apiPost(`/api/daos/${daoId}/goal-vaults`, newVault);
      toast({ title: "Goal vault created successfully!" });
      setShowCreateModal(false);
      setNewVault({ name: '', goalAmount: '', lockUntilGoal: false });
      fetchGoalVaults();
    } catch (error) {
      toast({ title: "Failed to create vault", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Goal Vaults</h2>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-mtaa text-white">
              <Plus className="w-4 h-4 mr-2" />
              New Goal Vault
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Goal Vault</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Vault Name</Label>
                <Input
                  placeholder="e.g., Wedding Fund, Emergency Fund"
                  value={newVault.name}
                  onChange={(e) => setNewVault({ ...newVault, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Goal Amount (₭)</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={newVault.goalAmount}
                  onChange={(e) => setNewVault({ ...newVault, goalAmount: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="lockVault"
                  checked={newVault.lockUntilGoal}
                  onChange={(e) => setNewVault({ ...newVault, lockUntilGoal: e.target.checked })}
                />
                <Label htmlFor="lockVault">Lock until goal is reached</Label>
              </div>
            </div>
            <Button onClick={createGoalVault} className="w-full">Create Vault</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Primary Vault */}
      <Card className="border-l-4 border-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Primary Vault (Community Funds)</CardTitle>
            <Badge variant="outline" className="bg-blue-50">Primary</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">₭3,500</div>
          <p className="text-sm text-gray-500 mt-1">Available for general use</p>
        </CardContent>
      </Card>

      {/* Goal Vaults */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vaults.map((vault) => (
          <Card key={vault.id} className={vault.isLocked ? 'border-l-4 border-orange-500' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{vault.name}</CardTitle>
                {vault.isLocked ? (
                  <Lock className="w-5 h-5 text-orange-500" />
                ) : (
                  <Unlock className="w-5 h-5 text-green-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span className="font-medium">{vault.progress}%</span>
                </div>
                <Progress value={vault.progress} className="h-2" />
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-gray-500">Current</p>
                  <p className="text-xl font-bold">₭{vault.currentAmount}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Goal</p>
                  <p className="text-xl font-bold">₭{vault.goalAmount}</p>
                </div>
              </div>
              {vault.isLocked && (
                <Badge variant="outline" className="w-full justify-center">
                  Locked until goal reached
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
