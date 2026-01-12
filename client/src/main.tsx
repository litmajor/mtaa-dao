


import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ToastProvider } from "./components/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import AppLoading from "./components/ui/app-loading";
import ErrorBoundary from "./components/ErrorBoundary";
import { FeaturesProvider } from "./contexts/features-context";
import { AuthProvider } from "./contexts/auth-context";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./config/wagmi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      networkMode: 'offlineFirst', // Handle offline scenarios
    },
  },
});

const root = document.getElementById("root");

console.log('Root element:', root);

if (root) {
  console.log('Creating React root');
  createRoot(root).render(
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <FeaturesProvider>
            <BrowserRouter>
              <AuthProvider>
                <WagmiProvider config={wagmiConfig}>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </WagmiProvider>
              </AuthProvider>
            </BrowserRouter>
          </FeaturesProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
  console.log('React app rendered');
} else {
  console.error('Root element not found');
}

