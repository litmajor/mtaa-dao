/**
 * /app/page.tsx
 * MTAA Protocol home/landing page
 * URL: /
 * Redirects to dashboard or shows welcome screen
 */

"use client";

import { useEffect } from 'react';
import Shell from '../client/src/components/ui/shell';
import Link from 'next/link';
import { Grid } from '../client/src/components/ui/grid';
import { Card } from '../client/src/components/ui/card';

export default function Home() {
  // Auto-redirect to dashboard (can be modified for auth check)
  useEffect(() => {
    let mounted = true;

    async function checkAuthAndRoute() {
      try {
        const res = await fetch('/api/auth_user', { credentials: 'include' });
        if (!mounted) return;

        if (res.ok) {
          const payload = await res.json();
          const user = payload?.data?.user;

          const routes: Record<string, string> = {
            okedi: '/dashboard/okedi',
            yuki: '/dashboard/yuki',
            amara: '/dashboard/amara',
          };

          const dest = user?.activeSubprofile ? routes[user.activeSubprofile] : null;

          if (dest) {
            const next = new URLSearchParams(window.location.search).get('next') || dest;
            window.location.href = next;
            return;
          }

          // If no persona chosen, send to onboarding (not to trading)
          const next = new URLSearchParams(window.location.search).get('next') || '/onboarding';
          window.location.href = next;
          return;
        }

        // not authenticated -> stay on landing
      } catch (err) {
        // network or server error -> keep showing landing
        // console.debug('Auth check failed', err);
      }
    }

    checkAuthAndRoute();

    return () => { mounted = false; };
  }, []);

  return (
    <Shell
      brand={
        <div className="text-2xl font-bold text-white">
          🚀 MTAA <span className="text-blue-400">Protocol</span>
        </div>
      }
      primaryNav={
        <nav className="p-4 text-sm text-slate-300" aria-label="top-nav">
          <a href="#features" className="block mb-2 hover:text-white">Features</a>
          <a href="#stats" className="block mb-2 hover:text-white">Stats</a>
        </nav>
      }
      userActions={
        <a
          href="/dashboard"
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
        >
          Open Dashboard
        </a>
      }
    >
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold">
            Your chama. Your wallet. One platform.
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Mtaa is where your chama lives on‑chain — pool money, make decisions together, and grow your capital. Keep trading and managing your own wallet, and when your group is ready, move pooled funds into shared vaults and coordinated strategies.
          </p>
          <div className="flex justify-center gap-4 pt-6">
            <a
              href="/dashboard"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition transform hover:scale-105"
            >
              Open Your Chama →
            </a>
            <a
              href="https://docs.mtaaprotocol.com"
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition"
            >
              Documentation
            </a>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mt-16 p-8 bg-slate-800/50 backdrop-blur rounded-lg border border-slate-700">
          <Grid columns={3} gap="lg">
            <Card className="text-center p-6">
              <div className="text-4xl mb-3">💱</div>
              <h3 className="text-xl font-bold mb-2">Multi-Exchange</h3>
              <p className="text-slate-400">Trade on Binance, Kraken, Coinbase, and more simultaneously</p>
            </Card>
            <Card className="text-center p-6">
              <div className="text-4xl mb-3">🧠</div>
              <h3 className="text-xl font-bold mb-2">Smart Routing</h3>
              <p className="text-slate-400">AI-powered order routing optimizes fees and execution speed</p>
            </Card>
            <Card className="text-center p-6">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="text-xl font-bold mb-2">Analytics</h3>
              <p className="text-slate-400">Real-time P&L, risk metrics, and performance analysis</p>
            </Card>
          </Grid>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold mb-12 text-center">Platform Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FeatureLong
            number="01"
            title="Trading Dashboard"
            description="Manage orders and positions across all connected exchanges in one interface"
            items={[
              'Real-time order tracking',
              'Multi-market support (spot, margin, futures)',
              'Quick order placement',
              'Position liquidation risk monitoring',
            ]}
          />
          <FeatureLong
            number="02"
            title="Analytics Engine"
            description="Comprehensive trading metrics and performance analysis"
            items={[
              'Win rate and P&L tracking',
              'Risk analysis (VaR, Sharpe, volatility)',
              'Fee optimization recommendations',
              'Diversification scoring',
            ]}
          />
          <FeatureLong
            number="03"
            title="Smart Routing"
            description="Intelligent order execution across exchanges"
            items={[
              'Fee comparison and optimization',
              'Liquidity detection',
              'Slippage minimization',
              'Smart split execution',
            ]}
          />
          <FeatureLong
            number="04"
            title="Security & Control"
            description="Enterprise-grade security and full control over your assets"
            items={[
              'API key encryption (AES-256-GCM)',
              'Audit trail logging',
              'Rate limiting and DDoS protection',
              'Two-factor authentication',
            ]}
          />
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold mb-12 text-center">Platform Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard number="6+" label="Exchanges Supported" />
          <StatCard number="35+" label="Trading Hooks" />
          <StatCard number="24/7" label="Real-time Data" />
          <StatCard number="99.9%" label="Uptime SLA" />
        </div>
      </section>

      {/* Navigation Map */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold mb-12 text-center">Dashboard Navigation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <NavCard
            icon="📊"
            title="Trading"
            description="Manage orders & positions"
            href="/dashboard"
          />
          <NavCard
            icon="📈"
            title="Analytics"
            description="Performance analysis"
            href="/dashboard/analytics"
          />
          <NavCard
            icon="⚙️"
            title="Settings"
            description="Configuration & preferences"
            href="/dashboard/settings"
          />
          <NavCard
            icon="🤖"
            title="Bots"
            description="Trading automation"
            href="/dashboard/bots"
          />
          <NavCard
            icon="📝"
            title="History"
            description="Trading history"
            href="/dashboard/history"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-12 rounded-lg">
          <h2 className="text-3xl font-bold mb-4">Ready to Trade Smarter?</h2>
          <p className="text-xl mb-6 text-blue-100">
            Connect your exchanges and start automated trading today
          </p>
          <a
            href="/dashboard"
            className="inline-block px-8 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-slate-100 transition transform hover:scale-105"
          >
            Get Started →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800/50 border-t border-slate-700 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-slate-400">
          <p>© 2024 MTAA Protocol. All rights reserved.</p>
        </div>
      </footer>
    </Shell>
  );
}

/**
 * FeatureCard Component
 */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}

/**
 * FeatureLong Component
 */
function FeatureLong({
  number,
  title,
  description,
  items,
}: {
  number: string;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg hover:border-slate-600 transition">
      <div className="text-4xl font-bold text-blue-400 mb-2">{number}</div>
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-slate-400 mb-6">{description}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-slate-300">
            <span className="text-blue-400">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * StatCard Component
 */
function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-lg text-center hover:border-slate-600 transition">
      <div className="text-3xl font-bold text-blue-400 mb-2">{number}</div>
      <div className="text-slate-400">{label}</div>
    </div>
  );
}

/**
 * NavCard Component
 */
function NavCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-slate-800/50 border border-slate-700 p-6 rounded-lg hover:border-blue-500 hover:bg-slate-700/50 transition transform hover:scale-105 text-center"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </Link>
  );
}
