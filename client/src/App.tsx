import React, { lazy, Suspense } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from './pages/hooks/useAuth';
import { PageLoading } from './components/ui/page-loading';
import { SkipLink } from './components/ui/skip-link';
import { ThemeProvider } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";
import { MorioProvider } from "@/components/MorioProvider"; // Added MorioProvider import
import { useUser } from './pages/hooks/useUser';
import { AuthProvider } from './contexts/auth-context';
import { NavigationProvider } from './contexts/navigation-context';

// Lazy load heavy components that are only shown to authenticated users
const Navigation = lazy(() => import('./components/navigation'));
const MorioFAB = lazy(() => import('./components/morio/MorioFAB').then(m => ({ default: m.MorioFAB })));
const MobileNav = lazy(() => import('./components/mobile-nav').then(m => ({ default: m.MobileNav })));
const AnnouncementsBanner = lazy(() => import('./components/AnnouncementsBanner'));
import Register1Raw from './components/register1';
const Register1 = Register1Raw as React.ComponentType<{ adminMode?: boolean }>;

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
const MorioDemoLazy = lazy(() => import('./pages/MorioDemo'));


import Wallet from './pages/wallet';
const MaonoVaultWeb3PageLazy = lazy(() => import('./pages/maonovault-web3'));
const SettingsLazy = lazy(() => import('./pages/settings'));
const AnalyticsPageLazy = lazy(() => import('./pages/AnalyticsPage'));
const TaskBountyBoardPageLazy = lazy(() => import('./pages/TaskBountyBoardPage'));
const RewardsHubLazy = lazy(() => import('./pages/RewardsHub'));
const MyRewardsLazy = lazy(() => import('./pages/my-rewards'));
const UserManagementLazy = lazy(() => import('./pages/admin/UserManagement'));
const DaoModerationLazy = lazy(() => import('./pages/admin/DaoModeration'));
const SystemSettingsLazy = lazy(() => import('./pages/admin/SystemSettings'));
const SecurityAuditLazy = lazy(() => import('./pages/admin/SecurityAudit'));
const AnnouncementsManagementLazy = lazy(() => import('./pages/admin/AnnouncementsManagement'));
const PoolManagementLazy = lazy(() => import('./pages/admin/PoolManagement'));
const InvestmentPoolsLazy = lazy(() => import('./pages/investment-pools'));
const InvestmentPoolDetailLazy = lazy(() => import('./pages/investment-pool-detail'));

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
import ReputationDashboard from "./pages/ReputationDashboard";
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

// Subscription Management
import SubscriptionManagement from './pages/SubscriptionManagement';

// MaonoVault Management
import MaonoVaultManagement from "@/pages/MaonoVaultManagement";

// Import new page components
const BlogPage = lazy(() => import('./pages/blog'));
const BlogPostPage = lazy(() => import('./pages/blog-post'));
const FAQCenter = lazy(() => import('./pages/faq-center'));
const SupportPage = lazy(() => import('./pages/support'));
const SubmitSuccessStory = lazy(() => import('./pages/success-stories/submit'));

// Protected/Public wrappers (unchanged)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoading message="Verifying authentication..." />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const SuperuserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <PageLoading message="Verifying authentication..." />;
  
  // Check if user is logged in and has superuser flag, or check localStorage
  const isSuperuser = user?.isSuperUser || user?.role === 'super_admin' || 
                      user?.role === 'admin' || localStorage.getItem('superuser') === 'true';
  
  if (!isAuthenticated && !isSuperuser) return <Navigate to="/superuser-login" />;
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
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <PageLoading message="Loading Mtaa DAO..." />;
  }

  return (
    <HelmetProvider>
      <AuthProvider>
        <NavigationProvider>
          <ThemeProvider>
            <TooltipProvider>
              <MorioProvider userId={user?.id} daoId={user?.currentDaoId}>
                <div className="min-h-screen bg-background text-foreground">
              <Helmet>
                <title>{isAuthenticated ? "Dashboard | Mtaa DAO" : "Welcome | Mtaa DAO"}</title>
                <meta name="description" content="Mtaa DAO — decentralized community finance platform" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta name="color-scheme" content="light dark" />
              </Helmet>

              <SkipLink />

              {isAuthenticated && <Suspense fallback={null}><AnnouncementsBanner /></Suspense>}

              {isAuthenticated && <Suspense fallback={null}><Navigation /></Suspense>}

              {/* Morio FAB for all authenticated users */}
              {isAuthenticated && user?.id && (
                <Suspense fallback={null}>
                  <MorioFAB userId={user.id} />
                </Suspense>
              )}

              <main id="main-content" className={isAuthenticated ? "pb-16 lg:pb-0" : ""} role="main">
                <Routes>
                  {/* Public routes - Authentication & Info Pages */}
                  <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
                  <Route path="/maonovault" element={<Suspense fallback={<PageLoading />}><MaonoVaultWeb3PageLazy /></Suspense>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
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
                  <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SettingsLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AnalyticsPageLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/tasks" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><TaskBountyBoardPageLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/rewards" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><RewardsHubLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/my-rewards" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><MyRewardsLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/investment-pools" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><InvestmentPoolsLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/investment-pools/:id" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><InvestmentPoolDetailLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/nft-marketplace" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><NFTMarketplace /></Suspense></ProtectedRoute>} />
                  <Route path="/morio" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><MorioDemoLazy /></Suspense></ProtectedRoute>} />
                  {/* Blog routes */}
                  <Route path="/blog" element={<Suspense fallback={<PageLoading />}><BlogPage /></Suspense>} />
                  <Route path="/blog/:id" element={<Suspense fallback={<PageLoading />}><BlogPostPage /></Suspense>} />
                  <Route path="/faq" element={<Suspense fallback={<PageLoading />}><FAQCenter /></Suspense>} />
                  <Route path="/support" element={<Suspense fallback={<PageLoading />}><SupportPage /></Suspense>} />
                  <Route path="/success-stories/submit" element={<Suspense fallback={<PageLoading />}><SubmitSuccessStory /></Suspense>} />
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
                  <Route path="/superuser" element={<SuperuserRoute><SuperUserDashboard /></SuperuserRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><UserManagementLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/admin/daos" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DaoModerationLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/admin/settings" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SystemSettingsLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/admin/security" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SecurityAuditLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/admin/announcements" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AnnouncementsManagementLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/admin/pools" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><PoolManagementLazy /></Suspense></ProtectedRoute>} />
                  <Route path="/admin/billing" element={<ProtectedRoute><AdminBillingDashboard /></ProtectedRoute>} />
                  <Route path="/admin/payments" element={<ProtectedRoute><PaymentReconciliation /></ProtectedRoute>} />
                  <Route path="/superuser-login" element={<Register1Raw />} />
                  <Route path="/admin-login" element={<Register1Raw adminMode={true} />} />
                  {/* Protected special routes */}
                  <Route path="/architect-setup" element={<ProtectedRoute><ArchitectSetupPage /></ProtectedRoute>} />
                  <Route path="/wallet-setup" element={<ProtectedRoute><WalletSetupPage /></ProtectedRoute>} />
                  <Route path="/leaderboard" element={<ReputationLeaderboard />} />
                  <Route path="/reputation-dashboard" element={<ReputationDashboard />} />
                  <Route path="/minipay" element={<ProtectedRoute><MiniPayDemo /></ProtectedRoute>} />
                  <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                  <Route path="/subscribe" element={<ProtectedRoute><Subscribe /></ProtectedRoute>} />
                  {/* Cross-chain bridge route */}
                  <Route path="/cross-chain" element={<ProtectedRoute><CrossChainBridge /></ProtectedRoute>} />
                  {/* Catch-all 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>

              {isAuthenticated && <Suspense fallback={null}><MobileNav /></Suspense>}
            </div>
          </MorioProvider>
            </TooltipProvider>
          </ThemeProvider>
        </NavigationProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;