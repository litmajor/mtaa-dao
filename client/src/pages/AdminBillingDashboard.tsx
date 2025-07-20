import React, { useState } from "react";
import { CreditCard, Crown, Calendar, DollarSign, Mail, CheckCircle, Zap, Star, ArrowRight, Shield, TrendingUp } from "lucide-react";

export default function AdminBillingDashboard() {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  // TODO: Replace with real data and admin checks
  const currentPlan = "Free DAO";
  const billingHistory = [
    { date: "2025-07-01", amount: "KES 0", status: "Free Plan Activated" },
  ];

  const handleUpgrade = () => {
    setIsUpgrading(true);
    setTimeout(() => {
      setIsUpgrading(false);
      setShowUpgradeSuccess(true);
      setTimeout(() => setShowUpgradeSuccess(false), 3000);
    }, 2000);
  };

  // Plans from PricingPage
  const plans = [
    {
      name: "Free DAO",
      price: "KES 0",
      period: "forever",
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
      current: true,
      gradient: "from-slate-600 to-slate-800"
    },
    {
      name: "Premium DAO",
      price: "KES 1,500/mo or $9.99/mo",
      period: "month",
      features: [
        "Public & Private DAO (invite-only)",
        "Unlimited members",
        "Elder/Admin vetting",
        "Treasury analytics + disbursement alerts",
        "Vault dashboard + multiple vaults",
        "Reputation ranking, proposal history",
      ],
      unavailable: [],
      popular: true,
      gradient: "from-orange-500 via-pink-500 to-purple-600"
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/3 left-1/3 w-60 h-60 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
      </div>

      <div className="relative max-w-6xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Billing & Subscription
          </h1>
          <p className="text-xl text-gray-300">Manage your DAO's subscription and billing</p>
        </div>

        {/* Current Plan Card */}
        <div className="mb-12">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full -translate-y-16 translate-x-16"></div>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl mr-4 shadow-lg">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Current Plan</h2>
                  <p className="text-gray-300">Active subscription details</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {currentPlan}
                </div>
                <div className="text-gray-300">Plan</div>
              </div>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className={`w-full py-4 px-8 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg ${
                isUpgrading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : showUpgradeSuccess
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-xl hover:scale-105'
              } text-white`}
            >
              {isUpgrading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing Upgrade...</span>
                </>
              ) : showUpgradeSuccess ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Upgrade Successful!</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Upgrade to Premium</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">Choose Your Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border transition-all duration-300 hover:scale-105 ${
                  plan.current
                    ? 'border-emerald-500/50 ring-2 ring-emerald-500/30'
                    : plan.popular
                    ? 'border-purple-500/50 ring-2 ring-purple-500/30'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                      <Star className="w-4 h-4 mr-1" />
                      Most Popular
                    </div>
                  </div>
                )}
                
                {plan.current && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Current Plan
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 shadow-lg ${
                    plan.current
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                      : plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  }`}>
                    {plan.current ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : plan.popular ? (
                      <Crown className="w-6 h-6 text-white" />
                    ) : (
                      <Shield className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-white mb-1">{plan.price}</div>
                  <div className="text-gray-300">/{plan.period}</div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-gray-300">
                      <CheckCircle className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    plan.current
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40'
                  }`}
                >
                  {plan.current ? 'Current Plan' : 'Choose Plan'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 mb-8">
          <div className="flex items-center mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl mr-4 shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Billing History</h2>
              <p className="text-gray-300">Track your payment history and invoices</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/20">
            <div className="bg-white/5 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-4 p-4 font-semibold text-white">
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-400" />
                  Date
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-emerald-400" />
                  Amount
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-purple-400" />
                  Status
                </div>
              </div>
            </div>
            <div className="divide-y divide-white/10">
              {billingHistory.map((row, i) => (
                <div key={i} className="grid grid-cols-3 gap-4 p-4 text-gray-300 hover:bg-white/5 transition-colors">
                  <div>{row.date}</div>
                  <div className="font-semibold">{row.amount}</div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></div>
                    {row.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Support Contact */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl mr-3 shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Need Help?</h3>
              <p className="text-gray-300 text-sm">Our support team is here to assist you</p>
            </div>
          </div>
          <div className="text-gray-300">
            For billing support, contact{' '}
            <a href="mailto:admin@mtaadao.com" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              admin@mtaadao.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}