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
// Wallet page: lazy-load to enable code-splitting
const ReferralsLazy = lazy(() => import('./pages/referrals'));
const MorioDemoLazy = lazy(() => import('./pages/MorioDemo'));


const WalletLazy = lazy(() => import('./pages/wallet'));
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
// Visual Strategy Builder (heavy) — load only on demand
const VisualStrategyBuilderLazy = lazy(() => import('./components/trading/VisualStrategyBuilder'));
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
const WalletDashboardLazy = lazy(() => import('./components/WalletDashboard'));
import BatchTransfer from './components/batch-transfer';
import Multisig from './components/multisig';
const DaoTreasuryLazy = lazy(() => import('./components/dao-treasury'));
import ArchitectSetupPage from './pages/architect-setup';
import PricingPage from './pages/pricing';
import SubscriptionPage from './pages/subscription';
import TransactionLimitsPage from './pages/transaction-limits';
const AdminBillingDashboardLazy = lazy(() => import('./pages/AdminBillingDashboard'));
import ReputationLeaderboard from './pages/ReputationLeaderboard';
import ReputationDashboard from "./pages/ReputationDashboard";
const DaoSettingsLazy = lazy(() => import('./pages/DaoSettings'));
const SuperUserDashboardLazy = lazy(() => import('./components/SuperUserDashboard'));
import NotFound from './pages/not-found';
const PaymentReconciliationLazy = lazy(() => import('./pages/PaymentReconciliation'));
import MiniPayDemo from './pages/MiniPayDemo';
import SuccessStories from './pages/success-stories';
import WalletSetupPage from './pages/wallet-setup';
import SubprofileSelectionPage from './pages/subprofile-selection';

// DAO sub-pages
const DaoTreasuryOverviewLazy = lazy(() => import('./pages/dao/dao_treasury_overview'));
const ContributorListLazy = lazy(() => import('./pages/dao/contributor_list'));
const CommunityVaultAnalyticsLazy = lazy(() => import('./pages/dao/community_vault_analytics'));
const DisbursementsLazy = lazy(() => import('./pages/dao/disbursements'));
const TreasuryLazy = lazy(() => import('./pages/dao/treasury'));

// Payment pages
// Checkout and Subscribe are lazy-loaded later; remove unused static imports

// Cross-chain integration (lazy-loaded)
const CrossChainHubLazy = lazy(() => import('./pages/CrossChainHub'));
const CrossChainBridgePageLazy = lazy(() => import('./pages/CrossChainBridgePage'));
const CrossChainSwapPageLazy = lazy(() => import('./pages/CrossChainSwapPage'));
const NFTMarketplaceLazy = lazy(() => import('./pages/NFTMarketplace'));

// Subscription Management
import SubscriptionManagement from './pages/SubscriptionManagement';

// MaonoVault Management (lazy)
const MaonoVaultManagementLazy = lazy(() => import('@/pages/MaonoVaultManagement'));

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
// Additional pages discovered but not yet referenced in routes
const ActivityLazy = lazy(() => import('./pages/activity'));
const AnalyticsDashboardLazy = lazy(() => import('./pages/analytics-dashboard'));
const MorioHubLazy = lazy(() => import('./pages/morio-hub'));
const PaymentRequestsLazy = lazy(() => import('./pages/payment-requests'));
const ProtocolLazy = lazy(() => import('./pages/protocol'));
const VaultSuccessLazy = lazy(() => import('./pages/vault-success'));
const AuditViewerLazy = lazy(() => import('./pages/admin/AuditViewer'));
const RecoveryDashboardLazy = lazy(() => import('./pages/admin/RecoveryDashboard'));
const SecuritySettingsLazy = lazy(() => import('./pages/admin/SecuritySettings'));
const VaultAnalyticsDashboardLazy = lazy(() => import('./pages/analytics/vault_analytics_dashboard'));
const DaoMembersLazy = lazy(() => import('./pages/dao/[id]/members'));
const DaoProgressBarLazy = lazy(() => import('./pages/dao/[id]/ProgressBar').then(m => ({ default: (m as any).default || (m as any).ProgressBar || (m as any).ProgressBarComponent })));
const DaoRulesLazy = lazy(() => import('./pages/dao/[id]/rules'));
const InviteTokenLazy = lazy(() => import('./pages/invite/[token]'));
// Additional new pages (stubs) — heavy or missing pages to be code-split
const ApiKeysLazy = lazy(() => import('./pages/api-keys'));
const DeveloperConsoleLazy = lazy(() => import('./pages/developer-console'));
const WalletIntegrationsLazy = lazy(() => import('./pages/wallet-integrations'));
const OnboardingWizardLazy = lazy(() => import('./pages/onboarding'));
const AccountSecurityLazy = lazy(() => import('./pages/account-security'));
const NotificationsSettingsLazy = lazy(() => import('./pages/notifications'));
const SystemStatusLazy = lazy(() => import('./pages/system-status'));
const ChartsHubLazy = lazy(() => import('./pages/charts-hub'));
const StrategyGalleryLazy = lazy(() => import('./pages/strategy-gallery'));
const ApiDocsLazy = lazy(() => import('./pages/api-docs'));
const BillingLazy = lazy(() => import('./pages/billing'));

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
                        {/* New feature pages (code-split stubs) */}
                        <Route path="/developer/api-keys" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ApiKeysLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/developer/console" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DeveloperConsoleLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/wallet/integrations" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><WalletIntegrationsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/onboarding" element={<Suspense fallback={<PageLoading />}><OnboardingWizardLazy /></Suspense>} />
                        <Route path="/account/security" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AccountSecurityLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/notifications" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><NotificationsSettingsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/status" element={<Suspense fallback={<PageLoading />}><SystemStatusLazy /></Suspense>} />
                        <Route path="/charts" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ChartsHubLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/strategies/gallery" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><StrategyGalleryLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/docs/api" element={<Suspense fallback={<PageLoading />}><ApiDocsLazy /></Suspense>} />
                        <Route path="/billing" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><BillingLazy /></Suspense></ProtectedRoute>} />
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
                        <Route path="/nft-marketplace" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><NFTMarketplaceLazy /></Suspense></ProtectedRoute>} />
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
                          <Route path="settings" element={<Suspense fallback={<PageLoading />}><DaoSettingsLazy /></Suspense>} />
                          <Route path="treasury" element={<Suspense fallback={<PageLoading />}><TreasuryLazy /></Suspense>} />
                          <Route path="treasury-overview" element={<Suspense fallback={<PageLoading />}><DaoTreasuryOverviewLazy /></Suspense>} />
                          <Route path="contributors" element={<Suspense fallback={<PageLoading />}><ContributorListLazy /></Suspense>} />
                          <Route path="analytics" element={<Suspense fallback={<PageLoading />}><CommunityVaultAnalyticsLazy /></Suspense>} />
                          <Route path="disbursements" element={<Suspense fallback={<PageLoading />}><DisbursementsLazy /></Suspense>} />
                        </Route>
                        {/* Nested Wallet routes */}
                        <Route path="/wallet" element={<ProtectedRoute><WalletLayout /></ProtectedRoute>}>
                          <Route index element={<Suspense fallback={<PageLoading />}><WalletLazy /></Suspense>} />
                          <Route path="dashboard" element={<Suspense fallback={<PageLoading />}><WalletDashboardLazy /></Suspense>} />
                          <Route path="batch-transfer" element={<BatchTransfer />} />
                          <Route path="multisig" element={<Multisig />} />
                          <Route path="dao-treasury" element={<Suspense fallback={<PageLoading />}><DaoTreasuryLazy /></Suspense>} />
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
                          <Route path="billing" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AdminBillingDashboardLazy /></Suspense></ProtectedRoute>} />
                          <Route path="payments" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><PaymentReconciliationLazy /></Suspense></ProtectedRoute>} />
                        </Route>
                        {/* Legacy Admin routes */}
                        <Route path="/superuser" element={<SuperuserRoute><Suspense fallback={<PageLoading />}><SuperUserDashboardLazy /></Suspense></SuperuserRoute>} />
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
                        {/* Visual Strategy Builder (code-split) */}
                        <Route path="/builder" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VisualStrategyBuilderLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/builder/:id" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VisualStrategyBuilderLazy /></Suspense></ProtectedRoute>} />
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
                        <Route path="/cross-chain" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><CrossChainHubLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/cross-chain/bridge" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><CrossChainBridgePageLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/cross-chain/swap" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><CrossChainSwapPageLazy /></Suspense></ProtectedRoute>} />
                        {/* Additional discovered pages (previously unreferenced) */}
                        <Route path="/activity" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ActivityLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/analytics-dashboard" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AnalyticsDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/morio-hub" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><MorioHubLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/payment-requests" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><PaymentRequestsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/protocol" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ProtocolLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/vault-success" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultSuccessLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin/audit-viewer" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><AuditViewerLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin/recovery" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><RecoveryDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/admin/security-settings" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><SecuritySettingsLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/analytics/vaults" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><VaultAnalyticsDashboardLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/dao/:id/members" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DaoMembersLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/dao/:id/progress" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DaoProgressBarLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/dao/:id/rules" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><DaoRulesLazy /></Suspense></ProtectedRoute>} />
                        <Route path="/invite/:token" element={<Suspense fallback={<PageLoading />}><InviteTokenLazy /></Suspense>} />
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