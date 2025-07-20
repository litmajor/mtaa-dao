import React, { useState, useEffect } from "react";

const pricingTiers = [
  {
    name: "Free DAO",
    priceMonthly: "KES 0",
    priceYearly: "KES 0",
    features: [
      "Public DAO",
      "Max 25 members",
    ],
    unavailable: [
      "Private DAO (invite-only)",
      "Elder/Admin vetting",
      "Treasury analytics + disbursement alerts",
      "Vault dashboard + multiple vaults",
      "Reputation ranking, proposal history",
    ],
    cta: "Create Free DAO",
    highlight: false,
    gradient: "from-slate-600 to-slate-800"
  },
  {
    name: "Premium DAO",
    priceMonthly: "KES 1,500/mo or $9.99/mo",
    priceYearly: "KES 15,000/yr or $99/yr",
    features: [
      "Public & Private DAO (invite-only)",
      "Unlimited members",
      "Elder/Admin vetting",
      "Treasury analytics + disbursement alerts",
      "Vault dashboard + multiple vaults",
      "Reputation ranking, proposal history",
    ],
    unavailable: [],
    cta: "Upgrade to Premium",
    highlight: true,
    gradient: "from-orange-500 via-pink-500 to-purple-600"
  },
];

const feeTable = [
  {
    action: "Vault disbursement",
    fee: "1–2% per action",
    notes: "Deducted from vault at disbursement",
  },
  {
    action: "Offramp withdrawals",
    fee: "2–3% (DAO or user)",
    notes: "Configurable per DAO policy",
  },
  {
    action: "Bulk payouts / voting rewards",
    fee: "Flat or % fee",
    notes: "Optionally subsidized by DAO treasury",
  },
  {
    action: "Earn yield via staking",
    fee: "Platform takes cut (opt-in)",
    notes: "Future: DAO earns + platform takes share",
  },
];

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
};

const FloatingParticles = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 20,
      duration: Math.random() * 20 + 10,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-gradient-to-r from-orange-400/20 to-pink-400/20 animate-pulse"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

export default function PricingPage() {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      <FloatingParticles />
      
      {/* Dynamic cursor glow */}
      <div 
        className="fixed pointer-events-none z-50 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-r from-orange-400 to-pink-400 transition-all duration-300"
        style={{
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
      />

      <div className="max-w-7xl mx-auto py-20 px-4 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-block mb-6">
            <div className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent text-7xl font-black tracking-tight animate-pulse">
              MtaaDAO
            </div>
            <div className="h-2 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 rounded-full mt-2 animate-pulse" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
            Revolutionary Pricing
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Sustainable, group-first pricing for grassroots DAOs. 
            <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent font-semibold"> Only pay for what your group needs.</span>
          </p>

          {/* Animated stats */}
          <div className="flex justify-center gap-12 mb-12">
            {[
              { number: "10K+", label: "Active DAOs" },
              { number: "500K+", label: "Members" },
              { number: "99.9%", label: "Uptime" }
            ].map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                  {stat.number}
                </div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle Section */}
        <div className="flex justify-center items-center gap-6 mb-16">
          <span className={`text-xl font-bold transition-all duration-300 ${!isYearly ? 'text-orange-400 scale-110' : 'text-gray-400'}`}>
            Monthly
          </span>
          <div className="relative">
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`${isYearly ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-gray-600'} relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 shadow-lg cursor-pointer`}
            >
              <span className="sr-only">Toggle billing</span>
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-300 ${isYearly ? 'translate-x-9' : 'translate-x-1'}`}
              />
            </button>
            {isYearly && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce">
                Save 17%!
              </div>
            )}
          </div>
          <span className={`text-xl font-bold transition-all duration-300 ${isYearly ? 'text-orange-400 scale-110' : 'text-gray-400'}`}>
            Yearly
          </span>
        </div>

        {/* CTA Button */}
        <div className="flex justify-center mb-16">
          <button
            className="relative group px-12 py-4 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-orange-500/25 transition-all duration-300 transform hover:scale-105 overflow-hidden"
            onClick={() => setPaymentOpen(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-pink-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex items-center gap-3">
              <span>🚀</span>
              Upgrade to Premium
              <span>✨</span>
            </div>
            <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          {pricingTiers.map((tier, index) => (
            <div
              key={tier.name}
              className={`relative group p-8 rounded-3xl backdrop-blur-xl border transition-all duration-500 hover:scale-105 ${
                tier.highlight 
                  ? 'bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-purple-600/10 border-orange-500/50 shadow-2xl shadow-orange-500/20' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
              style={{
                animationDelay: `${index * 0.2}s`,
              }}
            >
              {tier.highlight && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                  🔥 POPULAR
                </div>
              )}
              
              <div className="text-center mb-8">
                <h2 className={`text-3xl font-bold mb-4 ${tier.highlight ? 'bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent' : 'text-white'}`}>
                  {tier.name}
                </h2>
                <div className={`text-4xl font-black mb-2 ${tier.highlight ? 'bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent' : 'text-white'}`}>
                  {isYearly ? tier.priceYearly : tier.priceMonthly}
                </div>
                {tier.name === "Premium DAO" && (
                  <div className="text-sm text-gray-400">
                    {isYearly ? "Save KES 3,000 annually" : "Billed monthly"}
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-8">
                {tier.features.map((feature, i) => (
                  <div key={i} className="flex items-center text-emerald-300 group-hover:text-emerald-200 transition-colors duration-300">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 flex items-center justify-center mr-3 text-white text-sm font-bold">
                      ✓
                    </div>
                    <span className="text-lg">{feature}</span>
                  </div>
                ))}
                {tier.unavailable.map((feature, i) => (
                  <div key={i} className="flex items-center text-gray-500 opacity-70">
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center mr-3 text-white text-sm">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 8V6a4 4 0 118 0v2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="4" y="8" width="12" height="8" rx="2" fill="#fff" fillOpacity="0.2" stroke="#fff" strokeWidth="2"/>
                        <line x1="10" y1="12" x2="10" y2="14" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="text-lg line-through mr-2">{feature}</span>
                    <span className="text-xs bg-gradient-to-r from-orange-500 to-pink-500 text-white px-2 py-0.5 rounded-full ml-1 font-semibold">Premium only</span>
                  </div>
                ))}
              </div>

              <button 
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all duration-300 transform hover:scale-105 ${
                  tier.highlight 
                    ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:from-orange-600 hover:to-pink-600 shadow-orange-500/25' 
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Platform Fees Section */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Platform Fees
          </h2>
          <div className="backdrop-blur-xl bg-white/5 rounded-3xl p-8 border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="py-4 px-6 text-left text-lg font-semibold text-orange-400">Action</th>
                    <th className="py-4 px-6 text-left text-lg font-semibold text-pink-400">Fee</th>
                    <th className="py-4 px-6 text-left text-lg font-semibold text-purple-400">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {feeTable.map((row, index) => (
                    <tr key={row.action} className="border-b border-white/10 hover:bg-white/5 transition-colors duration-300">
                      <td className="py-4 px-6 text-white font-medium">{row.action}</td>
                      <td className="py-4 px-6 text-orange-300 font-bold">{row.fee}</td>
                      <td className="py-4 px-6 text-gray-400">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className="mb-16 p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl border border-yellow-500/30 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="text-3xl">💡</div>
            <div>
              <strong className="text-yellow-300">Important:</strong>
              <span className="text-gray-200 ml-2">
                Fees are paid by the DAO/group, not individuals. All fees are abstracted into vault mechanics for simplicity.
              </span>
            </div>
          </div>
        </div>

        {/* Token Ecosystem */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Reputation & Token Ecosystem
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Vote Tokens",
                icon: "🗳️",
                description: "Tokenized voting rights, required for major decisions. Can be purchased or earned.",
                gradient: "from-blue-500 to-purple-600"
              },
              {
                title: "MsiaMo Points",
                icon: "⭐",
                description: "Non-transferable reputation, earned through activity, referrals, and participation.",
                gradient: "from-emerald-500 to-blue-500"
              },
              {
                title: "Badges & Rewards",
                icon: "🏆",
                description: "Badges, leaderboards, and advanced features unlock as your reputation grows.",
                gradient: "from-orange-500 to-pink-500"
              }
            ].map((item, index) => (
              <div key={index} className="group p-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${item.gradient} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                <p className="text-gray-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center">
          <div className="inline-block p-6 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
            <p className="text-gray-300 text-lg">
              Need something custom? 
              <span className="text-orange-400 font-semibold ml-2">Contact us for enterprise features.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}