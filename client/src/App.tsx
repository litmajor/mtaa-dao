import React, { lazy, Suspense } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Router, Navigate } from 'react-router-dom'; // Import Navigate from react-router-dom
import { Helmet } from 'react-helmet-async';
import { useAuth } from './pages/hooks/useAuth';
import { PageLoading } from './components/ui/page-loading';
import { SkipLink } from './components/ui/skip-link';
import Navigation from './components/navigation';
import { MobileNav } from './components/mobile-nav';
import { ThemeProvider } from "./components/theme-provider";
import { Routes, Route } from 'react-router-dom'; // Import Routes and Route from react-router-dom

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
import VaultDashboard from './pages/vault-dashboard';
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
    // Use Navigate from react-router-dom for redirection
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
    // Use Navigate from react-router-dom for redirection
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Renamed App to AppContent to avoid conflict with Router
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  // No longer need to import useLocation from wouter

  if (isLoading) {
    return <PageLoading message="Loading Mtaa DAO..." />;
  }

  // Removed the conditional logic for public routes as it's handled by ProtectedRoute and PublicRoute wrappers


  return (
    <HelmetProvider>
      <ThemeProvider>
        {/* Use react-router-dom's Router component */}
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
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

                {/* Landing page */}
                <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
                <Route path="/home" element={<Navigate to="/dashboard" replace />} />

                {/* Protected routes */}
                <Route path="/create-dao" element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoading message="Loading Create DAO..." />}>
                      <CreateDaoLazy />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="/proposals" element={<ProtectedRoute><Proposals /></ProtectedRoute>} />
                <Route path="/proposals/:id" element={<ProtectedRoute><ProposalDetail /></ProtectedRoute>} />
                <Route path="/vault" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
                <Route path="/vault-dashboard" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/daos" element={<ProtectedRoute><DAOs /></ProtectedRoute>} />
                <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
                <Route path="/wallet/dashboard" element={<ProtectedRoute><WalletDashboard /></ProtectedRoute>} />
                <Route path="/wallet/batch-transfer" element={<ProtectedRoute><BatchTransfer /></ProtectedRoute>} />
                <Route path="/wallet/multisig" element={<ProtectedRoute><Multisig /></ProtectedRoute>} />
                <Route path="/wallet/dao-treasury" element={<ProtectedRoute><DaoTreasury /></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
                <Route path="/maonovault" element={<ProtectedRoute><MaonoVaultWeb3Page /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><TaskBountyBoardPage /></ProtectedRoute>} />
                <Route path="/rewards" element={<ProtectedRoute><RewardsHub /></ProtectedRoute>} />

                {/* DAO routes */}
                <Route path="/dao/settings" element={<ProtectedRoute><DaoSettings /></ProtectedRoute>} />
                <Route path="/dao/treasury" element={<ProtectedRoute><Treasury /></ProtectedRoute>} />
                <Route path="/dao/treasury-overview" element={<ProtectedRoute><DaoTreasuryOverview /></ProtectedRoute>} />
                <Route path="/dao/contributors" element={<ProtectedRoute><ContributorList /></ProtectedRoute>} />
                <Route path="/dao/analytics" element={<ProtectedRoute><CommunityVaultAnalytics /></ProtectedRoute>} />
                <Route path="/dao/disbursements" element={<ProtectedRoute><Disbursements /></ProtectedRoute>} />

                {/* Admin routes */}
                <Route path="/superuser" element={<ProtectedRoute><SuperUserDashboard /></ProtectedRoute>} />
                <Route path="/admin/billing" element={<ProtectedRoute><AdminBillingDashboard /></ProtectedRoute>} />
                <Route path="/admin/payments" element={<ProtectedRoute><PaymentReconciliation /></ProtectedRoute>} />

                {/* Special routes */}
                <Route path="/architect-setup" element={<ArchitectSetupPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/wallet-setup" element={<WalletSetupPage />} />
                <Route path="/success-stories" element={<SuccessStories />} />
                <Route path="/leaderboard" element={<ReputationLeaderboard />} />
                <Route path="/minipay" element={<MiniPayDemo />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/subscribe" element={<ProtectedRoute><Subscribe /></ProtectedRoute>} />

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
    </HelmetProvider>
    </ThemeProvider>
  );
}

// Export AppContent as the main App component
export default AppContent;