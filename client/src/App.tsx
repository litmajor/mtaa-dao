import ArchitectSetupPage from './pages/architect-setup';
import Login from "./components/Login";
import Register from "./components/Register";
import Referrals from "./pages/referrals";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { ThemeProvider } from "./components/theme-provider";
import { useAuth } from "./pages/hooks/useAuth";
import { Helmet, HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "./components/ErrorBoundary";
import { AsyncErrorBoundary } from "./components/AsyncErrorBoundary";
import { SkipLink } from "./components/ui/skip-link";
import { PageLoading } from "./components/ui/page-loading";

import SuperUserDashboard from './components/SuperUserDashboard';
import Navigation from "./components/navigation";
import MobileNav from "./components/mobile-nav";

import Landing from "./pages/landing";
import Dashboard from "./pages/dashboard";
import Proposals from "./pages/proposals";
import Vault from "./pages/vault";
import Profile from "./pages/profile";
import DAOs from "./pages/daos";

import Wallet from "./pages/wallet";
import WalletDashboard from "./components/WalletDashboard";
import BatchTransfer from "./components/batch-transfer";
import Multisig from "./components/multisig";
import DaoTreasury from "./components/dao-treasury";

import NotFound from "./pages/not-found";
import ForgotPassword from "./pages/forgot-password";

import PricingPage from "./pages/PricingPage";
import AdminBillingDashboard from "./pages/AdminBillingDashboard";
import DaoSettings from "./pages/DaoSettings";
import ReputationLeaderboard from "./pages/ReputationLeaderboard";
import MaonoVaultWeb3Page from "./pages/maonovault-web3";
import AnalyticsPage from "./pages/AnalyticsPage";


function Router() {
  // Check authentication status  
  // This will determine which routes are accessible
  // and whether to show the navigation or not
  // If the user is not authenticated, they will see the landing page
  // If authenticated, they will see the dashboard and other routes
  // This is a simplified version of the authentication check
  // In a real application, you would likely use a context or state management solution
  // to handle authentication status across the app
 
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Loading Mtaa DAO..." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <Helmet>
        <title>{isAuthenticated ? "Dashboard | Mtaa DAO" : "Welcome | Mtaa DAO"}</title>
        <meta name="description" content="Mtaa DAO — decentralized community finance platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#1e40af" />
      </Helmet>

      <Switch>
        {/* Public routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/architect-setup" component={ArchitectSetupPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/admin/billing" component={AdminBillingDashboard} />
        <Route path="/leaderboard" component={ReputationLeaderboard} />
        <Route path="/dao/settings" component={() => <DaoSettings />} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/maonovault-web3" component={MaonoVaultWeb3Page} />
        <Route path="/maonovault" component={MaonoVaultWeb3Page} />
        <Route path="/superuser" component={SuperUserDashboard} />
        {/* Unaccounted for / extra routes */}
        <Route path="/about" component={() => <div className="p-8">About Mtaa DAO (placeholder)</div>} />
        <Route path="/help" component={() => <div className="p-8">Help &amp; Support (placeholder)</div>} />
        <Route path="/faq" component={() => <div className="p-8">Frequently Asked Questions (placeholder)</div>} />
        <Route path="/contact" component={() => <div className="p-8">Contact Us (placeholder)</div>} />
        <Route path="/settings" component={() => <div className="p-8">User Settings (placeholder)</div>} />
        <Route path="/logout" component={() => <div className="p-8">Logging out... (placeholder)</div>} />
        {/* Main app routes */}
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Navigation />
            <main id="main-content" className="pb-16 lg:pb-0" role="main">
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/proposals" component={Proposals} />
              <Route path="/vault" component={Vault} />
              <Route path="/profile" component={Profile} />
              <Route path="/daos" component={DAOs} />
              <Route path="/wallet" component={Wallet} />
              <Route path="/wallet/dashboard" component={WalletDashboard} />
              <Route path="/wallet/batch-transfer" component={BatchTransfer} />
              <Route path="/wallet/multisig" component={Multisig} />
              <Route path="/wallet/dao-treasury" component={DaoTreasury} />
              <Route path="/referrals" component={Referrals} />
              <Route path="/maonovault" component={MaonoVaultWeb3Page} />
            </main>
            <MobileNav />
          </>
        )}
        {/* Catch-all for 404s */}
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <AsyncErrorBoundary>
            <ThemeProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </ThemeProvider>
          </AsyncErrorBoundary>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
