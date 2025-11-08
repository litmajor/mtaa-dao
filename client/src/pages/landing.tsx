import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, Vote, Wallet, Target, Trophy, Zap, DollarSign, TrendingUp, Shield, Globe, CheckCircle, Sparkles, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Link } from 'wouter';

export default function MtaaDAOLanding() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const coreFeatures = [
    {
      icon: Sparkles,
      title: "AI Assistant",
      description: "Chat in Swahili, English, or Pidgin. Morio handles everything.",
      gradient: "from-emerald-400 to-teal-500"
    },
    {
      icon: DollarSign,
      title: "M-Pesa Integration",
      description: "Deposit and withdraw using mobile money instantly.",
      gradient: "from-green-400 to-emerald-500"
    },
    {
      icon: Wallet,
      title: "Smart Vaults",
      description: "Earn 6-12% APY on community savings automatically.",
      gradient: "from-amber-400 to-orange-500"
    },
    {
      icon: Vote,
      title: "Democratic Governance",
      description: "Token-weighted voting with gasless transactions.",
      gradient: "from-rose-400 to-pink-500"
    },
    {
      icon: Shield,
      title: "Fraud Detection",
      description: "AI-powered security with 95%+ accuracy.",
      gradient: "from-red-400 to-pink-500"
    },
    {
      icon: Globe,
      title: "Multi-Channel Access",
      description: "Web, Telegram, WhatsApp, USSD, and voice.",
      gradient: "from-blue-400 to-cyan-500"
    }
  ];

  const stats = [
    { number: "2K+", label: "Active Members", icon: Users },
    { number: "500+", label: "DAOs Created", icon: Vote },
    { number: "$300K+", label: "Total Value Locked", icon: DollarSign },
    { number: "85%+", label: "Satisfaction", icon: TrendingUp }
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
          <div className={`text-center transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="block text-white">Govern </span>
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                Together
              </span>
              <span className="text-white">, Grow </span>
              <span className="bg-gradient-to-r from-purple-400 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                Together
              </span>
            </h1>

            <p className="text-lg md:text-xl text-purple-100 max-w-3xl mx-auto mb-10 leading-relaxed">
              The world's first <span className="font-bold text-cyan-300">AI-powered DAO platform</span> for African communities. 
              Combining <span className="font-bold text-emerald-300">blockchain, AI, and mobile money</span> for transparent governance.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <a href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white px-10 py-6 text-lg font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Launch Your Community
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white/30 text-white hover:bg-white/10 px-10 py-6 text-lg font-bold rounded-2xl backdrop-blur-sm transition-all"
              >
                <Heart className="mr-2 h-5 w-5" />
                View Demo
              </Button>
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

      {/* Core Features - Simplified */}
      <div className="py-16 relative" id="features">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-purple-200">
              Transparent governance, financial growth, and community coordination
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300">
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl group-hover:scale-110 transition-transform`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-purple-200 text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
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
            Ready to Build the Future?
          </h2>
          <p className="text-xl text-white/90 mb-10 leading-relaxed">
            Join thousands of communities transforming their governance and financial growth
          </p>
          <a href="/register">
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 px-12 py-6 text-2xl font-black rounded-2xl shadow-2xl transform hover:scale-105 transition-all"
            >
              <Sparkles className="mr-3 h-6 w-6" />
              Start Your Journey
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