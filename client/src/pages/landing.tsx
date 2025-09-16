import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, Vote, Wallet, Target, Trophy, Zap, DollarSign, ClipboardList, Star, TrendingUp, Shield, Globe, CheckCircle, Sparkles, Heart, Coins, Award, Lock, BookOpen, Code, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from 'wouter';

export default function MtaaDAOLanding() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setIsVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);

    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 8);
    }, 3000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  const features = [
    {
      icon: Vote,
      title: "Democratic Governance",
      description: "Transparent, weighted voting on proposals with real-time consensus tracking",
      color: "emerald",
      gradient: "from-emerald-400 via-teal-500 to-cyan-600",
      bgGradient: "from-emerald-50 to-teal-50"
    },
    {
      icon: Wallet,
      title: "Smart Vaults",
      description: "AI-powered personal & community treasury management with predictive analytics",
      color: "amber",
      gradient: "from-amber-400 via-orange-500 to-red-600",
      bgGradient: "from-amber-50 to-orange-50"
    },
    {
      icon: Users,
      title: "Community Network",
      description: "Build meaningful connections and grow your influence within the ecosystem",
      color: "purple",
      gradient: "from-purple-400 via-violet-500 to-indigo-600",
      bgGradient: "from-purple-50 to-indigo-50"
    },
    {
      icon: Target,
      title: "Collective Impact",
      description: "Coordinate resources and achieve ambitious community goals together",
      color: "rose",
      gradient: "from-rose-400 via-pink-500 to-fuchsia-600",
      bgGradient: "from-rose-50 to-pink-50"
    },
    {
      icon: DollarSign,
      title: "Treasury Analytics",
      description: "Advanced financial insights with ML-powered growth predictions",
      color: "blue",
      gradient: "from-blue-400 via-cyan-500 to-teal-600",
      bgGradient: "from-blue-50 to-cyan-50"
    },
    {
      icon: Trophy,
      title: "Achievement System",
      description: "Dynamic leaderboards and recognition for community contributors",
      color: "yellow",
      gradient: "from-yellow-400 via-amber-500 to-orange-600",
      bgGradient: "from-yellow-50 to-amber-50"
    },
    {
      icon: Zap,
      title: "Gamified Growth",
      description: "Streak tracking, NFT badges, and rewards that fuel engagement",
      color: "green",
      gradient: "from-green-400 via-emerald-500 to-teal-600",
      bgGradient: "from-green-50 to-emerald-50"
    },
    {
      icon: ClipboardList,
      title: "Task Marketplace",
      description: "Decentralized bounty system connecting skills with community needs",
      color: "violet",
      gradient: "from-violet-400 via-purple-500 to-indigo-600",
      bgGradient: "from-violet-50 to-purple-50"
    }
  ];

  const stats = [
    { number: "5K+", label: "Active Members", icon: Users, color: "from-blue-500 to-cyan-500" },
    { number: "1.2K+", label: "Live Proposals", icon: Vote, color: "from-emerald-500 to-teal-500" },
    { number: "$100K+", label: "Treasury Value", icon: DollarSign, color: "from-amber-500 to-orange-500" },
    { number: "3.9K+", label: "Tasks Completed", icon: CheckCircle, color: "from-purple-500 to-pink-500" }
  ];

  const benefits = [
    { text: "Real-time governance participation", icon: Vote },
    { text: "Transparent treasury management", icon: Shield },
    { text: "Community reputation system", icon: Award },
    { text: "Gamified contribution tracking", icon: Zap },
    { text: "Decentralized task marketplace", icon: ClipboardList },
    { text: "Automated reward distribution", icon: Coins }
  ];

  const trustFeatures = [
    {
      icon: Shield,
      title: "Military-Grade Security",
      description: "Multi-signature wallets, smart contract audits, and zero-knowledge proofs protect your assets",
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      icon: TrendingUp,
      title: "Exponential Growth",
      description: "Communities see 300% average growth in treasury value within their first year",
      gradient: "from-purple-500 to-indigo-600"
    },
    {
      icon: Globe,
      title: "Global Impact",
      description: "Connecting 50+ countries with shared governance tools and financial sovereignty",
      gradient: "from-orange-500 to-red-600"
    }
  ];

  // Simulate user's DAO plan (replace with real plan check from context/store)
  const userDaoPlan = "free"; // or "premium"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden relative flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-8 flex items-center justify-between bg-gradient-to-r from-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-white/10 z-40">
        <div className="flex items-center space-x-3">
          <span className="font-black text-2xl text-white">Mtaa DAO</span>
        </div>
        <nav className="flex space-x-8">
          <a href="#features" className="text-purple-200 hover:text-white font-semibold transition">Features</a>
          <a href="/pricing" className="text-purple-200 hover:text-white font-semibold transition">Pricing</a>
          <a href="/maonovault" className="text-purple-200 hover:text-white font-semibold transition">MaonoVault</a>
          <a href="#benefits" className="text-purple-200 hover:text-white font-semibold transition">Benefits</a>
          <a href="#trust" className="text-purple-200 hover:text-white font-semibold transition">Trust</a>
        </nav>
        <a href="/register" className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 text-white px-6 py-2 rounded-2xl font-bold shadow-lg hover:scale-105 transition">Get Started</a>
      </header>
      {/* Animated Cursor Trail */}
      <div 
        className="fixed pointer-events-none z-50 w-6 h-6 bg-gradient-to-r from-orange-400 to-pink-600 rounded-full blur-sm opacity-60 transition-all duration-300"
        style={{
          left: mousePosition.x - 12,
          top: mousePosition.y - 12,
          transform: `translate3d(0, 0, 0) scale(${mousePosition.x > 0 ? 1 : 0})`
        }}
      />

      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated Gradient Orbs */}
        <div 
          className="absolute w-96 h-96 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full blur-3xl animate-pulse"
          style={{
            top: '10%',
            left: '10%',
            transform: `translate3d(${scrollY * 0.1}px, ${scrollY * 0.05}px, 0)`
          }}
        />
        <div 
          className="absolute w-80 h-80 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full blur-3xl animate-pulse delay-1000"
          style={{
            top: '60%',
            right: '10%',
            transform: `translate3d(${-scrollY * 0.1}px, ${-scrollY * 0.05}px, 0)`
          }}
        />
        <div 
          className="absolute w-64 h-64 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-full blur-3xl animate-pulse delay-2000"
          style={{
            top: '30%',
            left: '60%',
            transform: `translate3d(${scrollY * 0.05}px, ${scrollY * 0.1}px, 0)`
          }}
        />

        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Hero Section */}
      <div className="relative" id="hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className={`text-center transform transition-all duration-2000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            {/* Logo */}
            <div className="flex items-center justify-center space-x-4 mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-600 rounded-3xl blur-xl opacity-60 group-hover:opacity-80 transition-all duration-300 animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-all duration-300">
                  <span className="text-white font-black text-3xl">M</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-left">
                <h1 className="font-black text-5xl bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent">
                  Mtaa DAO
                </h1>
                <p className="text-purple-200 font-medium text-lg">For Mtaa From Mtaa</p>
              </div>
            </div>

            {/* Main Headline */}
            <div className="mb-8">
              <h1 className="text-7xl lg:text-8xl font-black mb-6 leading-tight">
                <span className="block text-white drop-shadow-2xl">Govern </span>
                <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-2xl animate-pulse">
                  Together
                </span>
                <span className="text-white drop-shadow-2xl">, Grow </span>
                <span className="bg-gradient-to-r from-purple-400 via-blue-500 to-cyan-500 bg-clip-text text-transparent drop-shadow-2xl animate-pulse">
                  Together
                </span>
              </h1>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-sm"></div>
                <p className="relative text-xl lg:text-2xl text-purple-100 max-w-4xl mx-auto leading-relaxed font-medium">
                  The future of community governance is here. Built on the African spirit of "mtaa" (neighborhood), 
                  we're revolutionizing how communities coordinate, contribute, and create wealth together.
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
            <a href="/register">
              <Button
                size="lg"
                className="relative group bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:from-orange-600 hover:via-pink-600 hover:to-purple-700 text-white px-12 py-8 text-xl font-bold rounded-3xl shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 group-hover:animate-pulse"></div>
                <span className="relative flex items-center">
                  <Sparkles className="mr-3 h-6 w-6" />
                  Launch Your Community
                  <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </a>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-12 py-8 text-xl font-bold rounded-3xl backdrop-blur-sm transition-all duration-300 hover:scale-105"
              >
                <span className="flex items-center">
                  <Heart className="mr-3 h-6 w-6" />
                  Explore Demo
                </span>
              </Button>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="group relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                    <div className="relative text-center p-6 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 hover:border-white/40 transition-all duration-300">
                      <div className={`w-16 h-16 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-xl`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-4xl lg:text-5xl font-black text-white mb-2">
                        {stat.number}
                      </div>
                      <div className="text-purple-200 font-semibold text-lg">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-32 relative" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-6xl font-black text-white mb-6">
              Built for the Future
            </h2>
            <p className="text-2xl text-purple-200 max-w-3xl mx-auto">
              Combining traditional community values with cutting-edge blockchain technology
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isActive = activeFeature === index;
              // List of premium features by title
              const premiumFeatures = [
                "Treasury Analytics",
                "Achievement System",
                "Gamified Growth",
                "Task Marketplace"
              ];
              const isPremium = premiumFeatures.includes(feature.title);
              const isLocked = isPremium && userDaoPlan === "free";
              return (
                <Card key={index} className={`group relative overflow-hidden bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 transition-all duration-700 ${isActive ? 'scale-105 shadow-2xl ring-2 ring-white/30' : ''} ${isLocked ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                  <CardContent className="relative p-8 text-center">
                    <div className={`w-20 h-20 bg-gradient-to-br ${feature.gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 transform transition-all duration-500 ${isActive ? 'scale-110 rotate-12' : 'group-hover:scale-105 group-hover:rotate-6'} shadow-2xl`}>
                      {isLocked ? <Lock className="h-10 w-10 text-white" /> : <Icon className="h-10 w-10 text-white" />}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-purple-200 leading-relaxed">
                      {feature.description}
                    </p>
                    {isLocked && (
                      <div className="mt-4 text-sm text-red-400 font-bold flex items-center justify-center gap-2">
                        <Lock className="h-4 w-4" />
                        <span>Premium Feature – <a href="/pricing" className="underline text-red-300">Upgrade to unlock</a></span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing Section removed as per request. Navigation link remains. */}

      {/* Benefits Section */}
      <div className="py-20 bg-gradient-to-r from-purple-900/50 to-blue-900/50 backdrop-blur-sm" id="benefits">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">
              Why Choose Mtaa DAO?
            </h2>
            <p className="text-xl text-purple-200">
              Experience the next generation of community governance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div key={index} className="group flex items-center space-x-4 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:border-white/40 hover:bg-white/20 transition-all duration-300">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-semibold text-lg">{benefit.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Assumed Features Section */}
      <div className="py-24 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-blue-500/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">What Else?</h2>
            <p className="text-xl text-purple-200">Upcoming features for your DAO</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 text-center shadow-xl">
              <Star className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-2xl font-bold text-white mb-2">AI-Powered Insights</h3>
              <p className="text-purple-200">Get predictive analytics and actionable recommendations for your community growth.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 text-center shadow-xl">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <h3 className="text-2xl font-bold text-white mb-2">Automated Rewards</h3>
              <p className="text-purple-200">Distribute bounties and incentives automatically based on contribution metrics.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 text-center shadow-xl">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-pink-400" />
              <h3 className="text-2xl font-bold text-white mb-2">NFT Badges</h3>
              <p className="text-purple-200">Unlock unique digital badges for achievements and milestones in your DAO.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Section */}
      <div className="py-24 relative" id="trust">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-black text-white mb-6">
              Trusted by Communities Worldwide
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Built on proven blockchain technology with community-first principles
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {trustFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="group text-center relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                  <div className="relative p-8">
                    <div className={`w-24 h-24 bg-gradient-to-br ${feature.gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-2xl`}>
                      <Icon className="h-12 w-12 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
                    <p className="text-purple-200 text-lg leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Success Stories Section */}
      <div className="mb-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-4">
            Real Impact, Real Stories
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how communities across Kenya are transforming their financial futures through MtaaDAO
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-white text-2xl">💧</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Clean Water Access</h3>
            <p className="text-gray-600 mb-4">Kibera community raised KES 2.3M for water infrastructure, serving 15,000+ residents</p>
            <div className="text-sm text-blue-600 font-semibold">847 contributors • 8 months</div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-white text-2xl">📈</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Investment Success</h3>
            <p className="text-gray-600 mb-4">Eastlands Chama achieved 340% ROI through transparent DeFi investments</p>
            <div className="text-sm text-green-600 font-semibold">234 members • KES 5.8M managed</div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-white text-2xl">💼</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Business Growth</h3>
            <p className="text-gray-600 mb-4">Market vendors increased business capital by 78% through automated savings</p>
            <div className="text-sm text-purple-600 font-semibold">156 vendors • 23 new businesses</div>
          </div>
        </div>

        <div className="text-center">
          <Link 
            href="/success-stories" 
            className="inline-flex items-center bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            View All Success Stories
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </div>

      {/* Enhanced Features Section */}
      <div className="mb-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-4">
            Complete Financial Ecosystem
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything your community needs for transparent, efficient financial management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[{ 
              icon: "✨", 
              title: "Create a DAO", 
              description: "Launch your own decentralized community in minutes.",
              link: "/create-dao"
            },
            { 
              icon: "🏦", 
              title: "Community Vaults", 
              description: "Secure, yield-generating savings with transparent governance",
              link: "/vault"
            },
            { 
              icon: "💳", 
              title: "Digital Wallet", 
              description: "Multi-currency wallet with DeFi integrations and MiniPay support",
              link: "/wallet"
            },
            { 
              icon: "🗳️", 
              title: "Governance Tools", 
              description: "Transparent voting and proposal management for community decisions",
              link: "/proposals"
            },
            { 
              icon: "📊", 
              title: "Real-time Analytics", 
              description: "Track performance, growth, and impact with detailed insights",
              link: "/analytics"
            },
            { 
              icon: "🎯", 
              title: "Task Bounties", 
              description: "Incentivize community work through transparent task management",
              link: "/tasks"
            },
            { 
              icon: "🤝", 
              title: "Referral System", 
              description: "Grow your community with built-in referral rewards",
              link: "/referrals"
            },
            { 
              icon: "🔄", 
              title: "Batch Transfers", 
              description: "Efficient bulk payments and automated disbursements",
              link: "/wallet/batch-transfer"
            },
            { 
              icon: "🏆", 
              title: "Reputation System", 
              description: "Build trust through transparent contribution tracking",
              link: "/leaderboard"
            }
          ].map((feature, index) => (
            <Link
              key={index}
              href={feature.link}
              className="group bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Documentation & Resources */}
      <div className="mb-20 bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Resources & Documentation</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Everything you need to get started and succeed with MtaaDAO
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Getting Started Guide</h3>
            <p className="text-gray-600 mb-4">Step-by-step tutorials for setting up your first DAO</p>
            <a href="/docs/getting-started" className="text-orange-600 hover:text-orange-700 font-medium">
              Read Guide →
            </a>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Code className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">API Documentation</h3>
            <p className="text-gray-600 mb-4">Complete API reference for developers and integrations</p>
            <a href="/docs/api" className="text-orange-600 hover:text-orange-700 font-medium">
              View Docs →
            </a>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Community Support</h3>
            <p className="text-gray-600 mb-4">Get help from our community and support team</p>
            <a href="/help" className="text-orange-600 hover:text-orange-700 font-medium">
              Get Support →
            </a>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="py-32 bg-gradient-to-br from-orange-500 via-pink-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]"></div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-6xl font-black text-white mb-8">
            Ready to Build the Future?
          </h2>
          <p className="text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
            Join thousands of communities already transforming their governance, 
            financial growth, and collective impact through Mtaa DAO
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a href="/register">
              <Button
                size="lg"
                className="relative group bg-white text-purple-600 hover:bg-gray-100 px-16 py-8 text-2xl font-black rounded-3xl shadow-2xl transform hover:scale-105 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-100/20 to-transparent -skew-x-12 group-hover:animate-pulse"></div>
                <span className="relative flex items-center">
                  <Sparkles className="mr-3 h-6 w-6" />
                  Start Your Journey
                  <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </a>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white/50 text-white hover:bg-white/10 hover:border-white px-16 py-8 text-2xl font-black rounded-3xl backdrop-blur-sm transition-all duration-300 hover:scale-105"
            >
              <span className="flex items-center">
                <Trophy className="mr-3 h-6 w-6" />
                View Success Stories
              </span>
            </Button>
          </div>
        </div>
      </div>
      {/* Footer */}
      <footer className="w-full py-10 px-8 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-t border-white/10 text-center text-purple-200 font-medium mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <span>© {new Date().getFullYear()} Mtaa DAO. All rights reserved.</span>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="/pricing" className="hover:text-white transition">Pricing</a>
            <a href="#benefits" className="hover:text-white transition">Benefits</a>
            <a href="#trust" className="hover:text-white transition">Trust</a>
          </div>
        </div>
      </footer>
    </div>
  );
}