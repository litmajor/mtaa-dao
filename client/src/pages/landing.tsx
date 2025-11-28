import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, Vote, Wallet, Target, TrendingUp, Shield, Globe, CheckCircle, Sparkles, Heart, Star, Award, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { apiGet } from '@/lib/api';
import { Logo } from "@/components/ui/logo";
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import PublicImpactFeed from '@/components/PublicImpactFeed';
import DaoOfTheWeekBanner from '@/components/DaoOfTheWeekBanner';

export default function MtaaDAOLanding() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [platformStats, setPlatformStats] = useState({
    members: '2K+',
    daos: '150',
    tvl: '$100K+',
    satisfaction: '85%+'
  });

  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const coreFeatures = [
    {
      icon: Wallet,
      title: "Personal Wallet",
      description: "Send & receive money instantly. Support for CELO, cUSD, cEUR & more.",
      gradient: "from-blue-400 to-cyan-500",
      path: "/wallet"
    },
    {
      icon: TrendingUp,
      title: "Smart Vaults/Group investments",
      description: "Professional DeFi management. Earn 8-15% APY on your savings.",
      gradient: "from-green-400 to-emerald-500",
      path: "/vault"
    },
    {
      icon: Users,
      title: "Community DAOs",
      description: "Pool resources, vote on decisions, transparent treasury management.",
      gradient: "from-purple-400 to-pink-500",
      path: "/daos"
    },
    {
      icon: Target,
      title: "Goal-Based Savings",
      description: "Set targets, lock funds, earn bonus interest. Build your future.",
      gradient: "from-amber-400 to-orange-500",
      path: "/wallet#locked-savings"
    },
    {
      icon: Vote,
      title: "Governance & Voting",
      description: "Every decision is transparent. Your voice, your vote, your power.",
      gradient: "from-indigo-400 to-blue-500",
      path: "/proposals"
    },
    {
      icon: Shield,
      title: "Multi-Signature Security",
      description: "Enterprise-grade security for group funds. Multiple approvals required.",
      gradient: "from-red-400 to-pink-500",
      path: "/dao/treasury"
    }
  ];

  const walletFeatures = [
    {
      icon: Shield,
      title: "Peer-to-Peer Escrow",
      description: "Send money safely with milestone protection. Create shareable invite links.",
      features: [
        "Custom milestones for deliverables",
        "Shareable invite links (no signup needed)",
        "Auto-signup for recipients",
        "Dispute resolution & refunds"
      ],
      gradient: "from-emerald-400 to-teal-500",
      path: "/wallet"
    },
    {
      icon: TrendingUp,
      title: "Smart Bill Splitting",
      description: "Split costs instantly. Track who owes whom with zero friction.",
      features: [
        "Split any bill equally or custom amounts",
        "Request payments from friends",
        "Automatic settlement tracking",
        "Monthly statements & history"
      ],
      gradient: "from-violet-400 to-indigo-500",
      path: "/wallet"
    },
    {
      icon: Heart,
      title: "Group Money Management",
      description: "Pool money with friends for gifts, events, or joint purchases.",
      features: [
        "Create group savings pots",
        "Transparent balance tracking",
        "One-tap contributions",
        "Fair distribution rules"
      ],
      gradient: "from-pink-400 to-rose-500",
      path: "/wallet"
    }
  ];

  const youthImpact = [
    {
      icon: Users,
      title: "Start With Nothing",
      description: "No bank account needed. Start with just KES 100.",
      stat: "60M+ unbanked youth can join",
      gradient: "from-purple-400 to-pink-500"
    },
    {
      icon: Target,
      title: "Build Your Future",
      description: "Save for school fees, start a business, or invest together.",
      stat: "70% of users are under 30",
      gradient: "from-emerald-400 to-teal-500"
    },
    {
      icon: Heart,
      title: "Learn & Earn",
      description: "Get paid to participate. Build your financial reputation.",
      stat: "Average KES 5,000/month extra income",
      gradient: "from-orange-400 to-red-500"
    }
  ];

  const stats = [
    { number: platformStats.members, label: "People Saving", icon: Users },
    { number: platformStats.daos, label: "Active Groups", icon: Vote },
    { number: platformStats.tvl, label: "Money Growing", icon: DollarSign },
    { number: platformStats.satisfaction, label: "Would Recommend", icon: TrendingUp }
  ];

  const testimonials = [
    {
      name: "Jane Mwangi",
      location: "Kibera, Nairobi",
      quote: "My shop processes KES 45,000/month through Mtaa. No more cash theft.",
      impact: "+180% revenue",
      avatar: "JM"
    },
    {
      name: "Peter Ochieng",
      location: "Eastlands",
      quote: "Instant payments from customers. I earn 8% more with Mtaa tokens.",
      impact: "+52 customers",
      avatar: "PO"
    },
    {
      name: "Amina Karanja",
      location: "Kawangware",
      quote: "Our chama saved KES 2.3M transparently. Zero disputes.",
      impact: "847 members",
      avatar: "AK"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden relative flex flex-col">
      {/* Optimized Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
          style={{
            top: '10%',
            left: '10%',
            transform: `translate3d(${scrollY * 0.05}px, ${scrollY * 0.03}px, 0)`
          }}
        />
        <div 
          className="absolute w-80 h-80 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
          style={{
            top: '60%',
            right: '10%',
            transform: `translate3d(${-scrollY * 0.05}px, ${-scrollY * 0.03}px, 0)`
          }}
        />
      </div>

      {/* Compact Header */}
      <header className="w-full py-4 px-6 flex items-center justify-between bg-gradient-to-r from-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-white/10 z-40 sticky top-0">
        <div className="flex items-center space-x-3">
          <Logo variant="icon" size="sm" forceTheme="dark" />
          <span className="font-black text-xl text-white">Mtaa DAO</span>
        </div>
        <nav className="hidden md:flex space-x-6">
          <a href="#features" className="text-purple-200 hover:text-white transition">Features</a>
          <a href="/success-stories" className="text-purple-200 hover:text-white transition">Success Stories</a>
          <a href="/pricing" className="text-purple-200 hover:text-white transition">Pricing</a>
          <a href="/whitepaper.html" target="_blank" className="text-purple-200 hover:text-white transition">Whitepaper</a>
        </nav>
        <a href="/register">
          <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg">
            Get Started
          </Button>
        </a>
      </header>

      {/* Hero Section - Streamlined */}
      <div className="relative flex-1" id="hero">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          {/* DAO of the Week Banner */}
          <DaoOfTheWeekBanner />

          <div className={`text-center transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} mt-8`}>
            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="block text-white">Your Complete </span>
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                Financial Operating System
              </span>
            </h1>

            <p className="text-xl md:text-3xl text-purple-100 max-w-3xl mx-auto mb-4 leading-relaxed font-semibold">
              Wallet • Savings • Investments • Community Governance
            </p>
            
            <p className="text-lg md:text-xl text-purple-200 max-w-2xl mx-auto mb-10 leading-relaxed">
              From daily transactions to earning 8-12% yields on savings,<br/>
              to pooling resources with your community - all in one platform.
            </p>

            {/* Quick Stats */}
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-white">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>2,000+ people saving together</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>KES 30M saved so far</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span>85% would recommend</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <a href="/register" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white px-12 py-7 text-xl font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all min-h-[56px]"
                >
                  Start Saving (Free)
                  <ArrowRight className="ml-2 h-6 w-6" />
                </Button>
              </a>
              <a href="#how-it-works" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 px-12 py-7 text-xl font-bold rounded-2xl backdrop-blur-sm transition-all min-h-[56px]"
                >
                  How It Works
                </Button>
              </a>
            </div>

            {/* Stats - Compact Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:border-white/40 transition-all">
                    <Icon className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
                    <div className="text-3xl font-black text-white">{stat.number}</div>
                    <div className="text-purple-200 text-sm">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Impact Stats Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <PublicImpactFeed />
        </div>
      </section>

      {/* Platform Capabilities */}
      <div className="py-16 relative" id="features">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Everything You Need in One Platform
            </h2>
            <p className="text-xl text-purple-200">
              From everyday transactions to professional wealth management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {coreFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <a key={index} href={feature.path}>
                  <Card className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300 h-full cursor-pointer">
                    <CardContent className="p-6">
                      <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-4 shadow-xl group-hover:scale-110 transition-transform`}>
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-purple-200 text-sm">{feature.description}</p>
                      <div className="mt-4 flex items-center text-sm text-orange-400 group-hover:text-orange-300">
                        Learn more <ArrowRight className="ml-1 w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>

          {/* Financial Journey */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Your Complete Financial Journey</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-4xl mb-2">💰</div>
                <div className="text-white font-bold mb-1">1. Start</div>
                <div className="text-purple-200 text-sm">Get your wallet. Send/receive instantly.</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">📈</div>
                <div className="text-white font-bold mb-1">2. Grow</div>
                <div className="text-purple-200 text-sm">Move savings to vaults. Earn 8-15% APY.</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🤝</div>
                <div className="text-white font-bold mb-1">3. Collaborate</div>
                <div className="text-purple-200 text-sm">Join or create DAO. Pool resources.</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🎯</div>
                <div className="text-white font-bold mb-1">4. Achieve</div>
                <div className="text-purple-200 text-sm">Reach goals together. Build wealth.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet & Vault Power */}
      <div className="py-16 bg-gradient-to-r from-slate-900/50 to-blue-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Powerful Tools, Simple Experience
            </h2>
            <p className="text-xl text-purple-200">
              Professional-grade features that anyone can use
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Personal Wallet */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Personal Wallet</h3>
                </div>
                <p className="text-purple-200 mb-4">Your daily financial hub</p>
                <ul className="space-y-2 text-white text-sm mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Send to phone numbers (no crypto knowledge needed)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Multiple currencies: CELO, cUSD, cEUR, cREAL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Instant transactions (~$0.001 fee)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Bill splitting & payment requests</span>
                  </li>
                </ul>
                <a href="/wallet">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Explore Wallet <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* Smart Vaults */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Smart Vaults</h3>
                </div>
                <p className="text-purple-200 mb-4">Professional yield management</p>
                <ul className="space-y-2 text-white text-sm mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Automated DeFi strategies (8-15% APY)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Goal-based savings accounts with time locks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Real-time performance tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Risk-adjusted strategies (conservative to aggressive)</span>
                  </li>
                </ul>
                <a href="/vault">
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Explore Vaults <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Wallet Advanced Features */}
          <div className="mt-12 mb-8">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-black text-white mb-2">Beyond Simple Transfers</h3>
              <p className="text-lg text-purple-200">Advanced wallet features for everyday needs</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {walletFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">{feature.title}</h4>
                      <p className="text-purple-200 text-sm mb-4">{feature.description}</p>
                      <ul className="space-y-2 mb-6">
                        {feature.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2 text-white text-xs">
                            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                      <a href={feature.path} className="text-orange-400 hover:text-orange-300 text-sm font-semibold flex items-center gap-1">
                        Try It Now <ArrowRight className="w-3 h-3" />
                      </a>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Quick Comparison */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h4 className="text-lg font-bold text-white mb-4 text-center">Choose What Fits Your Needs</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-blue-400 font-bold mb-1">Daily Spending</div>
                <div className="text-purple-200 text-sm">Use your Personal Wallet</div>
              </div>
              <div>
                <div className="text-green-400 font-bold mb-1">Growing Savings</div>
                <div className="text-purple-200 text-sm">Move to Smart Vaults</div>
              </div>
              <div>
                <div className="text-purple-400 font-bold mb-1">Community Funds</div>
                <div className="text-purple-200 text-sm">Create a DAO Treasury</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Youth Impact Section */}
      <div className="py-16 bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm" id="youth-impact">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Built For Young People
            </h2>
            <p className="text-xl text-purple-200">
              No bank account? No problem. Start building your financial future today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {youthImpact.map((impact, index) => {
              const Icon = impact.icon;
              return (
                <Card key={index} className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300">
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 bg-gradient-to-br ${impact.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl group-hover:scale-110 transition-transform`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{impact.title}</h3>
                    <p className="text-purple-200 text-sm mb-3">{impact.description}</p>
                    <div className="text-emerald-400 font-bold text-sm">{impact.stat}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Youth Success Stories */}
          <div className="mt-12 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Young People Making It Happen</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-2">🎓</div>
                <div className="text-white font-bold mb-1">Sarah, 22</div>
                <div className="text-purple-200 text-sm">Saved KES 180K for university in 8 months with friends</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">💼</div>
                <div className="text-white font-bold mb-1">Kevin, 19</div>
                <div className="text-purple-200 text-sm">Started phone repair business with group savings</div>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-2">🏠</div>
                <div className="text-white font-bold mb-1">Grace, 25</div>
                <div className="text-purple-200 text-sm">Pooled rent deposit with 4 friends, moved to better place</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof - Real Impact */}
      <div className="py-16 bg-gradient-to-r from-purple-900/50 to-blue-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-white mb-4">Real People, Real Impact</h2>
            <p className="text-xl text-purple-200">See how communities are transforming their futures</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{testimonial.name}</div>
                    <div className="text-purple-200 text-sm">{testimonial.location}</div>
                  </div>
                </div>
                <p className="text-purple-100 mb-3 italic">"{testimonial.quote}"</p>
                <div className="text-green-400 font-bold text-sm">{testimonial.impact}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA - Bold & Simple */}
      <div className="py-24 bg-gradient-to-br from-orange-500 via-pink-600 to-purple-700 relative">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
            Ready to Start Saving Together?
          </h2>
          <p className="text-xl text-white/90 mb-4 leading-relaxed">
            Free to start. No hidden fees.
          </p>
          <p className="text-lg text-white/80 mb-10">
            Join 500+ groups already growing their money
          </p>
          <a href="/register">
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 px-12 py-6 text-2xl font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all"
            >
              Create Your Group Now
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </a>
        </div>
      </div>

      {/* Minimalist Footer */}
      <footer className="w-full py-8 px-6 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-t border-white/10 text-center text-purple-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo variant="icon" size="sm" forceTheme="dark" />
              <span className="font-bold">© 2025 Mtaa DAO</span>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="/success-stories" className="hover:text-white transition">Success Stories</a>
              <a href="/pricing" className="hover:text-white transition">Pricing</a>
              <a href="/whitepaper.html" target="_blank" className="hover:text-white transition">Whitepaper</a>
              <a href="/help" className="hover:text-white transition">Support</a>
              <a href="https://t.me/mtaadao" target="_blank" rel="noopener" className="hover:text-white transition">Telegram</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}