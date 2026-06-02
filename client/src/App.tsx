import React, { lazy, Suspense, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Route, Routes, Navigate, Outlet, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from './pages/hooks/useAuth';
import { PageLoading } from './components/ui/page-loading';
import { SkipLink } from './components/ui/skip-link';
import { ThemeProvider } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";
import { MorioProvider } from "@/components/MorioProvider";
import { AuthProvider } from './contexts/auth-context';
import { NavigationProvider } from './contexts/navigation-context';
import { PersonaProvider } from './contexts/persona-context';
import MorioFloatingChat from './components/MorioFloatingChat';
import { AlertToastManager } from './components/notifications/AlertToastManager';
// Register workspace panels (core + Yuki/Amara) on app startup
import '../../core/workspace/registerPanels';
import '../../core/workspace/registerYukiAmaraPanels';

// Lazy load heavy components that are only shown to authenticated users
// WEEK 1 UPDATE: Use new GlobalNav instead of Navigation
const GlobalNav = lazy(() => import('./components/GlobalNav'));
const MobileNav = lazy(() => import('./components/mobile-nav').then(m => ({ default: m.MobileNav })));
const AnnouncementsBanner = lazy(() => import('./components/AnnouncementsBanner'));
import Register1Raw from './components/register1';
const Register1 = Register1Raw as React.ComponentType<{ adminMode?: boolean }>;

// Lazy load heavy pages
const CreateDaoLazy = lazy(() => import('./pages/create-dao'));
// WEEK 1 UPDATE: Use new PersonalizedDashboard
const PersonalizedDashboardLazy = lazy(() => import('./components/dashboard/PersonalizedDashboard').then(m => ({ default: (m as any).PersonalizedDashboard || (m as any).default })));
const ProposalsLazy = lazy(() => import('./pages/proposals'));
const ProposalDetailLazy = lazy(() => import('./pages/proposal-detail'));
const VaultLazy = lazy(() => import('./pages/vault'));
const VaultDashboardLazy = lazy(() => import('./pages/vault-dashboard')); // Assuming this is the correct component
const VaultOverviewLazy = lazy(() => import('./pages/vault-overview'));
const CreateVaultLazy = lazy(() => import('./pages/create-vault'));
const KYCLazy = lazy(() => import('./pages/kyc'));
const ProfileLazy = lazy(() => import('./pages/profile'));
const DAOsLazy = lazy(() => import('./pages/daos'));
// Wallet is imported statically below; remove dead lazy import
const ReferralsLazy = lazy(() => import('./pages/referrals'));
const MorioDemoLazy = lazy(() => import('./pages/MorioDemo'));


import Wallet from './pages/wallet';
const MaonoVaultLandingLazy = lazy(() => import('./pages/maonovault-landing'));
const MaonoVaultWeb3PageLazy = lazy(() => import('./pages/maonovault-web3'));
const SettingsLazy = lazy(() => import('./pages/SettingsPage'));
const AnalyticsPageLazy = lazy(() => import('./pages/AnalyticsPage'));
const TaskBountyBoardPageLazy = lazy(() => import('./pages/TaskBountyBoardPage'));
const RewardsHubLazy = lazy(() => import('./pages/RewardsHub'));
const MyRewardsLazy = lazy(() => import('./pages/my-rewards'));
const TradingPageLazy = lazy(() => import('./pages/trading'));
const YukiDashboardPageLazy = lazy(() => import('./pages/YukiDashboard'));
const StrategyDetailLazy = lazy(() => import('./components/trading/StrategyDetail'));
const OpportunitiesPageLazy = lazy(() => import('./pages/opportunities'));
const UserManagementLazy = lazy(() => import('./pages/admin/UserManagement'));
const DaoModerationLazy = lazy(() => import('./pages/admin/DaoModeration'));
const SystemSettingsLazy = lazy(() => import('./pages/admin/SystemSettings'));
const SecurityAuditLazy = lazy(() => import('./pages/admin/SecurityAudit'));
const AnnouncementsManagementLazy = lazy(() => import('./pages/admin/AnnouncementsManagement'));
const PoolManagementLazy = lazy(() => import('./pages/admin/PoolManagement'));
const InvestmentPoolsLazy = lazy(() => import('./pages/investment-pools'));
const InvestmentPoolDetailLazy = lazy(() => import('./pages/investment-pool-detail'));
// Import new page components for Investment Pools
const PoolDiscovery = lazy(() => import('./pages/pool-discovery'));
const ExchangeMarketsLazy = lazy(() => import('./pages/ExchangeMarkets'));
const DeFiDEXAnalyticsLazy = lazy(() => import('./pages/DeFiDEXAnalytics'));
const EscrowPageLazy = lazy(() => import('./pages/escrow'));
const EscrowAcceptLazy = lazy(() => import('./pages/escrow-accept'));

// New Week 2 Admin Pages
const AdminLayoutLazy = lazy(() => import('./pages/admin/AdminLayout'));
const AdminAnalyticsLazy = lazy(() => import('./pages/admin/AnalyticsPage'));
const AdminSettingsLazy = lazy(() => import('./pages/admin/SettingsPage'));
const AdminUsersLazy = lazy(() => import('./pages/admin/UsersPage'));
const AdminBetaAccessLazy = lazy(() => import('./pages/admin/BetaAccessPage'));
const AdminDAOsLazy = lazy(() => import('./pages/admin/DAOsPage'));
const AdminHealthLazy = lazy(() => import('./pages/admin/HealthMonitorPage'));
const AILayerMonitoringLazy = lazy(() => import('./pages/admin/AILayerMonitoring'));

// Admin Monitoring Pages - New Phase
const AdminDashboardOverviewLazy = lazy(() => import('./pages/admin/AdminDashboardOverview'));
const AdminDeFiMonitoringLazy = lazy(() => import('./pages/admin/AdminDeFiMonitoring'));
const AdminCeFiMonitoringLazy = lazy(() => import('./pages/admin/AdminCeFiMonitoring'));
const AdminHealthMonitoringLazy = lazy(() => import('./pages/admin/AdminHealthMonitoring'));
const AdminLiquidityMonitoringLazy = lazy(() => import('./pages/admin/AdminLiquidityMonitoring'));
const AdminRevenueTrackingLazy = lazy(() => import('./pages/admin/AdminRevenueTracking'));
const AdminPaymentProvidersLazy = lazy(() => import('./pages/admin/AdminPaymentProviders'));
const AdminAgentMonitoringLazy = lazy(() => import('./pages/admin/AdminAgentMonitoring'));
const AdminMonitoringHubLazy = lazy(() => import('./pages/admin/AdminMonitoringHub'));

// Admin Additional Monitoring Pages - Phase 2
const AdminPlatformGrowthLazy = lazy(() => import('./pages/admin/AdminPlatformGrowth'));
const AdminAPIUsageLazy = lazy(() => import('./pages/admin/AdminAPIUsage'));
const AdminTokenomicsLazy = lazy(() => import('./pages/admin/AdminTokenomics'));
const AdminSupportTicketsLazy = lazy(() => import('./pages/admin/AdminSupportTickets'));

// Admin Community & Engagement Pages - Phase 3
const AdminReferralsLazy = lazy(() => import('./pages/admin/AdminReferrals'));
const AdminLeaderboardLazy = lazy(() => import('./pages/admin/AdminLeaderboard'));
const AdminRewardsLazy = lazy(() => import('./pages/admin/AdminRewards'));
const AdminAchievementsLazy = lazy(() => import('./pages/admin/AdminAchievements'));
const AdminAnnouncementsLazy = lazy(() => import('./pages/admin/AdminAnnouncements'));
const AdminDAOAnalyticsLazy = lazy(() => import('./pages/admin/AdminDAOAnalytics'));


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
import PricingPage from './pages/pricing';
import SubscriptionPage from './pages/subscription';
import TransactionLimitsPage from './pages/transaction-limits';
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
import SubprofileSelectionPage from './pages/subprofile-selection';

// DAO sub-pages
import DaoTreasuryOverview from './pages/dao/dao_treasury_overview';
import ContributorList from './pages/dao/contributor_list';
import CommunityVaultAnalytics from './pages/dao/community_vault_analytics';
import Disbursements from './pages/dao/disbursements';
import Treasury from './pages/dao/treasury';

// Payment pages
// Checkout and Subscribe are lazy-loaded later; remove unused static imports

// Cross-chain integration
import CrossChainHub from './pages/CrossChainHub';
import CrossChainBridgePage from './pages/CrossChainBridgePage';
import CrossChainSwapPage from './pages/CrossChainSwapPage';
import NFTMarketplace from './pages/NFTMarketplace';

// Subscription Management
import SubscriptionManagement from './pages/SubscriptionManagement';

// MaonoVault Management
import MaonoVaultManagement from "@/pages/MaonoVaultManagement";

// Vault & Staking Components (NEW - Session Complete)
const VaultListPageLazy = lazy(() => import('./components/vaults/VaultListPage'));
const VaultDetailPageLazy = lazy(() => import('./components/vaults/VaultDetailPage'));
const MyVaultsPageLazy = lazy(() => import('./components/vaults/MyVaultsPage'));
const StakingComponentLazy = lazy(() => import('./components/staking/StakingComponent'));

// Import new page components
const BlogPage = lazy(() => import('./pages/blog'));
const BlogPostPage = lazy(() => import('./pages/blog-post'));
const FAQCenter = lazy(() => import('./pages/faq-center'));
const SupportPage = lazy(() => import('./pages/support'));
const SubmitSuccessStory = lazy(() => import('./pages/success-stories/submit'));

// Additional missing pages
const AdminLoginLazy = lazy(() => import('./pages/admin-login'));
const AdminRegisterLazy = lazy(() => import('./pages/admin-register'));
const SessionSettingsLazy = lazy(() => import('./pages/session-settings'));
const AchievementSystemPageLazy = lazy(() => import('./pages/AchievementSystemPage'));
const AnalyzerDashboardLazy = lazy(() => import('./pages/AnalyzerDashboard'));
const DefenderMonitorLazy = lazy(() => import('./pages/DefenderMonitor'));
const EldersPageLazy = lazy(() => import('./pages/EldersPage'));
const EventsPageLazy = lazy(() => import('./pages/events'));
const MaonoVaultDashboardLazy = lazy(() => import('./pages/maonovault-dashboard'));
const EscrowAnalyticsLazy = lazy(() => import('./pages/escrow-analytics').then(m => ({ default: (m as any).EscrowAnalyticsDashboard || (m as any).default })));
const EscrowDetailLazy = lazy(() => import('./pages/escrow-detail'));
const BillSplitPageLazy = lazy(() => import('./pages/bill-split'));
const RecurringPaymentsPageLazy = lazy(() => import('./pages/recurring-payments'));
const SynchronizerMonitorLazy = lazy(() => import('./pages/SynchronizerMonitor'));
const TreasuryIntelligenceLazy = lazy(() => import('./pages/TreasuryIntelligence'));
const UnifiedDashboardLazy = lazy(() => import('./pages/unified-dashboard'));
const RevenueDashboardLazy = lazy(() => import('./pages/RevenueDashboard'));
const CheckoutLazy = lazy(() => import('./pages/Checkout'));
const SubscribeLazy = lazy(() => import('./pages/Subscribe'));

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
  // 🔐 Security: Clear old auth tokens from localStorage/sessionStorage on app startup
  // These should only be stored in httpOnly cookies now
  useEffect(() => {
    const keysToRemove = [
      'token',
      'authToken',
      'auth-token',
      'refresh-token',
      'refreshToken',
      'jwtToken',
      'accessToken',
      'user',
      'userId',
    ];

    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`🔐 Clearing legacy localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
      if (sessionStorage.getItem(key)) {
        console.log(`🔐 Clearing legacy sessionStorage key: ${key}`);
        sessionStorage.removeItem(key);
      }
    });
  }, []);

  try {
    console.log('App component rendering');
    const authData = useAuth();
    console.log('useAuth returned:', authData);
    const { isAuthenticated, isLoading, user } = authData;

    if (isLoading) {
      console.log('Still loading');
      return <PageLoading message="Loading Mtaa DAO..." />;
    }

    console.log('Auth state:', { isAuthenticated, user });
    const userId = user?.id || undefined;

    // Wrapper route for `/vaults/:vaultId` to pass the param as a prop
    const VaultDetailRoute: React.FC = () => {
      const { vaultId } = useParams() as { vaultId?: string };
      if (!vaultId) return <PageLoading message="Loading vault..." />;
      return <VaultDetailPageLazy vaultId={vaultId} /> as any;
    };

    return (
      <HelmetProvider>
        <NavigationProvider>
          <ThemeProvider>
            <TooltipProvider>
              <PersonaProvider>
                <MorioProvider userId={userId} daoId={user?.currentDaoId}>
                  <div className="min-h-screen bg-background text-foreground">
                    {/* Real-time Alert/Toast Manager */}
                    <AlertToastManager />

                    <Helmet>
                      <title>{isAuthenticated ? "Dashboard | Mtaa DAO" : "Welcome | Mtaa DAO"}</title>
                      <meta name="description" content="Mtaa DAO — decentralized community finance platform" />
                      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                      <meta name="color-scheme" content="light dark" />
                    </Helmet>

                    <SkipLink />

                    {isAuthenticated && <Suspense fallback={null}><AnnouncementsBanner /></Suspense>}

                    {/* WEEK 1 UPDATE: Use new GlobalNav */}
                    {isAuthenticated && <Suspense fallback={null}><GlobalNav /></Suspense>}

                    <main id="main-content" className={isAuthenticated ? "pt-44 pb-32 lg:pb-0 lg:pt-20" : "w-full"} role="main">
                      <Routes>
                        {/* Public routes - Authentication & Info Pages */}
                        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
                        <Route path="/maonovault" element={<Suspense fallback={<PageLoading />}><MaonoVaultLandingLazy /></Suspense>} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        {/* Admin Authentication Routes - Dedicated Admin Pages */}
                        <Route path="/admin-login" element={<Suspense fallback={<PageLoading />}><AdminLoginLazy /></Suspense>} />
                        <Route path="/admin-register" element={<Suspense fallback={<PageLoading />}><AdminRegisterLazy /></Suspense>} />
                        {/* Legacy Superuser Routes - Commented out in favor of dedicated admin pages above */}
                        {/* <Route path="/superuser-login" element={<Register1Raw />} /> */}
                        {/* <Route path="/superuser-register" element={<Register1Raw adminMode={true} />} /> */}
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
                        {/* FAQ moved to lazy `FAQCenter` route further down to avoid duplicate routes */}
                        <Route path="/contact" element={
                          <div className="p-8 max-w-4xl mx-auto">
                            <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
                            <p className="text-gray-600">Get in touch with the Mtaa DAO team.</p>
                          </div>
                        } />

                        {/* Protected routes */}
                        {/* WEEK 1 UPDATE: Use new PersonalizedDashboard */}
                        <Route path="/dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><PersonalizedDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/create-dao" element={<ProtectedRoute><Suspense fallback={<PageLoading message="Loading Create DAO..." />}><CreateDaoLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/proposals" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ProposalsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/proposals/:id" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ProposalDetailLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/vault" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/vault-dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/vault-overview" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultOverviewLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/create-vault" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><CreateVaultLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/kyc" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><KYCLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ProfileLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/daos" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DAOsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/referrals" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ReferralsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SettingsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/session-settings" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SessionSettingsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
                        <Route path="/transaction-limits" element={<TransactionLimitsPage />} />
                        <Route path="/analytics" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AnalyticsPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/opportunities" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><OpportunitiesPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/tasks" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><TaskBountyBoardPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/rewards" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><RewardsHubLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/my-rewards" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><MyRewardsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/investment-pools" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><InvestmentPoolsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/investment-pools/discover" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><PoolDiscovery /></Suspense></ProtectedRoute>} />
                        <Route path="/investment-pools/:id" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><InvestmentPoolDetailLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/escrow" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><EscrowPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/escrow/accept/:inviteCode" element={<Suspense fallback={<PageLoading />}><EscrowAcceptLazy /></Suspense>} />
                        <Route path="/nft-marketplace" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><NFTMarketplace /></Suspense></ProtectedRoute>} />
                        <Route path="/strategy/:id" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><StrategyDetailLazy /></Suspense></ProtectedRoute>} />
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
                          <Route index element={<Wallet />} />
                          <Route path="dashboard" element={<WalletDashboard />} />
                          <Route path="batch-transfer" element={<BatchTransfer />} />
                          <Route path="multisig" element={<Multisig />} />
                          <Route path="dao-treasury" element={<DaoTreasury />} />
                          <Route path="bill-split" element={<Suspense fallback={<PageLoading />}><BillSplitPageLazy /></Suspense>} />
                          <Route path="recurring-payments" element={<Suspense fallback={<PageLoading />}><RecurringPaymentsPageLazy /></Suspense>} />
                        </Route>
                        {/* Admin routes - New Week 2 Dashboard */}
                        <Route path="/admin" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AdminLayoutLazy /></Suspense></ProtectedRoute>}>
                          <Route index element={<Navigate to="/admin/analytics" replace />} />
                          <Route path="analytics" element={<Suspense fallback={<PageLoading />}><AdminAnalyticsLazy /></Suspense>} />
                          <Route path="settings" element={<Suspense fallback={<PageLoading />}><AdminSettingsLazy /></Suspense>} />
                          <Route path="users" element={<Suspense fallback={<PageLoading />}><AdminUsersLazy /></Suspense>} />
                          <Route path="beta-access" element={<Suspense fallback={<PageLoading />}><AdminBetaAccessLazy /></Suspense>} />
                          <Route path="daos" element={<Suspense fallback={<PageLoading />}><AdminDAOsLazy /></Suspense>} />
                          <Route path="health" element={<Suspense fallback={<PageLoading />}><AdminHealthLazy /></Suspense>} />
                          <Route path="ai-monitoring" element={<Suspense fallback={<PageLoading />}><AILayerMonitoringLazy /></Suspense>} />
                          {/* Admin Monitoring Hub */}
                          <Route path="monitoring" element={<Suspense fallback={<PageLoading />}><AdminMonitoringHubLazy /></Suspense>} />
                          {/* Admin Monitoring Pages */}
                          <Route path="dashboard-overview" element={<Suspense fallback={<PageLoading />}><AdminDashboardOverviewLazy /></Suspense>} />
                          <Route path="defi-monitoring" element={<Suspense fallback={<PageLoading />}><AdminDeFiMonitoringLazy /></Suspense>} />
                          <Route path="cefi-monitoring" element={<Suspense fallback={<PageLoading />}><AdminCeFiMonitoringLazy /></Suspense>} />
                          <Route path="health-monitoring" element={<Suspense fallback={<PageLoading />}><AdminHealthMonitoringLazy /></Suspense>} />
                          <Route path="liquidity-monitoring" element={<Suspense fallback={<PageLoading />}><AdminLiquidityMonitoringLazy /></Suspense>} />
                          <Route path="revenue-tracking" element={<Suspense fallback={<PageLoading />}><AdminRevenueTrackingLazy /></Suspense>} />
                          <Route path="payment-providers" element={<Suspense fallback={<PageLoading />}><AdminPaymentProvidersLazy /></Suspense>} />
                          <Route path="agent-monitoring" element={<Suspense fallback={<PageLoading />}><AdminAgentMonitoringLazy /></Suspense>} />
                          {/* Admin Additional Monitoring Pages */}
                          <Route path="growth" element={<Suspense fallback={<PageLoading />}><AdminPlatformGrowthLazy /></Suspense>} />
                          <Route path="api-usage" element={<Suspense fallback={<PageLoading />}><AdminAPIUsageLazy /></Suspense>} />
                          <Route path="tokenomics" element={<Suspense fallback={<PageLoading />}><AdminTokenomicsLazy /></Suspense>} />
                          <Route path="support-tickets" element={<Suspense fallback={<PageLoading />}><AdminSupportTicketsLazy /></Suspense>} />
                          {/* Admin Community & Engagement Pages */}
                          <Route path="referrals" element={<Suspense fallback={<PageLoading />}><AdminReferralsLazy /></Suspense>} />
                          <Route path="leaderboard" element={<Suspense fallback={<PageLoading />}><AdminLeaderboardLazy /></Suspense>} />
                          <Route path="rewards" element={<Suspense fallback={<PageLoading />}><AdminRewardsLazy /></Suspense>} />
                          <Route path="achievements" element={<Suspense fallback={<PageLoading />}><AdminAchievementsLazy /></Suspense>} />
                          <Route path="announcements" element={<Suspense fallback={<PageLoading />}><AdminAnnouncementsLazy /></Suspense>} />
                          <Route path="dao-analytics" element={<Suspense fallback={<PageLoading />}><AdminDAOAnalyticsLazy /></Suspense>} />
                          <Route path="billing" element={<ProtectedRoute><AdminBillingDashboard /></ProtectedRoute>} />
                          <Route path="payments" element={<ProtectedRoute><PaymentReconciliation /></ProtectedRoute>} />
                        </Route>
                        {/* Legacy Admin routes */}
                        <Route path="/superuser" element={<SuperuserRoute><SuperUserDashboard /></SuperuserRoute>} />
                        <Route path="/admin-old/users" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><UserManagementLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin-old/daos" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DaoModerationLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin-old/settings" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SystemSettingsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin-old/security" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SecurityAuditLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin-old/announcements" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AnnouncementsManagementLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin-old/pools" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><PoolManagementLazy /></Suspense></ProtectedRoute>} />
                        {/* Moved admin billing/payments under /admin layout so they render with admin sidebar */}
                        {/* Protected special routes */}
                        <Route path="/architect-setup" element={<ProtectedRoute><ArchitectSetupPage /></ProtectedRoute>} />
                        <Route path="/wallet-setup" element={<ProtectedRoute><WalletSetupPage /></ProtectedRoute>} />
                        <Route path="/subprofile-selection" element={<ProtectedRoute><SubprofileSelectionPage /></ProtectedRoute>} />
                        {/* Unified Trading Hub - Scalable to 100+ exchanges */}
                        <Route path="/trading" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><TradingPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/yuki-dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><YukiDashboardPageLazy /></Suspense></ProtectedRoute>} />
                        {/* Legacy Exchange Markets - Phase 1 & 2 CCXT Integration */}
                        <Route path="/exchange-markets" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ExchangeMarketsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/defi-dex" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DeFiDEXAnalyticsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/leaderboard" element={<ReputationLeaderboard />} />
                        <Route path="/reputation-dashboard" element={<ReputationDashboard />} />
                        <Route path="/minipay" element={<ProtectedRoute><MiniPayDemo /></ProtectedRoute>} />
                        <Route path="/checkout" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><CheckoutLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/subscribe" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SubscribeLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/achievements" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AchievementSystemPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/analyzer" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AnalyzerDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/defender" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DefenderMonitorLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/elders" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><EldersPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/events" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><EventsPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/escrow-analytics" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><EscrowAnalyticsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/escrow/:id" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><EscrowDetailLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/synchronizer" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SynchronizerMonitorLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/treasury-intelligence" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><TreasuryIntelligenceLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/unified-dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><UnifiedDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/revenue-dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><RevenueDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/maonovault-dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><MaonoVaultDashboardLazy /></Suspense></ProtectedRoute>} />
                        {/* Vault & Staking Routes (NEW - Session Complete) */}
                        <Route path="/vaults" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultListPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/vaults/:vaultId" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultDetailRoute /></Suspense></ProtectedRoute>} />
                        <Route path="/my-vaults" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><MyVaultsPageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/staking" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><StakingComponentLazy /></Suspense></ProtectedRoute>} />
                        {/* Cross-chain bridge route */}
                        <Route path="/cross-chain" element={<ProtectedRoute><CrossChainHub /></ProtectedRoute>} />
                        <Route path="/cross-chain/bridge" element={<ProtectedRoute><CrossChainBridgePage /></ProtectedRoute>} />
                        <Route path="/cross-chain/swap" element={<ProtectedRoute><CrossChainSwapPage /></ProtectedRoute>} />
                        {/* Catch-all 404 */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>

                    {isAuthenticated && <Suspense fallback={null}><MobileNav /></Suspense>}
                    {isAuthenticated && <MorioFloatingChat />}
                  </div>
                </MorioProvider>              </PersonaProvider>              </TooltipProvider>
            </ThemeProvider>
          </NavigationProvider>
      </HelmetProvider>
    );
  } catch (error) {
    console.error('App component error:', error);
    return (
      <div className="p-5 text-red-600 bg-black">
        <h1>Error Loading Application</h1>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }
}

export default App;