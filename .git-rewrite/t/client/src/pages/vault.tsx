import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Target, DollarSign, ArrowUpRight, Sparkles, Crown, Award, Zap, Eye } from 'lucide-react';

const EnhancedVaultPage = () => {
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // State for vaults and contributions
  const [vaults, setVaults] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [contributionStats, setContributionStats] = useState({
    totalContributions: 0,
    monthlyContributions: 0,
    currentStreak: 0
  });
  const [monthlyGoal, setMonthlyGoal] = useState(9500);

  useEffect(() => {
    async function fetchVaultData() {
      try {
        const vaultRes = await fetch('/api/wallet/vaults');
        const vaultData = await vaultRes.json();
        setVaults(vaultData);
        // Optionally, set monthly goal from API if available
        if (vaultData.length > 0 && vaultData[0].monthlyGoal) {
          setMonthlyGoal(parseFloat(vaultData[0].monthlyGoal));
        }
      } catch (e) {
        setVaults([]);
      }
    }
    async function fetchContributions() {
      try {
        const txRes = await fetch('/api/wallet/transactions');
        const txData = await txRes.json();
        setContributions(txData);
        // Calculate stats
        let total = 0, monthly = 0, streak = 0;
        const now = new Date();
        txData.forEach((tx: any) => {
          if (tx.type === 'deposit' || tx.type === 'received') {
            total += parseFloat(tx.amount);
            const txDate = new Date(tx.date);
            if (txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()) {
              monthly += parseFloat(tx.amount);
            }
            // Streak logic (simplified)
            if ((now.getTime() - txDate.getTime()) < 1000 * 60 * 60 * 24 * 2) {
              streak++;
            }
          }
        });
        setContributionStats({
          totalContributions: total,
          monthlyContributions: monthly,
          currentStreak: streak
        });
      } catch (e) {
        setContributions([]);
        setContributionStats({ totalContributions: 0, monthlyContributions: 0, currentStreak: 0 });
      }
    }
    fetchVaultData();
    fetchContributions();
  }, []);

  const totalBalance = vaults?.reduce((sum, vault) => sum + parseFloat((vault.balance || '0').replace(/,/g, '')), 0) || 0;
  const goalProgress = (totalBalance / monthlyGoal) * 100;

  const Card: React.FC<{ children: React.ReactNode; className?: string; hover?: boolean }> = ({ children, className = "", hover = false }) => (
    <div className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 ${hover ? 'hover:shadow-2xl hover:scale-[1.02] transition-all duration-300' : ''} ${className}`}>
      {children}
    </div>
  );

  type BadgeProps = {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "gold" | "emerald" | "purple" | "terra";
  };

  const Badge: React.FC<BadgeProps> = ({ children, className = "", variant = "default" }) => {
    const variants = {
      default: "bg-gradient-to-r from-blue-500 to-purple-600",
      gold: "bg-gradient-to-r from-yellow-400 to-orange-500",
      emerald: "bg-gradient-to-r from-emerald-400 to-teal-500",
      purple: "bg-gradient-to-r from-purple-500 to-pink-500",
      terra: "bg-gradient-to-r from-orange-400 to-red-500"
    };
    
    return (
      <span className={`${variants[variant]} text-white text-xs font-semibold px-3 py-1 rounded-full ${className}`}>
        {children}
      </span>
    );
  };

  type ButtonVariant = "default" | "outline";
  type ButtonProps = {
    children: React.ReactNode;
    className?: string;
    variant?: ButtonVariant;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  };

  const Button: React.FC<ButtonProps> = ({ children, className = "", variant = "default", onClick }) => {
    const variants: Record<ButtonVariant, string> = {
      default: "bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl",
      outline: "border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
    };
    
    return (
      <button 
        onClick={onClick}
        className={`${variants[variant]} px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center ${className}`}
      >
        {children}
      </button>
    );
  };

  const Progress: React.FC<{ value: number; className?: string }> = ({ value, className = "" }) => (
    <div className={`w-full bg-gray-200 rounded-full h-3 overflow-hidden ${className}`}>
      <div 
        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700 ease-out shadow-lg"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5" />
      <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Premium Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-2">
                Premium Vault
              </h1>
              <p className="text-gray-600 text-lg">Your financial command center</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="gold" className="flex items-center space-x-1">
              <Sparkles className="w-4 h-4" />
              <span>Elite Member</span>
            </Badge>
            <Button 
              onClick={() => setPaymentOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25 shadow-xl"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Funds
            </Button>
          </div>
        </div>

        {/* Premium Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card hover className="p-8 bg-gradient-to-br from-white/90 to-blue-50/90">
            <div className="flex items-center justify-between mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col items-end">
                <Badge variant="gold" className="mb-2">+12.5%</Badge>
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent mb-2">
              ${totalBalance.toLocaleString()}
            </h3>
            <p className="text-gray-600 font-medium">Total Balance</p>
            <div className="mt-4 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full" />
          </Card>

          <Card hover className="p-8 bg-gradient-to-br from-white/90 to-emerald-50/90">
            <div className="flex items-center justify-between mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col items-end">
                <Badge variant="emerald" className="mb-2">This Month</Badge>
                <Zap className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-emerald-900 bg-clip-text text-transparent mb-2">
              ${contributionStats.monthlyContributions.toLocaleString()}
            </h3>
            <p className="text-gray-600 font-medium">Monthly Contributions</p>
            <div className="mt-4 h-1 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" />
          </Card>

          <Card hover className="p-8 bg-gradient-to-br from-white/90 to-purple-50/90">
            <div className="flex items-center justify-between mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Target className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col items-end">
                <Badge variant="purple" className="mb-2">{goalProgress.toFixed(0)}%</Badge>
                <Award className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-purple-900 bg-clip-text text-transparent mb-2">
              ${monthlyGoal.toLocaleString()}
            </h3>
            <p className="text-gray-600 font-medium">Monthly Goal</p>
            <div className="mt-4 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enhanced Vault Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Premium Balance Breakdown */}
            <Card className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                  Balance Breakdown
                </h2>
                <Button variant="outline" className="text-sm">
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Button>
              </div>
              <div className="space-y-6">
                {vaults.map((vault, index) => (
                  <Card key={vault.id} hover className="p-6 bg-gradient-to-r from-white/80 to-gray-50/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-2xl">{vault.icon}</span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{vault.currency}</p>
                          <p className="text-gray-500">
                            Goal: ${parseFloat(vault.monthlyGoal).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-2xl bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                          ${parseFloat(vault.balance).toLocaleString()}
                        </p>
                        <Badge variant={index === 0 ? "gold" : index === 1 ? "emerald" : "purple"} className="mt-2">
                          {((parseFloat(vault.balance) / parseFloat(vault.monthlyGoal)) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>

            {/* Enhanced Recent Transactions */}
            <Card className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-purple-900 bg-clip-text text-transparent">
                  Recent Transactions
                </h2>
                <Button variant="outline" className="text-sm">
                  View All
                </Button>
              </div>
              <div className="space-y-4">
                {contributions.slice(0, 5).map((contribution, index) => (
                  <Card key={contribution.id} hover className="p-6 bg-gradient-to-r from-white/60 to-emerald-50/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                          <DollarSign className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">
                            {contribution.purpose} Fund
                          </p>
                          <p className="text-gray-500">
                            {new Date(contribution.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-emerald-600">
                          +${parseFloat(contribution.amount).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500 font-medium">{contribution.currency}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-8">
            {/* Premium Monthly Goal Progress */}
            <Card className="p-8 bg-gradient-to-br from-white/90 to-blue-50/90">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Monthly Goal</h3>
                <Crown className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                    {goalProgress.toFixed(0)}%
                  </div>
                  <Progress value={goalProgress} className="mb-6" />
                  <p className="text-gray-600 font-medium">
                    ${(monthlyGoal - totalBalance).toLocaleString()} remaining
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-white/60 rounded-xl">
                    <p className="text-sm text-gray-600 font-medium">Current</p>
                    <p className="font-bold text-lg text-gray-900">${totalBalance.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-4 bg-white/60 rounded-xl">
                    <p className="text-sm text-gray-600 font-medium">Target</p>
                    <p className="font-bold text-lg text-gray-900">${monthlyGoal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Premium Quick Actions */}
            <Card className="p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h3>
              <div className="space-y-4">
                <Button 
                  onClick={() => setPaymentOpen(true)}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 py-4 text-lg shadow-emerald-500/25"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Funds
                </Button>
                <Button variant="outline" className="w-full py-4 text-lg hover:bg-blue-50">
                  <Target className="mr-2 h-5 w-5" />
                  Update Goal
                </Button>
                <Button variant="outline" className="w-full py-4 text-lg hover:bg-purple-50">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  View Analytics
                </Button>
              </div>
            </Card>

            {/* Premium Stats Card */}
            <Card className="p-8 bg-gradient-to-br from-white/90 to-purple-50/90">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Your Stats</h3>
                <Sparkles className="w-6 h-6 text-purple-500" />
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/60 rounded-xl">
                  <span className="text-gray-600 font-medium">Total Contributed</span>
                  <span className="font-bold text-gray-900 text-lg">
                    ${contributionStats.totalContributions.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/60 rounded-xl">
                  <span className="text-gray-600 font-medium">Current Streak</span>
                  <Badge variant="terra" className="text-sm">
                    {contributionStats.currentStreak} days
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/60 rounded-xl">
                  <span className="text-gray-600 font-medium">Community Rank</span>
                  <Badge variant="gold" className="text-sm flex items-center space-x-1">
                    <Crown className="w-4 h-4" />
                    <span>#7</span>
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Mock Modals */}
      {showContributionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Add Contribution</h3>
            <p className="text-gray-600 mb-6">Modal content would go here</p>
            <Button onClick={() => setShowContributionModal(false)} className="w-full">
              Close
            </Button>
          </Card>
        </div>
      )}

      {paymentOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Add Funds</h3>
            <p className="text-gray-600 mb-6">Payment modal content would go here</p>
            <Button onClick={() => setPaymentOpen(false)} className="w-full">
              Close
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EnhancedVaultPage;