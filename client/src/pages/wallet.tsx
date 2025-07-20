import React, { useState, useEffect } from 'react';
import { Plus, Send, Download, History, DollarSign, ArrowUpRight, ArrowDownLeft, User, Wallet, CreditCard, TrendingUp, Shield, Zap, Star, Crown, Sparkles, Eye, EyeOff, RefreshCw } from 'lucide-react';

const EnhancedWalletPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [depositOpen, setDepositOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<any>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [vaults, setVaults] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    // Fetch vaults and transactions from API
    async function fetchWalletData() {
      try {
        const vaultRes = await fetch('/api/wallet/vaults');
        const vaultData = await vaultRes.json();
        setVaults(vaultData);
        const txRes = await fetch('/api/wallet/transactions');
        const txData = await txRes.json();
        setTransactions(txData);
      } catch (e) {
        // fallback to empty
        setVaults([]);
        setTransactions([]);
      }
    }
    fetchWalletData();
  }, []);

  const totalBalance = vaults?.reduce((sum, vault) => sum + parseFloat((vault.balance || '0').replace(/,/g, '')), 0) || 0;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "received":
        return <ArrowDownLeft className="w-5 h-5 text-emerald-500" />;
      case "sent":
        return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case "deposit":
        return <Download className="w-5 h-5 text-blue-500" />;
      case "withdrawal":
        return <ArrowUpRight className="w-5 h-5 text-orange-500" />;
      default:
        return <DollarSign className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "received":
      case "deposit":
        return "text-emerald-500";
      case "sent":
      case "withdrawal":
        return "text-red-500";
      default:
        return "text-gray-900";
    }
  };

  const Card: React.FC<{ children: React.ReactNode; className?: string; hover?: boolean }> = ({ children, className = "", hover = false }) => (
    <div className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 ${hover ? 'hover:shadow-2xl hover:scale-[1.02] transition-all duration-300' : ''} ${className}`}>
      {children}
    </div>
  );

  type BadgeVariant = "default" | "emerald" | "gold" | "purple" | "orange" | "outline";
  const Badge = ({
    children,
    className = "",
    variant = "default"
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: BadgeVariant;
  }) => {
    const variants: Record<BadgeVariant, string> = {
      default: "bg-gradient-to-r from-blue-500 to-purple-600",
      emerald: "bg-gradient-to-r from-emerald-400 to-teal-500",
      gold: "bg-gradient-to-r from-yellow-400 to-orange-500",
      purple: "bg-gradient-to-r from-purple-500 to-pink-500",
      orange: "bg-gradient-to-r from-orange-400 to-pink-500",
      outline: "border-2 border-gray-200 text-gray-700 bg-white/80"
    };
    
    return (
      <span className={`${variants[variant]} text-white text-xs font-semibold px-3 py-1 rounded-full ${className}`}>
        {children}
      </span>
    );
  };

  type ButtonProps = {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "outline" | "emerald" | "purple" | "glass";
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  };

  const Button: React.FC<ButtonProps> = ({ children, className = "", variant = "default", onClick, disabled = false }) => {
    const variants = {
      default: "bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl",
      outline: "border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 bg-white/80",
      emerald: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25",
      purple: "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-purple-500/25",
      glass: "bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
    };
    
    return (
      <button 
        onClick={onClick}
        disabled={disabled}
        className={`${variants[variant]} px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 via-purple-400/5 to-pink-400/5" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-br from-emerald-400/10 to-teal-400/10 rounded-full blur-3xl animate-pulse delay-500" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Premium Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-2">
                Mtaa Wallet
              </h1>
              <p className="text-gray-600 text-lg">Secure digital asset management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="orange" className="flex items-center space-x-1">
              <Shield className="w-4 h-4" />
              <span>Secured</span>
            </Badge>
            <Button variant="outline" className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Premium Balance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main Balance Card */}
          <Card className="lg:col-span-2 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <p className="text-white/80 text-sm font-medium">Total Balance</p>
                    <button
                      onClick={() => setBalanceVisible(!balanceVisible)}
                      className="text-white/60 hover:text-white/80 transition-colors"
                    >
                      {balanceVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  <h2 className="text-5xl font-bold text-white mb-2">
                    {balanceVisible ? `$${totalBalance.toLocaleString()}` : '••••••'}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-300" />
                    <span className="text-emerald-300 text-sm font-medium">+12.5% this month</span>
                  </div>
                </div>
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <DollarSign className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Button variant="glass" className="py-4 text-lg">
                  <Send className="mr-2 h-5 w-5" />
                  Send Money
                </Button>
                <Button variant="glass" className="py-4 text-lg" onClick={() => setPaymentOpen(true)}>
                  <Download className="mr-2 h-5 w-5" />
                  Add Funds
                </Button>
              </div>
            </div>
          </Card>

          {/* Quick Actions Card */}
          <Card className="bg-gradient-to-br from-white/90 to-gray-50/90 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Quick Actions</h3>
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="space-y-4">
              <Button variant="emerald" className="w-full py-4 text-lg">
                <Send className="mr-2 h-5 w-5" />
                Send to Friend
              </Button>
              <Button variant="purple" className="w-full py-4 text-lg" onClick={() => setPaymentOpen(true)}>
                <Download className="mr-2 h-5 w-5" />
                Deposit Funds
              </Button>
              <Button
                variant="outline"
                className="w-full py-4 text-lg"
                onClick={() => {
                  const personalVault = vaults?.find(v => v.type === 'personal');
                  setSelectedVault(personalVault);
                  setWithdrawOpen(true);
                }}
                disabled={!vaults?.some(v => v.type === 'personal')}
              >
                <ArrowUpRight className="mr-2 h-5 w-5" />
                Withdraw
              </Button>
            </div>
          </Card>
        </div>

        {/* Enhanced Currency Breakdown */}
        <Card className="mb-12 p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
              Currency Portfolio
            </h2>
            <Button variant="outline" className="text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Currency
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {vaults?.map((vault, index) => (
              <Card key={vault.id} hover className="p-6 bg-gradient-to-br from-white/80 to-gray-50/80 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-xl" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">
                          {vault.currency.substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 text-lg">{vault.currency}</span>
                        <p className="text-sm text-gray-500">Active</p>
                      </div>
                    </div>
                    <Badge variant="emerald" className="flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>Live</span>
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                      ${parseFloat(vault.balance.replace(/,/g, '')).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Goal: ${parseFloat(vault.monthlyGoal || 0).toLocaleString()}
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                      <div 
                        className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-700"
                        style={{ 
                          width: `${Math.min((parseFloat(vault.balance.replace(/,/g, '')) / parseFloat(vault.monthlyGoal || 1)) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* Enhanced Transaction History */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-purple-900 bg-clip-text text-transparent">
              Transaction History
            </h2>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="flex items-center space-x-1">
                <Crown className="w-4 h-4" />
                <span>All Time</span>
              </Badge>
              <Button variant="outline" className="text-sm">
                <History className="mr-2 h-4 w-4" />
                View All
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {transactions.map((transaction, index) => (
              <Card key={transaction.id} hover className="p-6 bg-gradient-to-r from-white/60 to-gray-50/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-lg" />
                
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center shadow-lg">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <p className="font-bold text-gray-900 text-lg">
                          {transaction.type === "received" || transaction.type === "deposit" 
                            ? `From ${transaction.from}` 
                            : `To ${transaction.to}`
                          }
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {transaction.type}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-1">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-2xl ${getTransactionColor(transaction.type)}`}>
                      {transaction.type === "received" || transaction.type === "deposit" ? "+" : "-"}
                      ${transaction.amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 font-medium">{transaction.currency}</p>
                    <Badge variant="emerald" className="text-xs mt-1">
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>

      {/* Mock Modals */}
      {depositOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Deposit Funds</h3>
            </div>
            <p className="text-gray-600 mb-6">Modal content would go here</p>
            <Button onClick={() => setDepositOpen(false)} className="w-full">
              Close
            </Button>
          </Card>
        </div>
      )}

      {paymentOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Add Funds</h3>
            </div>
            <p className="text-gray-600 mb-6">Payment modal content would go here</p>
            <Button onClick={() => setPaymentOpen(false)} className="w-full">
              Close
            </Button>
          </Card>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-8 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold">Withdraw Funds</h3>
            </div>
            <p className="text-gray-600 mb-6">Withdrawal modal content would go here</p>
            <Button onClick={() => setWithdrawOpen(false)} className="w-full">
              Close
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EnhancedWalletPage;