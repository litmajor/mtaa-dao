import React, { useState } from "react";
import { Check, X, Star, Zap, Shield, Users, TrendingUp, ArrowRight, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const PRICING_TIERS = [
  {
    name: "Community",
    subtitle: "Free Forever",
    priceMonthly: 0,
    priceYearly: 0,
    transactionFee: "2.0%",
    description: "Perfect for small groups testing DAO governance",
    features: [
      "Up to 15 members",
      "KES 30,000 treasury cap",
      "15 transactions/month",
      "5 proposals/month",
      "3 AI queries/day",
      "Monthly analytics",
      "Email support",
      "Single currency (KES)"
    ],
    notIncluded: [
      "Personal vaults",
      "Export/reporting",
      "API access",
      "Custom branding",
      "Multi-signature treasury"
    ],
    cta: "Start Free",
    color: "from-slate-600 to-slate-800",
    icon: <Users className="w-8 h-8 text-white" />
  },
  {
    name: "Growth",
    subtitle: "For Growing Communities",
    priceMonthly: 300,
    priceYearly: 3000,
    savings: 600,
    transactionFee: "1.5%",
    description: "Unlock unlimited potential with advanced features",
    popular: true,
    features: [
      "Up to 50 members (base)",
      "KES 5 per extra member (51-100)",
      "Unlimited treasury",
      "Unlimited transactions & proposals",
      "3 personal vaults per user",
      "25 AI queries/day",
      "Daily analytics",
      "Multi-signature support",
      "Export reports (PDF/CSV)",
      "Priority email support",
      "API access (10K requests/month)",
      "Remove MtaaDAO branding",
      "Multi-currency support"
    ],
    notIncluded: [],
    cta: "Start Growing",
    color: "from-orange-500 via-pink-500 to-purple-600",
    icon: <TrendingUp className="w-8 h-8 text-white" />
  },
  {
    name: "Professional",
    subtitle: "For Established DAOs",
    priceMonthly: 1200,
    priceYearly: 12000,
    savings: 2400,
    transactionFee: "1.0%",
    description: "Full-featured platform for serious communities",
    features: [
      "Up to 250 members (base)",
      "KES 3 per extra member (251-1,000)",
      "Everything in Growth, plus:",
      "10 personal vaults per user",
      "Unlimited AI queries",
      "Real-time analytics",
      "Advanced AI analytics",
      "Morio AI-powered assistance",
      "Auto-rebalancing vaults",
      "White-label options",
      "API access (100K requests/month)",
      "Priority chat support",
      "Dedicated account manager",
      "Custom integrations",
      "99.5% SLA uptime"
    ],
    notIncluded: [],
    cta: "Go Professional",
    color: "from-purple-600 to-indigo-600",
    icon: <Crown className="w-8 h-8 text-white" />
  },
  {
    name: "Enterprise",
    subtitle: "Custom Solutions",
    priceMonthly: "Custom",
    priceYearly: "Custom",
    transactionFee: "0.5-0.75%",
    description: "Tailored for large networks and MetaDAOs",
    features: [
      "Unlimited everything",
      "MetaDAO network support",
      "Cross-DAO coordination",
      "Custom smart contracts",
      "White-label platform",
      "On-site training",
      "Dedicated support team",
      "Unlimited API access",
      "99.9% SLA uptime",
      "Custom integrations",
      "Compliance support",
      "12-month minimum contract"
    ],
    notIncluded: [],
    cta: "Contact Sales",
    color: "from-blue-600 to-cyan-600",
    icon: <Shield className="w-8 h-8 text-white" />
  }
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const navigate = useNavigate();

  const handleSelectPlan = (tierName: string) => {
    if (tierName === "Community") {
      navigate("/create-dao");
    } else if (tierName === "Enterprise") {
      window.location.href = "mailto:enterprise@mtaadao.com";
    } else {
      navigate("/subscription");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-purple-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-6">
              Pay only for what you need. No hidden fees, no surprises.
            </p>
            <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-6 py-3 mb-8">
              <p className="text-sm text-blue-800">
                <strong>New Pricing:</strong> Aligned with Kenya's fee reduction initiative. All fees reduced by up to 50%.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center items-center gap-6 mb-12">
          <span className={`text-xl font-bold transition-all ${!isYearly ? 'text-orange-500 scale-110' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`${isYearly ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gray-300'} relative inline-flex h-8 w-16 items-center rounded-full transition-all shadow-lg`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all ${isYearly ? 'translate-x-9' : 'translate-x-1'}`} />
          </button>
          <span className={`text-xl font-bold transition-all ${isYearly ? 'text-orange-500 scale-110' : 'text-gray-500'}`}>
            Yearly
          </span>
          {isYearly && (
            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              Save 16%!
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
          {PRICING_TIERS.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative ${tier.popular ? 'lg:scale-105' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg z-10">
                  <Star className="w-4 h-4 inline mr-1" />
                  Most Popular
                </div>
              )}

              <div className={`bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl border-2 transition-all h-full ${
                tier.popular ? 'border-orange-200' : 'border-gray-200'
              }`}>

                <div className="text-center mb-6">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${tier.color} flex items-center justify-center shadow-lg`}>
                    {tier.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{tier.subtitle}</p>

                  <div className="mb-4">
                    {typeof tier.priceMonthly === 'number' ? (
                      <>
                        <div className="text-4xl font-bold text-gray-900">
                          KES {isYearly ? tier.priceYearly.toLocaleString() : tier.priceMonthly.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {isYearly ? `/year (save KES ${tier.savings?.toLocaleString()})` : '/month'}
                        </div>
                      </>
                    ) : (
                      <div className="text-4xl font-bold text-gray-900">{tier.priceMonthly}</div>
                    )}
                  </div>

                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm">
                    <span className="font-semibold text-blue-800">{tier.transactionFee}</span>
                    <span className="text-blue-600"> platform fee</span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-6 text-center">{tier.description}</p>

                <div className="space-y-3 mb-8 min-h-[300px]">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}

                  {tier.notIncluded.length > 0 && (
                    <>
                      <div className="border-t pt-3 mt-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Not included:</p>
                      </div>
                      {tier.notIncluded.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-400 line-through">{feature}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleSelectPlan(tier.name)}
                  className={`w-full py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 ${
                    tier.popular 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {tier.cta}
                  <ArrowRight className="w-5 h-5 inline ml-2" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-3xl p-8 shadow-xl mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-lg mb-2">What's included in the platform fee?</h3>
              <p className="text-gray-600">Transaction processing, on/off-ramp (M-Pesa, bank), cross-chain swaps, and gas fees. One simple fee.</p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-gray-600">Yes! Change tiers anytime. Upgrades are immediate, downgrades take effect next billing cycle.</p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">What happens to extra members?</h3>
              <p className="text-gray-600">Growth tier: KES 5/member/month for members 51-100. Professional: KES 3/member/month for members 251-1,000.</p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Do you offer discounts?</h3>
              <p className="text-gray-600">Yes! 16% discount on annual plans, first 100 customers get 50% off for 6 months, and referral rewards available.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">Questions? Contact us at <a href="mailto:pricing@mtaadao.com" className="text-orange-500 font-semibold">pricing@mtaadao.com</a></p>
        </div>

      </div>
    </div>
  );
}