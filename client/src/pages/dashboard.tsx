import SimplifiedDashboard from "@/components/SimplifiedDashboard";
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Users,
  DollarSign,
  Plus,
  Wallet as WalletIcon,
  Wallet,
  Shield,
  CheckCircle,
  Settings
} from 'lucide-react';


export default function MtaaDashboard() {

  // Mock data for demonstration purposes
  const dashboardData = {
    totalVaults: 5,
    totalInvested: 15000.50,
    recentActivity: [
      { id: 1, type: 'Vault Created', amount: 2000, date: '2023-10-26' },
      { id: 2, type: 'Investment Added', amount: 500, date: '2023-10-25' },
      { id: 3, type: 'Vault Withdrawn', amount: 1000, date: '2023-10-24' },
    ],
    totalUsers: 1200,
    totalDeposits: 250000.75,
  };

  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {/* Quick Access Bar */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="font-semibold text-gray-900">Quick Access</h3>
          <div className="flex gap-2 flex-wrap">
            <Link to="/wallet">
              <Button variant="outline" size="sm">
                <Wallet className="w-4 h-4 mr-2" />
                My Wallet
              </Button>
            </Link>
            <Link to="/vault-overview">
              <Button variant="outline" size="sm">
                <Shield className="w-4 h-4 mr-2" />
                Vaults
              </Button>
            </Link>
            <Link to="/kyc">
              <Button variant="outline" size="sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                KYC
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Link to="/referrals">
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Referrals
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vaults</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalVaults}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${dashboardData.totalInvested.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalUsers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {dashboardData.recentActivity.map((activity) => (
                  <li key={activity.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{activity.type}</p>
                      <p className="text-sm text-muted-foreground">{activity.date}</p>
                    </div>
                    <span className={`font-semibold ${activity.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {activity.amount >= 0 ? '+' : ''}${activity.amount.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Vault Creation Section (Example) */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Vault</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Click the button below to create a new vault. After creation, you will be redirected to the vault overview page where you can manage your new vault.
              </p>
              <Link to="/create-vault">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Vault
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar (Example) */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Deposits:</span>
                  <span className="font-semibold">${dashboardData.totalDeposits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Investment:</span>
                  <span className="font-semibold">${(dashboardData.totalInvested / dashboardData.totalVaults).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Users:</span>
                  <span className="font-semibold">{dashboardData.totalUsers}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Announcements</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Stay tuned for exciting new features coming soon!</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}