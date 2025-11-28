import { ArrowRight, TrendingUp, Lock, BarChart3, Users, Shield, DollarSign, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';

export default function MaanoVaultLanding() {
  const features = [
    {
      icon: TrendingUp,
      title: "Earn 8-15% APY",
      description: "Professional DeFi yield strategies managed by our expert team. Your money works harder.",
      gradient: "from-green-400 to-emerald-500"
    },
    {
      icon: Lock,
      title: "Smart Locking",
      description: "Lock your funds for bonus interest. Build discipline while earning more.",
      gradient: "from-blue-400 to-cyan-500"
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Track every deposit, return, and transaction. Transparency you can trust.",
      gradient: "from-purple-400 to-pink-500"
    },
    {
      icon: Users,
      title: "Community Pools",
      description: "Pool funds with your group to unlock higher yields and shared benefits.",
      gradient: "from-orange-400 to-red-500"
    },
    {
      icon: Shield,
      title: "Multi-Sig Security",
      description: "Your funds protected by multi-signature wallets. Enterprise-grade security.",
      gradient: "from-indigo-400 to-blue-500"
    },
    {
      icon: Zap,
      title: "Instant Access",
      description: "Withdraw anytime (except during lock periods). Your money, your control.",
      gradient: "from-yellow-400 to-orange-500"
    }
  ];

  const benefits = [
    "No minimum investment required",
    "Transparent fee structure (only 2% management fee)",
    "Automated yield farming strategies",
    "Mobile & web access 24/7",
    "Daily NAV updates",
    "Referral bonuses up to 5%",
    "Multi-chain support (Ethereum, Polygon, Celo)",
    "KYC-based access tiers"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl top-10 left-10" />
        <div className="absolute w-80 h-80 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl bottom-20 right-10" />
      </div>

      {/* Header */}
      <header className="w-full py-4 px-6 flex items-center justify-between bg-gradient-to-r from-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-white/10 z-40 sticky top-0 relative">
        <Link href="/maonovault">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-lg text-white">MaanoVault</span>
          </div>
        </Link>
        <div className="flex gap-4">
          <Link href="/maonovault">
            <Button variant="outline" className="text-white border-white/30 hover:bg-white/10">
              Back to Mtaa
            </Button>
          </Link>
          <Link href="/vault">
            <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white">
              Launch Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative">
        <div className="text-center mb-16">
          <Badge className="mb-6 bg-emerald-500/20 border-emerald-500/50 text-emerald-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Professional DeFi Vaults for Everyone
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Grow Your <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">Money</span> Automatically
          </h1>
          
          <p className="text-xl text-purple-200 max-w-3xl mx-auto mb-8 leading-relaxed">
            Smart yield farming strategies designed for Kenyans. Earn 8-15% APY on your crypto without worrying about the complexity.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-12">
            <Link href="/vault">
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white px-8 py-6 text-lg font-bold rounded-xl">
                Get Started Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg font-bold rounded-xl">
              Learn More
            </Button>
          </div>

          <p className="text-sm text-purple-300">
            No credit card required • Start with as little as KES 100 • Your funds are secure
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-4 py-16 relative">
        <h2 className="text-4xl font-black text-white text-center mb-12">What You Can Do</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card key={idx} className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300 p-6">
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-purple-200 text-sm">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-6xl mx-auto px-4 py-16 relative">
        <h2 className="text-4xl font-black text-white text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { num: "1", title: "Connect Wallet", desc: "Link your crypto wallet (MetaMask, Ledger, etc.)" },
            { num: "2", title: "Deposit Funds", desc: "Send USDT, CELO, cUSD or other supported tokens" },
            { num: "3", title: "Earn Yields", desc: "Our strategies automatically work to grow your money" },
            { num: "4", title: "Withdraw Anytime", desc: "Take your money out whenever you need it" }
          ].map((step, idx) => (
            <div key={idx} className="relative">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-purple-200 text-sm">{step.desc}</p>
              </div>
              {idx < 3 && (
                <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                  <ArrowRight className="w-6 h-6 text-orange-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-4xl mx-auto px-4 py-16 relative">
        <Card className="bg-gradient-to-r from-purple-900/50 to-slate-900/50 border-white/20 p-12">
          <h2 className="text-3xl font-black text-white mb-8 flex items-center gap-2">
            <Shield className="w-8 h-8 text-emerald-400" />
            Why Choose MaanoVault?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-1" />
                <span className="text-white">{benefit}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { stat: "$50M+", label: "Total Assets Under Management" },
            { stat: "12.5%", label: "Average Annual Yield" },
            { stat: "5,000+", label: "Active Investors" }
          ].map((item, idx) => (
            <div key={idx} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
              <div className="text-4xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent mb-2">
                {item.stat}
              </div>
              <p className="text-purple-200">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 py-20 relative text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
          Start Growing Your Wealth Today
        </h2>
        <p className="text-xl text-purple-200 mb-8 max-w-2xl mx-auto">
          Join thousands of Kenyans earning passive income with MaanoVault. No experience needed.
        </p>
        <Link href="/vault">
          <Button size="lg" className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white px-10 py-6 text-xl font-bold rounded-xl shadow-2xl">
            Launch MaanoVault Now
            <ArrowRight className="w-6 h-6 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 px-6 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-t border-white/10 text-center text-purple-200 relative">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm">© 2025 Mtaa DAO • MaanoVault is part of the Mtaa ecosystem</p>
        </div>
      </footer>
    </div>
  );
}
