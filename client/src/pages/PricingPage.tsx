import React, { useState, useEffect } from "react";
import { Check, Star, Zap, Shield, Users, DollarSign, TrendingUp, ArrowRight, Sparkles, Crown, Award, Target, Eye, Lock, AlertCircle, CheckCircle, Coins } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";

type UserPricingTier = {
  name: string;
  price: { daily?: string; weekly?: string; monthly: string; yearly: string };
  description: string;
  features: string[];
  limitations?: string[];
  cta: string;
  popular?: boolean;
  color: string;
  icon: React.ReactNode;
  badge?: string;
  vaultLimit: number;
};

type DaoPricingTier = {
  name: string;
  price: { monthly: string; yearly: string };
  description: string;
  features: string[];
  limitations?: string[];
  cta: string;
  popular?: boolean;
  color: string;
  icon: React.ReactNode;
  badge?: string;
};

const userPricingTiers: UserPricingTier[] = [
  {
    name: "Free",
    price: { monthly: "KES 0", yearly: "KES 0" },
    description: "Perfect for getting started with personal savings",
    features: [
      "Basic wallet features",
      "1 personal vault",
      "Standard analytics (weekly)",
      "Community support",
      "Transaction history",
      "Basic vault strategies",
    ],
    limitations: [
      "No advanced analytics",
      "No instant withdrawals",
      "Standard processing time",
      "Limited vault strategies",
    ],
    cta: "Get Started Free",
    color: "from-slate-600 to-slate-800",
    icon: <Users className="w-8 h-8 text-white" />,
    vaultLimit: 1
  },
  {
    name: "Premium",
    price: { daily: "KES 20", weekly: "KES 100", monthly: "KES 500", yearly: "KES 5,000" },
    description: "Advanced features for power savers",
    features: [
      "Everything in Free",
      "Up to 5 personal vaults",
      "Advanced analytics (daily)",
      "Instant withdrawals",
      "Priority support",
      "Custom vault strategies",
      "Ad-free experience",
      "Export reports (PDF/CSV)",
    ],
    cta: "Upgrade to Premium",
    popular: true,
    color: "from-orange-500 via-pink-500 to-purple-600",
    icon: <Crown className="w-8 h-8 text-white" />,
    badge: "Most Popular",
    vaultLimit: 5
  },
  {
    name: "Power",
    price: { daily: "KES 50", weekly: "KES 250", monthly: "KES 1,500", yearly: "KES 15,000" },
    description: "For serious investors and traders",
    features: [
      "Everything in Premium",
      "Up to 20 personal vaults",
      "AI-powered analytics",
      "Auto-rebalancing",
      "API access (100K requests/month)",
      "White-label options",
      "Dedicated account manager",
      "Custom integrations",
      "Multi-strategy automation",
    ],
    cta: "Go Power",
    color: "from-purple-600 to-indigo-600",
    icon: <Zap className="w-8 h-8 text-white" />,
    badge: "Power User",
    vaultLimit: 20
  }
];

const daoPricingTiers: DaoPricingTier[] = [
  {
    name: "Free DAO",
    price: { monthly: "KES 0", yearly: "KES 0" },
    description: "Perfect for starting your community journey (Per DAO)",
    features: [
      "Basic DAO creation (up to 50 members)",
      "Community vault (single vault)",
      "Basic proposals and voting",
      "Web and Telegram chat",
      "Standard AI analytics (weekly reports)",
      "Transaction limits: KES 1M/month",
      "Email support"
    ],
    limitations: [
      "No AI-assisted proposal drafting",
      "No advanced fraud detection",
      "Limited API access (1K requests/month)"
    ],
    cta: "Start Free",
    color: "from-slate-600 to-slate-800",
    icon: <Users className="w-8 h-8 text-white" />
  },
  {
    name: "Premium DAO",
    price: { monthly: "KES 1,500", yearly: "KES 15,000" },
    description: "Essential tools for growing communities (Per DAO)",
    features: [
      "Everything in Free",
      "Unlimited members",
      "Multiple vaults",
      "Advanced analytics (daily)",
      "Priority support",
      "Telegram + WhatsApp bots",
      "Transaction limits: KES 5M/month",
      "API access (10K requests/month)",
      "M-Pesa integration",
    ],
    cta: "Upgrade DAO",
    color: "from-blue-500 via-cyan-500 to-teal-600",
    icon: <Star className="w-8 h-8 text-white" />,
    badge: "Great Value",
    popular: true
  },
  {
    name: "Enterprise DAO",
    price: { monthly: "KES 15,000+", yearly: "Custom" },
    description: "Tailored solutions for large organizations",
    features: [
      "Everything in Premium",
      "White-label solution",
      "Custom integrations",
      "SLA guarantees (99.9% uptime)",
      "Unlimited transactions",
      "Unlimited API access",
      "Custom AI training",
      "On-chain governance NFTs",
      "24/7 dedicated support",
    ],
    cta: "Contact Sales",
    color: "from-purple-600 to-indigo-600",
    icon: <Shield className="w-8 h-8 text-white" />,
    badge: "Enterprise"
  }
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"user" | "dao">("user");
  const [selectedUserTier, setSelectedUserTier] = useState<string>("Premium");
  const [selectedDaoTier, setSelectedDaoTier] = useState<string>("Premium DAO");
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const yearlyDiscount = (monthly: string, yearly: string) => {
    const monthlyNum = parseFloat(monthly.replace(/[^\d.]/g, ''));
    const yearlyNum = parseFloat(yearly.replace(/[^\d.]/g, ''));
    if (monthlyNum && yearlyNum) {
      const savings = (monthlyNum * 12 - yearlyNum) / (monthlyNum * 12) * 100;
      return Math.round(savings);
    }
    return 0;
  };

  const FeatureItem = ({ feature, included = true }: { feature: string; included?: boolean }) => (
    <div className={`flex items-center space-x-3 ${included ? 'text-gray-700' : 'text-gray-400'}`}>
      {included ? (
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
          <Lock className="w-3 h-3 text-gray-400" />
        </div>
      )}
      <span className={`${included ? '' : 'line-through'}`}>{feature}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-purple-100 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-orange-300/30 to-red-300/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-purple-300/30 to-pink-300/30 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Dynamic cursor glow */}
      <div 
        className="fixed pointer-events-none w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-r from-orange-400 to-pink-400 transition-all duration-300 z-10"
        style={{
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
      />

      <div className="relative z-20 max-w-7xl mx-auto py-12 px-6">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="inline-block mb-6">
              <div className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent text-5xl md:text-7xl font-black tracking-tight">
                MtaaDAO Pricing
              </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Transparent Pricing for Everyone
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Whether you're an individual saver or managing a DAO,{" "}
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
                we've got you covered.
              </span>
            </p>
          </motion.div>
        </div>

        {/* Tabs for User vs DAO Pricing */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as "user" | "dao")} className="mb-12">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/80 backdrop-blur-xl p-1 rounded-2xl shadow-lg">
            <TabsTrigger value="user" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-pink-500 data-[state=active]:text-white rounded-xl">
              👤 Individual Users
            </TabsTrigger>
            <TabsTrigger value="dao" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-xl">
              🏛️ DAOs & Communities
            </TabsTrigger>
          </TabsList>

          {/* User Pricing Tab */}
          <TabsContent value="user" className="mt-12">
            <div className="flex justify-center items-center gap-6 mb-12">
              <span className={`text-xl font-bold transition-all duration-300 ${!isYearly ? 'text-orange-500 scale-110' : 'text-gray-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`${isYearly ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gray-300'} relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 shadow-lg`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-300 ${isYearly ? 'translate-x-9' : 'translate-x-1'}`} />
              </button>
              <span className={`text-xl font-bold transition-all duration-300 ${isYearly ? 'text-orange-500 scale-110' : 'text-gray-500'}`}>
                Yearly
              </span>
              {isYearly && (
                <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  Save up to 17%!
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {userPricingTiers.map((tier, index) => {
                const isSelected = selectedUserTier === tier.name;
                const savings = isYearly ? yearlyDiscount(tier.price.monthly, tier.price.yearly) : 0;

                return (
                  <motion.div
                    key={tier.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative group ${tier.popular ? 'lg:scale-105 z-10' : ''}`}
                  >
                    {tier.badge && (
                      <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 ${
                        tier.popular ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-purple-600'
                      } text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg z-20`}>
                        {tier.badge}
                      </div>
                    )}

                    <div className={`bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl border-2 transition-all duration-300 hover:shadow-2xl h-full ${
                      tier.popular ? 'border-orange-200 shadow-orange-100' : 'border-gray-200'
                    } ${isSelected ? 'ring-4 ring-orange-200' : ''}`}>

                      <div className="text-center mb-8">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${tier.color} flex items-center justify-center shadow-lg`}>
                          {tier.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                        <p className="text-gray-600 mb-4">{tier.description}</p>

                        <div className="mb-4">
                          <div className={`text-4xl font-bold mb-1 ${tier.popular ? 'bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent' : 'text-gray-900'}`}>
                            {isYearly ? tier.price.yearly : tier.price.monthly}
                          </div>
                          <div className="text-gray-500 text-sm">
                            {isYearly ? `${savings}% savings • Billed annually` : 'Billed monthly'}
                          </div>
                          {tier.price.daily && !isYearly && (
                            <div className="text-xs text-gray-400 mt-1">
                              or {tier.price.daily}/day • {tier.price.weekly}/week
                            </div>
                          )}
                        </div>

                        <div className="text-sm font-semibold text-blue-600 flex items-center justify-center gap-1">
                          <Coins className="w-4 h-4" />
                          {tier.vaultLimit} {tier.vaultLimit === 1 ? 'Vault' : 'Vaults'}
                        </div>
                      </div>

                      <div className="space-y-4 mb-8 flex-grow">
                        {tier.features.map((feature, i) => (
                          <FeatureItem key={i} feature={feature} />
                        ))}

                        {tier.limitations && (
                          <>
                            <div className="text-sm font-semibold text-gray-500 mb-3 mt-6">Not included:</div>
                            {tier.limitations.map((limitation, i) => (
                              <FeatureItem key={i} feature={limitation} included={false} />
                            ))}
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedUserTier(tier.name)}
                        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                          tier.popular 
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:shadow-xl' 
                            : tier.name === "Power"
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        }`}
                      >
                        {tier.cta}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Earn More Vaults Section */}
            <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                <Award className="w-6 h-6" />
                Earn Additional Vault Slots for Free!
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">Through Activity:</h4>
                  <ul className="space-y-2 text-blue-700">
                    <li>✓ Verify your identity (KYC) → +1 vault</li>
                    <li>✓ Maintain 30-day contribution streak → +1 vault</li>
                    <li>✓ Refer 5 active users → +1 vault</li>
                    <li>✓ Complete community challenges → +1 vault each</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">With MTAA Tokens:</h4>
                  <ul className="space-y-2 text-blue-700">
                    <li>💰 1,000 MTAA = 1 additional vault slot</li>
                    <li>💰 Earn MTAA through DAO participation</li>
                    <li>💰 Stake MTAA for monthly vault allowances</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* DAO Pricing Tab */}
          <TabsContent value="dao" className="mt-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {daoPricingTiers.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative group ${tier.popular ? 'lg:scale-105 z-10' : ''}`}
                >
                  {tier.badge && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg z-20">
                      {tier.badge}
                    </div>
                  )}

                  <div className={`bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl border-2 transition-all h-full ${
                    tier.popular ? 'border-blue-200' : 'border-gray-200'
                  }`}>
                    <div className="text-center mb-8">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${tier.color} flex items-center justify-center shadow-lg`}>
                        {tier.icon}
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                      <p className="text-gray-600 mb-4">{tier.description}</p>
                      <div className="text-4xl font-bold mb-1">{tier.price.monthly}</div>
                      <div className="text-gray-500 text-sm">Per DAO / Per Month</div>
                    </div>

                    <div className="space-y-4 mb-8">
                      {tier.features.map((feature, i) => (
                        <FeatureItem key={i} feature={feature} />
                      ))}
                      {tier.limitations?.map((limitation, i) => (
                        <FeatureItem key={i} feature={limitation} included={false} />
                      ))}
                    </div>

                    <button className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                      tier.popular ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}>
                      {tier.cta}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}