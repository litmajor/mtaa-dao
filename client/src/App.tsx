import React, { lazy, Suspense } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Router, Route, Switch, Redirect } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { useAuth } from './pages/hooks/useAuth';
import { PageLoading } from './components/ui/page-loading';
import { SkipLink } from './components/ui/skip-link';
import Navigation from './components/navigation';
import { MobileNav } from './components/mobile-nav';
import { ThemeProvider } from "./components/theme-provider";

// Import all page components
const CreateDaoLazy = lazy(() => import('./pages/create-dao'));
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
import VaultDashboard from './pages/vault-dashboard';
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

// Payment pages (Stripe integration)
import Checkout from './pages/Checkout';
import Subscribe from './pages/Subscribe';

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Verifying authentication..." />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
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
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Loading Mtaa DAO..." />;
  }

  return (
    <HelmetProvider>
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
              <Switch>
                {/* Public routes */}
                <Route path="/login">
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                </Route>
                <Route path="/register">
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                </Route>
                <Route path="/forgot-password">
                  <PublicRoute>
                    <ForgotPassword />
                  </PublicRoute>
                </Route>
                <Route path="/reset-password">
                  <PublicRoute>
                    <ResetPassword />
                  </PublicRoute>
                </Route>

                {/* Landing page - only shown if not authenticated */}
                <Route path="/">
                  {isAuthenticated ? <Redirect to="/dashboard" /> : <Landing />}
                </Route>

                {/* Root redirect for authenticated users */}
                <Route path="/home">
                  <Redirect to="/dashboard" />
                </Route>

                {/* Protected routes */}
                <Route path="/create-dao">
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoading message="Loading Create DAO..." />}>
                      <CreateDaoLazy />
                    </Suspense>
                  </ProtectedRoute>
                </Route>

                <Route path="/proposals">
                  <ProtectedRoute>
                    <Proposals />
                  </ProtectedRoute>
                </Route>
                <Route path="/proposals/:id">
                  <ProtectedRoute>
                    <ProposalDetail />
                  </ProtectedRoute>
                </Route>
                <Route path="/vault">
                  <ProtectedRoute>
                    <Vault />
                  </ProtectedRoute>
                </Route>
                <Route path="/vault-dashboard">
                  <ProtectedRoute>
                    <Vault />
                  </ProtectedRoute>
                </Route>
                <Route path="/profile">
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                </Route>
                <Route path="/daos">
                  <ProtectedRoute>
                    <DAOs />
                  </ProtectedRoute>
                </Route>
                <Route path="/wallet">
                  <ProtectedRoute>
                    <Wallet />
                  </ProtectedRoute>
                </Route>
                <Route path="/wallet/dashboard">
                  <ProtectedRoute>
                    <WalletDashboard />
                  </ProtectedRoute>
                </Route>
                <Route path="/wallet/batch-transfer">
                  <ProtectedRoute>
                    <BatchTransfer />
                  </ProtectedRoute>
                </Route>
                <Route path="/wallet/multisig">
                  <ProtectedRoute>
                    <Multisig />
                  </ProtectedRoute>
                </Route>
                <Route path="/wallet/dao-treasury">
                  <ProtectedRoute>
                    <DaoTreasury />
                  </ProtectedRoute>
                </Route>
                <Route path="/referrals">
                  <ProtectedRoute>
                    <Referrals />
                  </ProtectedRoute>
                </Route>
                <Route path="/maonovault">
                  <ProtectedRoute>
                    <MaonoVaultWeb3Page />
                  </ProtectedRoute>
                </Route>
                <Route path="/settings">
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                </Route>
                <Route path="/analytics">
                  <ProtectedRoute>
                    <AnalyticsPage />
                  </ProtectedRoute>
                </Route>
                <Route path="/tasks">
                  <ProtectedRoute>
                    <TaskBountyBoardPage />
                  </ProtectedRoute>
                </Route>
                <Route path="/rewards">
                  <ProtectedRoute>
                    <RewardsHub />
                  </ProtectedRoute>
                </Route>

                {/* DAO routes */}
                <Route path="/dao/settings">
                  <ProtectedRoute>
                    <DaoSettings />
                  </ProtectedRoute>
                </Route>
                <Route path="/dao/treasury">
                  <ProtectedRoute>
                    <Treasury />
                  </ProtectedRoute>
                </Route>
                <Route path="/dao/treasury-overview">
                  <ProtectedRoute>
                    <DaoTreasuryOverview />
                  </ProtectedRoute>
                </Route>
                <Route path="/dao/contributors">
                  <ProtectedRoute>
                    <ContributorList />
                  </ProtectedRoute>
                </Route>
                <Route path="/dao/analytics">
                  <ProtectedRoute>
                    <CommunityVaultAnalytics />
                  </ProtectedRoute>
                </Route>
                <Route path="/dao/disbursements">
                  <ProtectedRoute>
                    <Disbursements />
                  </ProtectedRoute>
                </Route>

                {/* Admin routes */}
                <Route path="/superuser">
                  <ProtectedRoute>
                    <SuperUserDashboard />
                  </ProtectedRoute>
                </Route>
                <Route path="/admin/billing">
                  <ProtectedRoute>
                    <AdminBillingDashboard />
                  </ProtectedRoute>
                </Route>
                <Route path="/admin/payments">
                  <ProtectedRoute>
                    <PaymentReconciliation />
                  </ProtectedRoute>
                </Route>

                {/* Special routes */}
                <Route path="/architect-setup">
                  <ArchitectSetupPage />
                </Route>
                <Route path="/pricing">
                  <PricingPage />
                </Route>
                <Route path="/wallet-setup">
                  <WalletSetupPage />
                </Route>
                <Route path="/success-stories">
                  <SuccessStories />
                </Route>
                <Route path="/leaderboard">
                  <ReputationLeaderboard />
                </Route>
                <Route path="/minipay">
                  <MiniPayDemo />
                </Route>
                <Route path="/dashboard">
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                </Route>
                <Route path="/checkout">
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                </Route>
                <Route path="/subscribe">
                  <ProtectedRoute>
                    <Subscribe />
                  </ProtectedRoute>
                </Route>

                {/* Static pages */}
                <Route path="/about">
                  <div className="p-8 max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-6">About Mtaa DAO</h1>
                    <p className="text-gray-600">Building decentralized community governance and finance solutions.</p>
                  </div>
                </Route>
                <Route path="/help">
                  <div className="p-8 max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-6">Help & Support</h1>
                    <p className="text-gray-600">Get help with using Mtaa DAO platform.</p>
                  </div>
                </Route>
                <Route path="/faq">
                  <div className="p-8 max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-6">Frequently Asked Questions</h1>
                    <p className="text-gray-600">Common questions about Mtaa DAO.</p>
                  </div>
                </Route>
                <Route path="/contact">
                  <div className="p-8 max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
                    <p className="text-gray-600">Get in touch with the Mtaa DAO team.</p>
                  </div>
                </Route>

                {/* Catch-all for 404s */}
                <Route path="/:rest*">
                  <NotFound />
                </Route>
              </Switch>
          </main>

          <MobileNav />
        </div>
      </Router>
    </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;