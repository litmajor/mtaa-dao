import React, { useState, useEffect } from "react";
import { Check, Star, Zap, Shield, Users, DollarSign, TrendingUp, ArrowRight, Sparkles, Crown, Award, Target, Eye, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

type PricingTier = {
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

type PlatformFee = {
  action: string;
  fee: string;
  notes: string;
  category: 'vault' | 'payments' | 'governance' | 'yield';
};

const pricingTiers: PricingTier[] = [
  {
    name: "Free DAO",
    price: { monthly: "KES 0", yearly: "KES 0" },
    description: "Perfect for starting your community journey",
    features: [
      "Public DAO creation",
      "Up to 25 members",
      "Basic proposal system",
      "Simple voting mechanism",
      "Community dashboard",
      "Basic wallet integration",
      "Email support"
    ],
    limitations: [
      "No private DAO (invite-only)",
      "No advanced governance features",
      "Limited treasury analytics",
      "No multiple vaults",
      "No reputation system",
      "No advanced integrations"
    ],
    cta: "Start Free",
    color: "from-slate-600 to-slate-800",
    icon: <Users className="w-8 h-8 text-white" />
  },
  {
    name: "Premium DAO",
    price: { monthly: "KES 1,500", yearly: "KES 15,000" },
    description: "Full-featured platform for serious communities",
    features: [
      "Everything in Free",
      "Private & Public DAOs",
      "Unlimited members",
      "Advanced governance system",
      "Elder/Admin role management",
      "Comprehensive treasury analytics",
      "Multiple vault management",
      "Reputation & ranking system",
      "Proposal templates & automation",
      "Advanced integrations (DeFi, MiniPay)",
      "Bulk payment processing",
      "Custom DAO branding",
      "Priority support",
      "API access"
    ],
    cta: "Upgrade to Premium",
    popular: true,
    color: "from-orange-500 via-red-500 to-purple-600",
    icon: <Crown className="w-8 h-8 text-white" />,
    badge: "Most Popular"
  },
  {
    name: "Enterprise",
    price: { monthly: "Custom", yearly: "Custom" },
    description: "Tailored solutions for large organizations",
    features: [
      "Everything in Premium",
      "Custom feature development",
      "Dedicated account manager",
      "SLA guarantees",
      "Advanced security features",
      "Custom integrations",
      "White-label solutions",
      "On-premise deployment options",
      "Training & onboarding",
      "24/7 phone support"
    ],
    cta: "Contact Sales",
    color: "from-purple-600 to-indigo-600",
    icon: <Shield className="w-8 h-8 text-white" />,
    badge: "Enterprise"
  }
];

const platformFees: PlatformFee[] = [
  {
    action: "Vault Deposits",
    fee: "Free",
    notes: "No fees for contributing to community vaults",
    category: 'vault'
  },
  {
    action: "Vault Withdrawals",
    fee: "1-2%",
    notes: "Deducted from withdrawal amount",
    category: 'vault'
  },
  {
    action: "Vault Disbursements",
    fee: "1-2%",
    notes: "Deducted from vault at disbursement time",
    category: 'vault'
  },
  {
    action: "Yield Generation",
    fee: "10-15%",
    notes: "Platform takes percentage of yield earned",
    category: 'yield'
  },
  {
    action: "Bulk Payments",
    fee: "Flat rate",
    notes: "Based on number of recipients",
    category: 'payments'
  },
  {
    action: "MiniPay Transactions",
    fee: "Network fees",
    notes: "Standard Celo network transaction costs",
    category: 'payments'
  },
  {
    action: "Governance Actions",
    fee: "Free",
    notes: "Voting and proposals are always free",
    category: 'governance'
  }
];

const featureCategories = [
  {
    title: "Core Features",
    icon: <Target className="w-6 h-6" />,
    features: [
      "Community creation and management",
      "Democratic governance and voting",
      "Transparent treasury management",
      "Member onboarding and verification"
    ]
  },
  {
    title: "Financial Tools", 
    icon: <DollarSign className="w-6 h-6" />,
    features: [
      "Multi-currency wallet support",
      "DeFi yield generation",
      "Automated savings mechanisms",
      "Bulk payment processing"
    ]
  },
  {
    title: "Analytics & Insights",
    icon: <TrendingUp className="w-6 h-6" />,
    features: [
      "Real-time performance tracking",
      "Member engagement metrics", 
      "Financial growth analysis",
      "Impact measurement tools"
    ]
  },
  {
    title: "Security & Trust",
    icon: <Shield className="w-6 h-6" />,
    features: [
      "Blockchain-based transparency",
      "Multi-signature security",
      "Audit trail for all actions",
      "Reputation-based trust system"
    ]
  }
];

const tokenEcosystem = [
  {
    title: "MTAA Tokens",
    icon: "🪙",
    description: "Governance tokens for voting rights and platform decisions",
    utility: "Vote on proposals, earn staking rewards, access premium features"
  },
  {
    title: "Reputation Points",
    icon: "⭐",
    description: "Non-transferable points earned through community participation",
    utility: "Unlock features, increase influence, build trust within community"
  },
  {
    title: "Achievement Badges", 
    icon: "🏆",
    description: "Visual recognition for community contributions and milestones",
    utility: "Status recognition, access to exclusive opportunities, community respect"
  }
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("Premium DAO");
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
      {/* Animated background elements */}
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
              Transparent, Community-First Pricing
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Build stronger communities with pricing designed for grassroots organizations. 
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent font-semibold"> Pay for what you need, when you need it.</span>
            </p>
          </motion.div>

          {/* Key Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[
              { number: "2,300+", label: "Active Communities" },
              { number: "45,000+", label: "Members Served" },
              { number: "KES 14M+", label: "Funds Managed" },
              { number: "98%", label: "Success Rate" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg"
              >
                <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent mb-1">
                  {stat.number}
                </div>
                <div className="text-gray-600 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center items-center gap-6 mb-12">
          <span className={`text-xl font-bold transition-all duration-300 ${!isYearly ? 'text-orange-500 scale-110' : 'text-gray-500'}`}>
            Monthly
          </span>
          <div className="relative">
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`${isYearly ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gray-300'} relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 shadow-lg`}
              title="Toggle billing period"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-300 ${isYearly ? 'translate-x-9' : 'translate-x-1'}`}
              />
            </button>
            {isYearly && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                Save up to 17%!
              </div>
            )}
          </div>
          <span className={`text-xl font-bold transition-all duration-300 ${isYearly ? 'text-orange-500 scale-110' : 'text-gray-500'}`}>
            Yearly
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {pricingTiers.map((tier, index) => {
            const isSelected = selectedTier === tier.name;
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
                  
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${tier.color} flex items-center justify-center shadow-lg`}>
                      {tier.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                    <p className="text-gray-600 mb-4">{tier.description}</p>
                    
                    {/* Price */}
                    <div className="mb-4">
                      <div className={`text-4xl font-bold mb-1 ${tier.popular ? 'bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent' : 'text-gray-900'}`}>
                        {isYearly ? tier.price.yearly : tier.price.monthly}
                      </div>
                      {tier.price.monthly !== "Custom" && (
                        <div className="text-gray-500 text-sm">
                          {isYearly ? (
                            <span>
                              {savings > 0 && <span className="text-green-600 font-semibold">Save {savings}%</span>}
                              {savings > 0 && " • "}Billed annually
                            </span>
                          ) : (
                            "Billed monthly"
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-4 mb-8 flex-grow">
                    <div className="text-sm font-semibold text-gray-900 mb-3">What's included:</div>
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

                  {/* CTA Button */}
                  <button
                    onClick={() => setSelectedTier(tier.name)}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                      tier.popular 
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:shadow-xl' 
                        : tier.name === "Enterprise"
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {tier.cta}
                    {tier.name === "Premium DAO" && <ArrowRight className="inline-block w-5 h-5 ml-2" />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Categories */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive tools for transparent community management and financial growth
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {featureCategories.map((category, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white mr-4">
                    {category.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{category.title}</h3>
                </div>
                <div className="space-y-3">
                  {category.features.map((feature, i) => (
                    <div key={i} className="flex items-center text-gray-600">
                      <Star className="w-4 h-4 text-orange-400 mr-3 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Platform Fees */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Transparent Platform Fees
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We believe in complete transparency. Here are all the fees you might encounter.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-4 px-6 text-left text-lg font-semibold text-gray-900">Action</th>
                    <th className="py-4 px-6 text-left text-lg font-semibold text-gray-900">Fee</th>
                    <th className="py-4 px-6 text-left text-lg font-semibold text-gray-900">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {platformFees.map((fee, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${
                            fee.category === 'vault' ? 'bg-blue-500' :
                            fee.category === 'payments' ? 'bg-green-500' :
                            fee.category === 'governance' ? 'bg-purple-500' :
                            'bg-orange-500'
                          }`}></div>
                          <span className="font-medium text-gray-900">{fee.action}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`font-bold ${fee.fee === 'Free' ? 'text-green-600' : 'text-orange-600'}`}>
                          {fee.fee}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{fee.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Fee Categories Legend */}
            <div className="mt-6 flex flex-wrap gap-4">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm text-gray-600">Vault Operations</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm text-gray-600">Payment Processing</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                <span className="text-sm text-gray-600">Governance</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                <span className="text-sm text-gray-600">Yield Generation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Token Ecosystem */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Token & Reputation Ecosystem
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Build trust, earn rewards, and unlock new opportunities through our comprehensive token system
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tokenEcosystem.map((token, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 text-center"
              >
                <div className="text-4xl mb-4">{token.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{token.title}</h3>
                <p className="text-gray-600 mb-4">{token.description}</p>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-2">Key Benefits:</div>
                  <p className="text-sm text-gray-600">{token.utility}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Important Notice */}
        <div className="mb-16">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-8">
            <div className="flex items-start space-x-4">
              <AlertCircle className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-2">Important: Community-First Approach</h3>
                <p className="text-blue-800 mb-4">
                  All platform fees are paid by the DAO/community collectively, not by individual members. 
                  This ensures that the cost of transparency and security is shared fairly across the community.
                </p>
                <ul className="text-blue-700 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <span>Individual members never pay hidden fees</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <span>All costs are transparent and voted on by the community</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <span>Fees are only charged when value is created</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                question: "Can I switch plans anytime?",
                answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing adjustments."
              },
              {
                question: "What happens if I exceed my member limit?",
                answer: "Free DAOs are limited to 25 members. Once you reach this limit, you'll need to upgrade to Premium to add more members."
              },
              {
                question: "Are there any setup fees?",
                answer: "No setup fees ever. You only pay the subscription fee, and all platform fees are clearly disclosed upfront."
              },
              {
                question: "Can I cancel anytime?",
                answer: "Absolutely. Cancel your subscription anytime with no penalties. Your data remains accessible for 30 days after cancellation."
              },
              {
                question: "Do you offer refunds?",
                answer: "We offer a 30-day money-back guarantee for annual plans. Monthly plans can be canceled anytime without charges for the next month."
              },
              {
                question: "Is my community data secure?",
                answer: "Yes! All data is encrypted, backed up regularly, and stored securely. We're also building on blockchain for maximum transparency."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
                <h3 className="font-bold text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-white/90 backdrop-blur-xl rounded-3xl p-12 shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-6">
            Ready to Transform Your Community?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Join thousands of communities already building stronger financial futures through transparent, 
            democratic, and inclusive financial solutions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-12 py-4 rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              Start Your Free DAO Today
            </button>
            <button className="bg-white text-orange-600 px-12 py-4 rounded-2xl font-bold text-xl border-2 border-orange-500 hover:bg-orange-50 transition-all duration-300">
              Schedule a Demo
            </button>
          </div>
          <p className="text-gray-500 mt-6">No credit card required • Free forever • Upgrade anytime</p>
        </div>
      </div>
    </div>
  );
}
