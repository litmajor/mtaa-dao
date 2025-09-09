import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from './pages/hooks/useAuth';
import { PageLoading } from './components/ui/page-loading';
import { SkipLink } from './components/ui/skip-link';
import Navigation from './components/navigation';
import { MobileNav } from './components/mobile-nav';
import { ThemeProvider } from "./components/theme-provider";

// Import all page components
import Landing from './pages/landing';
import Dashboard from './pages/dashboard';
import Login from './pages/login';
import Register from './pages/register';
import ForgotPassword from './pages/forgot-password';
import ResetPassword from './pages/reset-password';
import Proposals from './pages/proposals';
import ProposalDetail from './pages/proposal-detail';
import Vault from './pages/vault';
import Profile from './pages/profile';
import DAOs from './pages/daos';
import Wallet from './pages/wallet';
import WalletDashboard from './components/WalletDashboard';
import BatchTransfer from './components/batch-transfer';
import Multisig from './components/multisig';
import DaoTreasury from './components/dao-treasury';
import Referrals from './pages/referrals';
import MaonoVaultWeb3Page from './pages/maonovault-web3';
import ArchitectSetupPage from './pages/architect-setup';
import PricingPage from './pages/PricingPage';
import AdminBillingDashboard from './pages/AdminBillingDashboard';
import ReputationLeaderboard from './pages/ReputationLeaderboard';
import DaoSettings from './pages/DaoSettings';
import SuperUserDashboard from './components/SuperUserDashboard';
import NotFound from './pages/not-found';
import Settings from './pages/settings';
import AnalyticsPage from './pages/AnalyticsPage';
import TaskBountyBoardPage from './pages/TaskBountyBoardPage';
import RewardsHub from './pages/RewardsHub';
import PaymentReconciliation from './pages/PaymentReconciliation';
import MiniPayDemo from './pages/MiniPayDemo';
import SuccessStories from './pages/success-stories';
import WalletSetupPage from './pages/wallet-setup';

// DAO sub-pages
import DaoTreasuryOverview from './pages/dao/dao_treasury_overview';
import ContributorList from './pages/dao/contributor_list';
import CommunityVaultAnalytics from './pages/dao/community_vault_analytics';
import Disbursements from './pages/dao/disbursements';
import Treasury from './pages/dao/treasury';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Verifying authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route wrapper (redirects to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Loading Mtaa DAO..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Loading Mtaa DAO..." />;
  }

  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-background text-foreground">
          <Helmet>
            <title>{isAuthenticated ? "Dashboard | Mtaa DAO" : "Welcome | Mtaa DAO"}</title>
            <meta name="description" content="Mtaa DAO — decentralized community finance platform" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta name="theme-color" content="#1e40af" />
            <meta name="color-scheme" content="light dark" />
            {/* 'theme-color' is not supported by Firefox/Opera, but 'color-scheme' is */}
          </Helmet>

          {isAuthenticated && <Navigation />}

          <main id="main-content" className={isAuthenticated ? "pb-16 lg:pb-0" : ""} role="main">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/register" element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } />
              <Route path="/forgot-password" element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              } />
              <Route path="/reset-password" element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              } />

              {/* Landing page - only shown if not authenticated */}
              <Route path="/" element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />
              } />

              {/* Root redirect for authenticated users */}
              <Route path="/home" element={
                <Navigate to="/dashboard" replace />
              } />

              {/* Protected routes */}
              <Route path="/create-dao" element={
                <ProtectedRoute>
                  {React.createElement(require('./pages/create-dao').default)}
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/proposals" element={
                <ProtectedRoute>
                  <Proposals />
                </ProtectedRoute>
              } />
              <Route path="/proposals/:id" element={
                <ProtectedRoute>
                  <ProposalDetail />
                </ProtectedRoute>
              } />
              <Route path="/vault" element={
                <ProtectedRoute>
                  <Vault />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/daos" element={
                <ProtectedRoute>
                  <DAOs />
                </ProtectedRoute>
              } />
              <Route path="/wallet" element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              } />
              <Route path="/wallet/dashboard" element={
                <ProtectedRoute>
                  <WalletDashboard />
                </ProtectedRoute>
              } />
              <Route path="/wallet/batch-transfer" element={
                <ProtectedRoute>
                  <BatchTransfer />
                </ProtectedRoute>
              } />
              <Route path="/wallet/multisig" element={
                <ProtectedRoute>
                  <Multisig />
                </ProtectedRoute>
              } />
              <Route path="/wallet/dao-treasury" element={
                <ProtectedRoute>
                  <DaoTreasury />
                </ProtectedRoute>
              } />
              <Route path="/referrals" element={
                <ProtectedRoute>
                  <Referrals />
                </ProtectedRoute>
              } />
              <Route path="/maonovault" element={
                <ProtectedRoute>
                  <MaonoVaultWeb3Page />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              } />
              <Route path="/tasks" element={
                <ProtectedRoute>
                  <TaskBountyBoardPage />
                </ProtectedRoute>
              } />
              <Route path="/rewards" element={
                <ProtectedRoute>
                  <RewardsHub />
                </ProtectedRoute>
              } />

              {/* DAO routes */}
              <Route path="/dao/settings" element={
                <ProtectedRoute>
                  <DaoSettings />
                </ProtectedRoute>
              } />
              <Route path="/dao/treasury" element={
                <ProtectedRoute>
                  <Treasury />
                </ProtectedRoute>
              } />
              <Route path="/dao/treasury-overview" element={
                <ProtectedRoute>
                  <DaoTreasuryOverview />
                </ProtectedRoute>
              } />
              <Route path="/dao/contributors" element={
                <ProtectedRoute>
                  <ContributorList />
                </ProtectedRoute>
              } />
              <Route path="/dao/analytics" element={
                <ProtectedRoute>
                  <CommunityVaultAnalytics />
                </ProtectedRoute>
              } />
              <Route path="/dao/disbursements" element={
                <ProtectedRoute>
                  <Disbursements />
                </ProtectedRoute>
              } />

              {/* Admin routes */}
              <Route path="/superuser" element={
                <ProtectedRoute>
                  <SuperUserDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing" element={
                <ProtectedRoute>
                  <AdminBillingDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/payments" element={
                <ProtectedRoute>
                  <PaymentReconciliation />
                </ProtectedRoute>
              } />

              {/* Special routes */}
              <Route path="/architect-setup" element={<ArchitectSetupPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/wallet-setup" element={<WalletSetupPage />} />
              <Route path="/success-stories" element={<SuccessStories />} />
              <Route path="/leaderboard" element={<ReputationLeaderboard />} />
              <Route path="/minipay" element={<MiniPayDemo />} />
              <Route path="/success-stories" element={<SuccessStories />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="*" element={<NotFound />} />

              {/* Static pages */}
              <Route path="/about" element={
                <div className="p-8 max-w-4xl mx-auto">
                  <h1 className="text-3xl font-bold mb-6">About Mtaa DAO</h1>
                  <p className="text-gray-600">Building decentralized community governance and finance solutions.</p>
                </div>
              } />
              <Route path="/help" element={
                <div className="p-8 max-w-4xl mx-auto">
                  <h1 className="text-3xl font-bold mb-6">Help & Support</h1>
                  <p className="text-gray-600">Get help with using Mtaa DAO platform.</p>
                </div>
              } />
              <Route path="/faq" element={
                <div className="p-8 max-w-4xl mx-auto">
                  <h1 className="text-3xl font-bold mb-6">Frequently Asked Questions</h1>
                  <p className="text-gray-600">Common questions about Mtaa DAO.</p>
                </div>
              } />
              <Route path="/contact" element={
                <div className="p-8 max-w-4xl mx-auto">
                  <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
                  <p className="text-gray-600">Get in touch with the Mtaa DAO team.</p>
                </div>
              } />

              {/* Catch-all for 404s */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          <MobileNav />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;