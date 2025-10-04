import React, { lazy, Suspense } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from './pages/hooks/useAuth';
import { PageLoading } from './components/ui/page-loading';
import { SkipLink } from './components/ui/skip-link';
import Navigation from './components/navigation';
import { MobileNav } from './components/mobile-nav';
import { ThemeProvider } from "./components/theme-provider";

// Lazy load heavy pages
const CreateDaoLazy = lazy(() => import('./pages/create-dao'));
const DashboardLazy = lazy(() => import('./pages/dashboard'));
const ProposalsLazy = lazy(() => import('./pages/proposals'));
const ProposalDetailLazy = lazy(() => import('./pages/proposal-detail'));
const VaultLazy = lazy(() => import('./pages/vault'));
const VaultDashboardLazy = lazy(() => import('./pages/vault-dashboard')); // Assuming this is the correct component
const ProfileLazy = lazy(() => import('./pages/profile'));
const DAOsLazy = lazy(() => import('./pages/daos'));
const WalletLazy = lazy(() => import('./pages/wallet'));
const ReferralsLazy = lazy(() => import('./pages/referrals'));


import Wallet from './pages/wallet';
const MaonoVaultWeb3PageLazy = lazy(() => import('./pages/maonovault-web3'));
const SettingsLazy = lazy(() => import('./pages/settings'));
const AnalyticsPageLazy = lazy(() => import('./pages/AnalyticsPage'));
const TaskBountyBoardPageLazy = lazy(() => import('./pages/TaskBountyBoardPage'));
const RewardsHubLazy = lazy(() => import('./pages/RewardsHub'));

// Non-lazy (lighter) pages
import Landing from './pages/landing';
import Login from './pages/login';
import Register from './pages/register';
import ForgotPassword from './pages/forgot-password';
import ResetPassword from './pages/reset-password';
import WalletDashboard from './components/WalletDashboard';
import BatchTransfer from './components/batch-transfer';
import Multisig from './components/multisig';
import DaoTreasury from './components/dao-treasury';
import ArchitectSetupPage from './pages/architect-setup';
import PricingPage from './pages/PricingPage';
import AdminBillingDashboard from './pages/AdminBillingDashboard';
import ReputationLeaderboard from './pages/ReputationLeaderboard';
import DaoSettings from './pages/DaoSettings';
import SuperUserDashboard from './components/SuperUserDashboard';
import NotFound from './pages/not-found';
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

// Payment pages
import Checkout from './pages/Checkout';
import Subscribe from './pages/Subscribe';

// Cross-chain integration
import CrossChainBridge from './pages/CrossChainBridge';
import NFTMarketplace from './pages/NFTMarketplace';

// Protected/Public wrappers (unchanged)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoading message="Verifying authentication..." />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoading message="Loading Mtaa DAO..." />;
  if (isAuthenticated) return <Navigate to="/dashboard" />;
  return <>{children}</>;
};

// Optional: Add a layout for nested routes if needed (e.g., for /dao)
const DaoLayout = () => <Outlet />; // Can add shared UI here
const WalletLayout = () => <Outlet />;

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Loading Mtaa DAO..." />;
  }

  return (
    <HelmetProvider>
      <ThemeProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background text-foreground">
            <Helmet>
              <title>{isAuthenticated ? "Dashboard | Mtaa DAO" : "Welcome | Mtaa DAO"}</title>
              <meta name="description" content="Mtaa DAO — decentralized community finance platform" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <meta name="color-scheme" content="light dark" />
            </Helmet>

            <SkipLink />

            {isAuthenticated && <Navigation />}

            <main id="main-content" className={isAuthenticated ? "pb-16 lg:pb-0" : ""} role="main">
              <Routes>
                {/* Public routes - Authentication & Info Pages */}
                <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/success-stories" element={<SuccessStories />} />
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

                {/* Protected routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DashboardLazy /></Suspense></ProtectedRoute>} />
                <Route path="/create-dao" element={<ProtectedRoute><Suspense fallback={<PageLoading message="Loading Create DAO..." />}><CreateDaoLazy /></Suspense></ProtectedRoute>} />
                <Route path="/proposals" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ProposalsLazy /></Suspense></ProtectedRoute>} />
                <Route path="/proposals/:id" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ProposalDetailLazy /></Suspense></ProtectedRoute>} />
                <Route path="/vault" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultLazy /></Suspense></ProtectedRoute>} />
                <Route path="/vault-dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultDashboardLazy /></Suspense></ProtectedRoute>} /> {/* Fixed to use VaultDashboard */}
                <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ProfileLazy /></Suspense></ProtectedRoute>} />
                <Route path="/daos" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DAOsLazy /></Suspense></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ReferralsLazy /></Suspense></ProtectedRoute>} />
                <Route path="/maonovault" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><MaonoVaultWeb3PageLazy /></Suspense></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SettingsLazy /></Suspense></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AnalyticsPageLazy /></Suspense></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><TaskBountyBoardPageLazy /></Suspense></ProtectedRoute>} />
                <Route path="/rewards" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><RewardsHubLazy /></Suspense></ProtectedRoute>} />
                <Route path="/nft-marketplace" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><NFTMarketplace /></Suspense></ProtectedRoute>} />

                {/* Nested DAO routes */}
                <Route path="/dao" element={<ProtectedRoute><DaoLayout /></ProtectedRoute>}>
                  <Route path="settings" element={<DaoSettings />} />
                  <Route path="treasury" element={<Treasury />} />
                  <Route path="treasury-overview" element={<DaoTreasuryOverview />} />
                  <Route path="contributors" element={<ContributorList />} />
                  <Route path="analytics" element={<CommunityVaultAnalytics />} />
                  <Route path="disbursements" element={<Disbursements />} />
                </Route>

                {/* Nested Wallet routes */}
                <Route path="/wallet" element={<ProtectedRoute><WalletLayout /></ProtectedRoute>}>
                  <Route index element={<Wallet />} /> {/* Default to Wallet */}
                  <Route path="dashboard" element={<WalletDashboard />} />
                  <Route path="batch-transfer" element={<BatchTransfer />} />
                  <Route path="multisig" element={<Multisig />} />
                  <Route path="dao-treasury" element={<DaoTreasury />} />
                </Route>

                {/* Admin routes */}
                <Route path="/superuser" element={<ProtectedRoute><SuperUserDashboard /></ProtectedRoute>} />
                <Route path="/admin/billing" element={<ProtectedRoute><AdminBillingDashboard /></ProtectedRoute>} />
                <Route path="/admin/payments" element={<ProtectedRoute><PaymentReconciliation /></ProtectedRoute>} />

                {/* Protected special routes */}
                <Route path="/architect-setup" element={<ProtectedRoute><ArchitectSetupPage /></ProtectedRoute>} />
                <Route path="/wallet-setup" element={<ProtectedRoute><WalletSetupPage /></ProtectedRoute>} />
                <Route path="/leaderboard" element={<ProtectedRoute><ReputationLeaderboard /></ProtectedRoute>} />
                <Route path="/minipay" element={<ProtectedRoute><MiniPayDemo /></ProtectedRoute>} />
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/subscribe" element={<ProtectedRoute><Subscribe /></ProtectedRoute>} />

                {/* Cross-chain bridge route */}
                <Route path="/cross-chain" element={<ProtectedRoute><CrossChainBridge /></ProtectedRoute>} />

                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>

            {isAuthenticated && <MobileNav />}
          </div>
        </BrowserRouter>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;