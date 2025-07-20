import React, { useEffect, useState } from 'react';
import { Shield, Wallet, Users, BarChart, Zap, Link2, Award, Sparkles, Globe, Lock, Box, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";

const MaonoVaultWeb3Page = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: Shield,
      title: "Secure Asset Vault",
      description: "Military-grade encryption and multi-signature security",
      gradient: "from-purple-400 via-pink-500 to-orange-600"
    },
    {
      icon: Globe,
      title: "Cross-Chain Bridge",
      description: "Seamless interoperability across multiple blockchains",
      gradient: "from-cyan-400 via-blue-500 to-purple-600"
    },
    {
      icon: Users,
      title: "Community Governance",
      description: "Decentralized decision-making and transparent operations",
      gradient: "from-amber-400 via-orange-500 to-red-600"
    }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-purple-900 to-black overflow-hidden flex flex-col relative">
      {/* Animated background effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 animate-pulse"></div>
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>

      {/* Header */}
      <header className="w-full py-6 px-8 flex items-center justify-between bg-gradient-to-r from-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-white/10 z-40">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all duration-300">
              <Shield className="w-6 h-6 text-white" />
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />
            </div>
          </div>
          <span className="font-display font-black text-3xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
            MaonoVault
          </span>
        </div>
        <nav className="flex items-center space-x-8">
          <a href="/" className="text-purple-200 hover:text-white font-semibold transition">Home</a>
          <a href="/maonovault" className="text-purple-200 hover:text-white font-semibold transition">MaonoVault</a>
          <Button 
            className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-semibold px-6 py-2 rounded-xl shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
          >
            Launch App
          </Button>
        </nav>
      </header>
      <main className="container mx-auto px-4 py-16 relative z-10">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-6xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
            Next-Gen Web3 Vault System
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Secure, decentralized, and community-driven asset management platform powered by advanced blockchain technology.
          </p>
          <Button 
            className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white text-lg font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 group"
          >
            Get Started 
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={`transform ${
                activeFeature === index ? 'scale-105' : 'scale-100'
              } transition-all duration-500 rounded-2xl overflow-hidden`}
            >
              <div className={`bg-gradient-to-br ${feature.gradient} p-1`}>
                <div className="bg-gray-900 rounded-xl p-6 h-full">
                  <feature.icon className="w-12 h-12 mb-4 text-white" />
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-300">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
          {[
            { value: "$2.5M+", label: "Total Value Locked" },
            { value: "12K+", label: "Active Users" },
            { value: "99.9%", label: "Uptime" },
            { value: "5+", label: "Supported Chains" }
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {stat.value}
              </div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <section className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-8 h-8 text-amber-400" />
            <h2 className="text-3xl font-bold text-purple-200">What is MaonoVault?</h2>
          </div>
          <p className="text-xl mb-4 text-gray-200">
            MaonoVault is a <span className="font-bold text-amber-400">decentralized smart contract vault</span> designed to securely manage digital assets, facilitate transparent transactions, and empower community-driven governance. Built on blockchain technology, it enables users to deposit, withdraw, and interact with assets in a trustless environment.
          </p>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <BarChart className="w-8 h-8 text-cyan-400" />
            <h2 className="text-3xl font-bold text-purple-200">Web3 Landscape in Our Project</h2>
          </div>
          <p className="text-xl mb-4 text-gray-200">
            Our project leverages the Web3 ecosystem to create a seamless experience for users interacting with decentralized finance (DeFi), DAOs, and blockchain-based applications. Key components include:
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <li className="flex items-center gap-2 bg-gradient-to-r from-purple-700 via-purple-500 to-pink-500 rounded-xl p-4 shadow-md">
              <Wallet className="w-6 h-6 text-amber-300" />
              <span className="text-lg text-white">Smart contracts for secure asset management</span>
            </li>
            <li className="flex items-center gap-2 bg-gradient-to-r from-pink-600 via-orange-500 to-yellow-400 rounded-xl p-4 shadow-md">
              <Users className="w-6 h-6 text-pink-100" />
              <span className="text-lg text-white">DAO governance for community decision-making</span>
            </li>
            <li className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 via-blue-500 to-purple-400 rounded-xl p-4 shadow-md">
              <Link2 className="w-6 h-6 text-cyan-200" />
              <span className="text-lg text-white">Integration with wallets and Web3 providers</span>
            </li>
            <li className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-orange-400 to-pink-400 rounded-xl p-4 shadow-md">
              <BarChart className="w-6 h-6 text-amber-100" />
              <span className="text-lg text-white">Analytics dashboards for transparency</span>
            </li>
            <li className="flex items-center gap-2 bg-gradient-to-r from-green-500 via-emerald-400 to-cyan-400 rounded-xl p-4 shadow-md">
              <Zap className="w-6 h-6 text-green-100" />
              <span className="text-lg text-white">Automated vault operations and event indexing</span>
            </li>
          </ul>
          <p className="text-xl text-gray-200">
            By combining these elements, our platform aims to foster a robust, transparent, and user-centric Web3 environment.
          </p>
        </section>

        <section className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-8 h-8 text-pink-300" />
            <h2 className="text-3xl font-bold text-purple-200">MaonoVault x MirrorCore</h2>
          </div>
          <p className="text-xl mb-4 text-gray-200">
            MaonoVault integrates with <span className="font-bold text-pink-300">MirrorCore</span> to provide enhanced interoperability, identity management, and seamless cross-chain experiences. MirrorCore enables users to connect multiple wallets, manage decentralized identities, and interact with Web3 protocols securely and efficiently within the MaonoVault ecosystem.
          </p>
        </section>
      </main>
    </div>
  );
};

export default MaonoVaultWeb3Page;
