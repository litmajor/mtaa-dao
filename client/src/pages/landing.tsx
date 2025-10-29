import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, Vote, Wallet, Target, Trophy, Zap, DollarSign, ClipboardList, Star, TrendingUp, Shield, Globe, CheckCircle, Sparkles, Heart, Coins, Award, Lock, BookOpen, Code, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
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
      icon: Sparkles,
      title: "Morio AI Assistant",
      description: "Natural language chat interface in English, Swahili, and more. Ask questions, create proposals, manage funds - all conversationally",
      color: "emerald",
      gradient: "from-emerald-400 via-teal-500 to-cyan-600",
      bgGradient: "from-emerald-50 to-teal-50"
    },
    {
      icon: TrendingUp,
      title: "AI-Powered Analytics",
      description: "ML-powered treasury predictions, risk assessment, fraud detection, and proposal quality scoring with 85%+ accuracy",
      color: "purple",
      gradient: "from-purple-400 via-violet-500 to-indigo-600",
      bgGradient: "from-purple-50 to-indigo-50"
    },
    {
      icon: DollarSign,
      title: "M-Pesa Integration",
      description: "Deposit and withdraw funds using M-Pesa, MTN Mobile Money, Airtel Money - bridging crypto and mobile money",
      color: "green",
      gradient: "from-green-400 via-emerald-500 to-teal-600",
      bgGradient: "from-green-50 to-emerald-50"
    },
    {
      icon: Globe,
      title: "Multi-Channel Access",
      description: "Manage your DAO via Web, Telegram bot, WhatsApp, USSD (feature phones), and voice commands",
      color: "blue",
      gradient: "from-blue-400 via-cyan-500 to-teal-600",
      bgGradient: "from-blue-50 to-cyan-50"
    },
    {
      icon: Wallet,
      title: "Smart Vaults (ERC-4626)",
      description: "Personal & community vaults with DeFi yield strategies (Moola, Ubeswap, Celo staking) earning 6-12% APY",
      color: "amber",
      gradient: "from-amber-400 via-orange-500 to-red-600",
      bgGradient: "from-amber-50 to-orange-50"
    },
    {
      icon: Vote,
      title: "Democratic Governance",
      description: "Token-weighted, quadratic, or 1-person-1-vote systems with gasless voting and automated execution",
      color: "rose",
      gradient: "from-rose-400 via-pink-500 to-fuchsia-600",
      bgGradient: "from-rose-50 to-pink-50"
    },
    {
      icon: Shield,
      title: "Fraud Detection AI",
      description: "Real-time anomaly detection, Sybil attack prevention, and proposal spam classification with 95%+ accuracy",
      color: "red",
      gradient: "from-red-400 via-pink-500 to-rose-600",
      bgGradient: "from-red-50 to-pink-50"
    },
    {
      icon: Users,
      title: "Community Network",
      description: "DAO chat with reactions, task marketplace, reputation system, and member contribution tracking",
      color: "violet",
      gradient: "from-violet-400 via-purple-500 to-indigo-600",
      bgGradient: "from-violet-50 to-purple-50"
    },
    {
      icon: Zap,
      title: "Automated Task Verification",
      description: "AI scores task submissions (0-100), auto-approves 70+ scores, and analyzes screenshots with computer vision",
      color: "yellow",
      gradient: "from-yellow-400 via-amber-500 to-orange-600",
      bgGradient: "from-yellow-50 to-amber-50"
    },
    {
      icon: Target,
      title: "Cross-Chain Bridge",
      description: "Transfer assets between Celo, Ethereum, Polygon, and Base with optimized routing and fee calculation",
      color: "cyan",
      gradient: "from-cyan-400 via-blue-500 to-indigo-600",
      bgGradient: "from-cyan-50 to-blue-50"
    },
    {
      icon: Trophy,
      title: "NFT Achievement Badges",
      description: "Unlock unique NFT badges for milestones, build reputation cross-DAO, and showcase your contributions",
      color: "pink",
      gradient: "from-pink-400 via-rose-500 to-red-600",
      bgGradient: "from-pink-50 to-rose-50"
    },
    {
      icon: ClipboardList,
      title: "Multi-Language Support",
      description: "Interface and AI assistant available in English, Swahili, Yoruba, Igbo, Hausa, French, and Zulu",
      color: "teal",
      gradient: "from-teal-400 via-cyan-500 to-blue-600",
      bgGradient: "from-teal-50 to-cyan-50"
    },
    {
      icon: Lock,
      title: "Multi-Sig Security",
      description: "Multi-signature wallets, timelock delays, rate limiting, and smart contract audits for maximum security",
      color: "indigo",
      gradient: "from-indigo-400 via-purple-500 to-violet-600",
      bgGradient: "from-indigo-50 to-purple-50"
    },
    {
      icon: Star,
      title: "AI Proposal Drafting",
      description: "Generate proposal templates with GPT-4, get quality scoring, sentiment analysis, and improvement suggestions",
      color: "lime",
      gradient: "from-lime-400 via-green-500 to-emerald-600",
      bgGradient: "from-lime-50 to-green-50"
    },
    {
      icon: Coins,
      title: "Flexible Pricing",
      description: "Free tier (up to 50 members), Premium (KES 1,500/mo), and Enterprise plans with crypto payment discounts",
      color: "orange",
      gradient: "from-orange-400 via-red-500 to-pink-600",
      bgGradient: "from-orange-50 to-red-50"
    },
    {
      icon: Award,
      title: "Voice Interface",
      description: "Vote, check balances, and manage your DAO using voice commands via phone - no internet required (USSD)",
      color: "fuchsia",
      gradient: "from-fuchsia-400 via-purple-500 to-pink-600",
      bgGradient: "from-fuchsia-50 to-purple-50"
    }
  ];

  const stats = [
    { number: "2K+", label: "Active Members", icon: Users, color: "from-blue-500 to-cyan-500" },
    { number: "500+", label: "DAOs Created", icon: Vote, color: "from-emerald-500 to-teal-500" },
    { number: "$300K+", label: "Total Value Locked", icon: DollarSign, color: "from-amber-500 to-orange-500" },
    { number: "85%+", label: "User Satisfaction", icon: TrendingUp, color: "from-purple-500 to-pink-500" }
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
          <a href="#architecture" className="text-purple-200 hover:text-white font-semibold transition">System</a>
          <a href="#features" className="text-purple-200 hover:text-white font-semibold transition">Features</a>
          <a href="/pricing" className="text-purple-200 hover:text-white font-semibold transition">Pricing</a>
          <a href="/whitepaper.html" target="_blank" className="text-purple-200 hover:text-white font-semibold transition">Whitepaper</a>
          <a href="#benefits" className="text-purple-200 hover:text-white font-semibold transition">Why Us</a>
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
            <div className="flex items-center justify-center space-x-6 mb-8">
              <div className="relative">
                <Logo variant="icon" size="lg" forceTheme="dark" />
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
                  The world's first <span className="font-bold text-cyan-300">AI-powered DAO platform</span> designed for African communities. 
                  Built on the spirit of "mtaa" (neighborhood), we combine <span className="font-bold text-emerald-300">blockchain, 
                  artificial intelligence, and local payment infrastructure</span> to democratize financial inclusion and transparent governance.
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

      {/* Three-Layer Architecture Section */}
      <div className="py-24 relative" id="architecture">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">
              The Morio System: Three Layers, One Vision
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Inspired by human cognition - separated concerns, interconnected intelligence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Morio - The Spirit */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:border-cyan-400/50 transition-all duration-300">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 text-center">MORIO - The Spirit</h3>
                <p className="text-purple-200 text-center mb-6">Your conversational AI companion</p>
                <ul className="space-y-3 text-purple-100">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Web, Mobile, Telegram, WhatsApp</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>USSD for feature phones</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Voice commands & responses</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Multi-language support</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Nuru - The Mind */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:border-purple-400/50 transition-all duration-300">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <TrendingUp className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 text-center">NURU - The Mind</h3>
                <p className="text-purple-200 text-center mb-6">AI-powered intelligence & analytics</p>
                <ul className="space-y-3 text-purple-100">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-purple-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Natural Language Understanding</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-purple-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Predictive treasury analytics</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-purple-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Risk & fraud detection</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-purple-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Proposal quality scoring</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Kwetu - The Body */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:border-orange-400/50 transition-all duration-300">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <Wallet className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 text-center">KWETU - The Body</h3>
                <p className="text-purple-200 text-center mb-6">Operational core & blockchain</p>
                <ul className="space-y-3 text-purple-100">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Wallet & vault management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Proposal lifecycle automation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>M-Pesa & mobile money</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Cross-chain bridging</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-32 relative" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-6xl font-black text-white mb-6">
              Powerful Features, Simple Interface
            </h2>
            <p className="text-2xl text-purple-200 max-w-3xl mx-auto">
              Everything you need for transparent governance, financial growth, and community coordination
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

      {/* Regional Strategy Section */}
      <div className="py-24 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">Built for Africa, Powered by Innovation</h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              We understand the unique needs of African communities - from mobile money to feature phones
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* East Africa */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-xl">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mr-4">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">East Africa</h3>
                  <p className="text-purple-200">Kenya, Tanzania, Uganda</p>
                </div>
              </div>
              <ul className="space-y-3 text-purple-100">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>M-Pesa integration (STK Push, B2C)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Swahili language support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>KES currency integration</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Partnerships with Safaricom</span>
                </li>
              </ul>
            </div>

            {/* West Africa */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 shadow-xl">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl flex items-center justify-center mr-4">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">West Africa</h3>
                  <p className="text-purple-200">Nigeria, Ghana, Senegal</p>
                </div>
              </div>
              <ul className="space-y-3 text-purple-100">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Paystack & Flutterwave integration</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Pidgin, Yoruba, Igbo, Hausa support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>NGN, GHS currency support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Islamic finance compliance</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Multi-Channel Access */}
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl border border-white/30 p-10">
            <h3 className="text-3xl font-bold text-white mb-8 text-center">Access Anywhere, Anytime</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-white font-bold mb-2">Web App</h4>
                <p className="text-purple-200 text-sm">Full-featured dashboard</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-white font-bold mb-2">Telegram Bot</h4>
                <p className="text-purple-200 text-sm">Chat-based commands</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-white font-bold mb-2">WhatsApp</h4>
                <p className="text-purple-200 text-sm">Business API integration</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-white font-bold mb-2">USSD + Voice</h4>
                <p className="text-purple-200 text-sm">No internet needed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap Preview */}
      <div className="py-24 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-blue-500/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">Coming Soon</h2>
            <p className="text-xl text-purple-200">Exciting features launching in 2026</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 text-center shadow-xl">
              <div className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">Q1 2026</div>
              <Star className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-2xl font-bold text-white mb-2">NLP Layer</h3>
              <p className="text-purple-200">Natural language understanding in 40+ intents, multi-language support, and sentiment analysis</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 text-center shadow-xl">
              <div className="inline-block bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">Q2 2026</div>
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <h3 className="text-2xl font-bold text-white mb-2">Advanced ML</h3>
              <p className="text-purple-200">Fraud detection, predictive governance, and RL-based treasury optimization</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8 text-center shadow-xl">
              <div className="inline-block bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">Q3 2026</div>
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-pink-400" />
              <h3 className="text-2xl font-bold text-white mb-2">Voice Interface</h3>
              <p className="text-purple-200">Vote, check balances, and manage your DAO using voice commands via phone</p>
            </div>
          </div>
        </div>
      </div>

      {/* Why Choose Mtaa DAO */}
      <div className="py-24 relative" id="why-choose">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">
              Why Traditional DAOs & Chamas Fail
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              We built Mtaa DAO because existing solutions - both digital DAOs and traditional chamas - don't work for modern African communities
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Problems - Traditional DAOs */}
            <div className="bg-red-500/10 backdrop-blur-sm rounded-3xl border border-red-500/30 p-8">
              <h3 className="text-2xl font-bold text-red-300 mb-6 flex items-center">
                <span className="text-3xl mr-3">❌</span> Traditional DAO Platforms
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start text-purple-100">
                  <span className="text-red-400 mr-3 text-xl">•</span>
                  <span>Require high technical literacy (complex UIs, crypto jargon)</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-red-400 mr-3 text-xl">•</span>
                  <span>Don't integrate with M-Pesa or mobile money</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-red-400 mr-3 text-xl">•</span>
                  <span>Lack cultural context and language support</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-red-400 mr-3 text-xl">•</span>
                  <span>Expensive to deploy and maintain ($1000s)</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-red-400 mr-3 text-xl">•</span>
                  <span>Don't work offline or on feature phones</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-red-400 mr-3 text-xl">•</span>
                  <span>No AI assistance for decision-making</span>
                </li>
              </ul>
            </div>

            {/* Problems - Traditional Chamas */}
            <div className="bg-orange-500/10 backdrop-blur-sm rounded-3xl border border-orange-500/30 p-8">
              <h3 className="text-2xl font-bold text-orange-300 mb-6 flex items-center">
                <span className="text-3xl mr-3">❌</span> Traditional Chamas/Savings Groups
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start text-purple-100">
                  <span className="text-orange-400 mr-3 text-xl">•</span>
                  <span>Manual record-keeping (notebooks, Excel sheets) prone to errors</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-orange-400 mr-3 text-xl">•</span>
                  <span>Lack of transparency - members can't verify transactions</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-orange-400 mr-3 text-xl">•</span>
                  <span>No automated enforcement - rely on trust and social pressure</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-orange-400 mr-3 text-xl">•</span>
                  <span>Cash handling risks (theft, loss, mismanagement)</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-orange-400 mr-3 text-xl">•</span>
                  <span>Limited to physical meetings - hard to scale remotely</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <span className="text-orange-400 mr-3 text-xl">•</span>
                  <span>No yield generation - money sits idle without returns</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Mtaa DAO Solution */}
          <div className="bg-green-500/10 backdrop-blur-sm rounded-3xl border border-green-500/30 p-10">
            <h3 className="text-3xl font-bold text-green-300 mb-8 flex items-center justify-center">
              <span className="text-4xl mr-4">✅</span> Mtaa DAO: Best of Both Worlds
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ul className="space-y-4">
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">AI-Powered Assistant</strong> - Natural language in Swahili, English, Pidgin</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Blockchain Transparency</strong> - Every transaction is recorded and verifiable</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Local Payment Integration</strong> - M-Pesa, Paystack, mobile money</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Automated Smart Contracts</strong> - Rules enforced automatically, no trust needed</span>
                </li>
              </ul>
              <ul className="space-y-4">
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">DeFi Yield Generation</strong> - Earn 6-12% APY on idle funds</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Multi-Channel Access</strong> - Web, Telegram, WhatsApp, USSD, Voice</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Fraud Detection AI</strong> - 95%+ accuracy in detecting suspicious activity</span>
                </li>
                <li className="flex items-start text-purple-100">
                  <CheckCircle className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span><strong className="text-white">Culturally Aware</strong> - Respects local customs, languages, and practices</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* Visible GDP Effect Dashboard */}
      <div className="py-24 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 backdrop-blur-sm" id="economic-impact">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-white mb-6">
              Real Economic Impact, Measured in Real-Time
            </h2>
            <p className="text-xl text-purple-200 max-w-3xl mx-auto">
              Not just tech — we're creating <span className="font-bold text-green-300">measurable GDP growth</span> in local communities across Africa
            </p>
          </div>

          {/* Live GDP Counter */}
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-3xl p-12 mb-12 text-center shadow-2xl">
            <div className="text-white/90 text-xl mb-4 font-semibold">🌍 Mtaa Network GDP (This Month)</div>
            <div className="text-6xl md:text-8xl font-black text-white mb-4 animate-pulse">
              KES 12,540,000
            </div>
            <div className="text-white/80 text-lg">
              Total value traded across the Mtaa network
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="text-white/80 text-sm mb-2">Monthly Growth</div>
                <div className="text-3xl font-bold text-white">+22%</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="text-white/80 text-sm mb-2">Active Merchants</div>
                <div className="text-3xl font-bold text-white">4,200</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="text-white/80 text-sm mb-2">Daily Transactions</div>
                <div className="text-3xl font-bold text-white">18,500+</div>
              </div>
            </div>
          </div>

          {/* Economic Activity Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <TrendingUp className="w-6 h-6 text-green-400 mr-3" />
                Top Performing Neighborhoods
              </h3>
              <div className="space-y-4">
                {[
                  { name: 'Kibera', volume: 'KES 2.8M', growth: '+35%', color: 'from-green-500 to-emerald-600' },
                  { name: 'Eastlands', volume: 'KES 2.1M', growth: '+28%', color: 'from-blue-500 to-cyan-600' },
                  { name: 'Kawangware', volume: 'KES 1.9M', growth: '+22%', color: 'from-purple-500 to-pink-600' },
                  { name: 'Mathare', volume: 'KES 1.5M', growth: '+19%', color: 'from-orange-500 to-red-600' }
                ].map((area, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 bg-gradient-to-br ${area.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-white font-semibold">{area.name}</div>
                        <div className="text-purple-200 text-sm">{area.volume} traded</div>
                      </div>
                    </div>
                    <div className="text-green-400 font-bold">{area.growth}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <DollarSign className="w-6 h-6 text-yellow-400 mr-3" />
                Economic Breakdown
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-purple-200">Local Trade Transactions</span>
                    <span className="text-white font-bold">KES 8.2M (65%)</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-3">
                    <div className="bg-gradient-to-r from-green-400 to-emerald-600 rounded-full h-3" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-purple-200">DAO Grants Deployed</span>
                    <span className="text-white font-bold">KES 2.8M (22%)</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-3">
                    <div className="bg-gradient-to-r from-blue-400 to-cyan-600 rounded-full h-3" style={{ width: '22%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-purple-200">Liquidity & Savings</span>
                    <span className="text-white font-bold">KES 1.5M (13%)</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-3">
                    <div className="bg-gradient-to-r from-purple-400 to-pink-600 rounded-full h-3" style={{ width: '13%' }}></div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
                <div className="flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <div className="text-white font-semibold mb-1">Treasury ROI: 127%</div>
                    <div className="text-purple-200 text-sm">Returns from grants, staking, and liquidity provisions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Impact Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="text-4xl font-black text-white mb-2">8,500+</div>
              <div className="text-purple-200">Jobs Supported</div>
            </div>
            <div className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="text-4xl font-black text-white mb-2">4,200</div>
              <div className="text-purple-200">Active Merchants</div>
            </div>
            <div className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="text-4xl font-black text-white mb-2">65%</div>
              <div className="text-purple-200">Income Increase</div>
            </div>
            <div className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="text-4xl font-black text-white mb-2">12+</div>
              <div className="text-purple-200">Neighborhoods</div>
            </div>
          </div>

          {/* Real Stories Feed */}
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl border border-white/30 p-10">
            <h3 className="text-3xl font-bold text-white mb-8 text-center">Real People, Real Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                    JM
                  </div>
                  <div>
                    <div className="text-white font-semibold">Jane Mwangi</div>
                    <div className="text-purple-200 text-sm">Kibera, Nairobi</div>
                  </div>
                </div>
                <p className="text-purple-100 text-sm mb-3">
                  "My small shop now processes KES 45,000/month through Mtaa. No more cash theft risks."
                </p>
                <div className="text-green-400 text-sm font-bold">+180% revenue growth</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold">
                    PO
                  </div>
                  <div>
                    <div className="text-white font-semibold">Peter Ochieng</div>
                    <div className="text-purple-200 text-sm">Eastlands Boda Rider</div>
                  </div>
                </div>
                <p className="text-purple-100 text-sm mb-3">
                  "Instant payments from customers. I earn 8% more because I accept Mtaa tokens."
                </p>
                <div className="text-green-400 text-sm font-bold">+52 new regular customers</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                    AK
                  </div>
                  <div>
                    <div className="text-white font-semibold">Amina Karanja</div>
                    <div className="text-purple-200 text-sm">Kawangware Chama Leader</div>
                  </div>
                </div>
                <p className="text-purple-100 text-sm mb-3">
                  "Our chama saved KES 2.3M transparently. Everyone can verify every shilling."
                </p>
                <div className="text-green-400 text-sm font-bold">847 members, zero disputes</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <p className="text-white text-xl mb-6">
              Join the movement building <span className="font-bold text-green-300">measurable economic transformation</span>
            </p>
            <a href="/register">
              <Button
                size="lg"
                className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 hover:from-green-600 hover:via-emerald-600 hover:to-teal-700 text-white px-12 py-6 text-xl font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all"
              >
                <TrendingUp className="mr-3 h-6 w-6" />
                Start Contributing to GDP Growth
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
            </a>
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
          <p className="text-xl text-purple-200 max-w-3xl mx-auto">
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
          <p className="text-xl text-purple-200 max-w-3xl mx-auto">
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
              title: "Mtaa Wallet", 
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
              title: "Bill Splitting", 
              description: "Automatically split subscription costs among DAO members (equal, custom, or percentage-based)",
              link: "/wallet"
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

        {/* Whitepaper Download Section */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-8 mb-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">📄 Official Whitepaper</h3>
          <p className="text-white/90 mb-6">Read our comprehensive whitepaper in your preferred format</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/whitepaper.html" 
              target="_blank"
              className="inline-flex items-center bg-white text-purple-600 px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all transform hover:scale-105"
            >
              <Globe className="w-5 h-5 mr-2" />
              Read Online (HTML)
            </a>
            <a 
              href="/MtaaDAO-Whitepaper.pdf" 
              download
              className="inline-flex items-center bg-white text-purple-600 px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all transform hover:scale-105"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Download PDF
            </a>
            <a 
              href="https://mtaadao.github.io/mtaa-dao" 
              target="_blank"
              rel="noopener"
              className="inline-flex items-center bg-white text-purple-600 px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all transform hover:scale-105"
            >
              <Code className="w-5 h-5 mr-2" />
              Rust Docs (Technical)
            </a>
          </div>
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
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* About */}
            <div>
              <h3 className="text-white font-bold mb-4">About Mtaa DAO</h3>
              <p className="text-sm text-purple-300">
                The world's first AI-powered DAO platform designed for African communities, combining blockchain and local payment infrastructure.
              </p>
            </div>
            
            {/* Quick Links */}
            <div>
              <h3 className="text-white font-bold mb-4">Quick Links</h3>
              <div className="flex flex-col space-y-2">
                <a href="#architecture" className="hover:text-white transition text-sm">System Architecture</a>
                <a href="#features" className="hover:text-white transition text-sm">Features</a>
                <a href="/pricing" className="hover:text-white transition text-sm">Pricing</a>
                <a href="/whitepaper.html" target="_blank" className="hover:text-white transition text-sm">Whitepaper</a>
              </div>
            </div>

            {/* Platform */}
            <div>
              <h3 className="text-white font-bold mb-4">Platform</h3>
              <div className="flex flex-col space-y-2">
                <a href="/vault" className="hover:text-white transition text-sm">MaonoVault</a>
                <a href="/wallet" className="hover:text-white transition text-sm">Wallet</a>
                <a href="/proposals" className="hover:text-white transition text-sm">Governance</a>
                <a href="/analytics" className="hover:text-white transition text-sm">Analytics</a>
              </div>
            </div>

            {/* Community */}
            <div>
              <h3 className="text-white font-bold mb-4">Community</h3>
              <div className="flex flex-col space-y-2">
                <a href="/daos" className="hover:text-white transition text-sm">Explore DAOs</a>
                <a href="/success-stories" className="hover:text-white transition text-sm">Success Stories</a>
                <a href="/help" className="hover:text-white transition text-sm">Support</a>
                <a href="https://t.me/mtaadao" target="_blank" rel="noopener" className="hover:text-white transition text-sm">Telegram</a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between">
            <span>© {new Date().getFullYear()} Mtaa DAO. All rights reserved.</span>
            <div className="flex space-x-6 mt-4 md:mt-0 text-sm">
              <span className="text-cyan-300">🚀 55% Complete - Q1 2026 Launch</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}