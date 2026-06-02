import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight, Users, Vote, Wallet, Target, TrendingUp,
  Shield, CheckCircle, Heart, ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Link } from 'wouter';
import PublicImpactFeed from '@/components/PublicImpactFeed';
import DaoOfTheWeekBanner from '@/components/DaoOfTheWeekBanner';

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimatedBackground({ scrollY }: { scrollY: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute w-96 h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
        style={{
          top: '10%', left: '10%',
          transform: `translate3d(${scrollY * 0.05}px, ${scrollY * 0.03}px, 0)`
        }}
      />
      <div
        className="absolute w-80 h-80 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
        style={{
          top: '60%', right: '10%',
          transform: `translate3d(${-scrollY * 0.05}px, ${-scrollY * 0.03}px, 0)`
        }}
      />
    </div>
  );
}

function CoreFeaturesGrid() {
  const features = [
    {
      icon: Wallet, title: "Personal Wallet",
      description: "Send & receive money instantly. Support for USDT, CELO, cUSD, cEUR & more.",
      gradient: "from-blue-400 to-cyan-500", path: "/wallet", cta: "Open your wallet"
    },
    {
      icon: TrendingUp, title: "Smart Vaults / Group Investments",
      description: "Professional DeFi management. Earn 8–15% APY on your savings.",
      gradient: "from-green-400 to-emerald-500", path: "/vault", cta: "Start earning"
    },
    {
      icon: Users, title: "Community DAOs",
      description: "Pool resources, vote on decisions, transparent treasury management.",
      gradient: "from-purple-400 to-pink-500", path: "/daos", cta: "Create a DAO"
    },
    {
      icon: Target, title: "Goal-Based Savings",
      description: "Set targets, lock funds, earn bonus interest. Build your future.",
      gradient: "from-amber-400 to-orange-500", path: "/wallet#locked-savings", cta: "Set a goal"
    },
    {
      icon: Vote, title: "Governance & Voting",
      description: "Every decision is transparent. Your voice, your vote, your power.",
      gradient: "from-indigo-400 to-blue-500", path: "/proposals", cta: "See proposals"
    },
    {
      icon: Shield, title: "Multi-Signature Security",
      description: "Enterprise-grade security for group funds. Multiple approvals required.",
      gradient: "from-red-400 to-pink-500", path: "/dao/treasury", cta: "Secure your funds"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <Link key={index} href={feature.path}>
            <Card className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300 h-full cursor-pointer">
              <CardContent className="p-6">
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-4 shadow-xl group-hover:scale-110 transition-transform`}>
                  <Icon className="h-8 w-8 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-purple-200 text-sm">{feature.description}</p>
                <div className="mt-4 flex items-center text-sm text-orange-400 group-hover:text-orange-300 font-semibold">
                  {feature.cta} <ArrowRight className="ml-1 w-4 h-4" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function WalletFeaturesGrid() {
  const features = [
    {
      icon: Shield, title: "Peer-to-Peer Escrow",
      description: "Send money safely with milestone protection.",
      items: [
        "Custom milestones for deliverables",
        "Shareable invite links (no signup needed)",
        "Auto-signup for recipients",
        "Dispute resolution & refunds"
      ],
      gradient: "from-emerald-400 to-teal-500", path: "/wallet"
    },
    {
      icon: TrendingUp, title: "Smart Bill Splitting",
      description: "Split costs instantly with zero friction.",
      items: [
        "Split any bill equally or custom amounts",
        "Request payments from friends",
        "Automatic settlement tracking",
        "Monthly statements & history"
      ],
      gradient: "from-violet-400 to-indigo-500", path: "/wallet"
    },
    {
      icon: Heart, title: "Group Money Management",
      description: "Pool money with friends for gifts, events, or joint purchases.",
      items: [
        "Create group savings pots",
        "Transparent balance tracking",
        "One-tap contributions",
        "Fair distribution rules"
      ],
      gradient: "from-pink-400 to-rose-500", path: "/wallet"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {features.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <Card key={index} className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 transition-all duration-300">
            <CardContent className="p-6">
              <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="h-7 w-7 text-white" aria-hidden="true" />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">{feature.title}</h4>
              <p className="text-purple-200 text-sm mb-4">{feature.description}</p>
              <ul className="space-y-2 mb-6">
                {feature.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href={feature.path} className="text-orange-400 hover:text-orange-300 text-sm font-semibold flex items-center gap-1">
                Try it now <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TestimonialsSection() {
  const testimonials = [
    {
      name: "Jane Mwangi", location: "Kibera, Nairobi",
      quote: "My shop processes KES 45,000/month through Mtaa. No more cash theft.",
      impact: "+180% revenue", avatar: "JM"
    },
    {
      name: "Peter Ochieng", location: "Eastlands",
      quote: "Instant payments from customers. I earn 8% more with Mtaa tokens.",
      impact: "+52 customers", avatar: "PO"
    },
    {
      name: "Amina Karanja", location: "Kawangware",
      quote: "Our chama saved KES 2.3M transparently. Zero disputes.",
      impact: "847 members", avatar: "AK"
    },
    {
      name: "Dennis Mutua", location: "Githurai",
      quote: "Our old treasurer disappeared with KES 120K. Switched to Mtaa — no one person can touch the funds without a vote.",
      impact: "Group rebuilt in 3 months", avatar: "DM"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {testimonials.map((t, idx) => (
        <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
              aria-label={t.name}
            >
              {t.avatar}
            </div>
            <div>
              <div className="text-white font-semibold">{t.name}</div>
              <div className="text-purple-200 text-sm">{t.location}</div>
            </div>
          </div>
          <p className="text-purple-100 mb-3 italic">&ldquo;{t.quote}&rdquo;</p>
          <div className="text-green-400 font-bold text-sm">{t.impact}</div>
        </div>
      ))}
    </div>
  );
}

function YouthImpactSection() {
  const items = [
    {
      icon: Users, title: "Start With Nothing",
      description: "No bank account needed. Start with just KES 100.",
      stat: "60M+ unbanked youth can join",
      gradient: "from-purple-400 to-pink-500"
    },
    {
      icon: Target, title: "Build Your Future",
      description: "Save for school fees, start a business, or invest together.",
      stat: "70% of users are under 30",
      gradient: "from-emerald-400 to-teal-500"
    },
    {
      icon: Heart, title: "Learn & Earn",
      description: "Get paid to participate. Build your financial reputation.",
      stat: "Average KES 5,000/month extra income",
      gradient: "from-orange-400 to-red-500"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {items.map((impact, index) => {
        const Icon = impact.icon;
        return (
          <Card key={index} className="group bg-white/10 backdrop-blur-sm border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-300">
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 bg-gradient-to-br ${impact.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl group-hover:scale-110 transition-transform`}>
                <Icon className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{impact.title}</h3>
              <p className="text-purple-200 text-sm mb-3">{impact.description}</p>
              <div className="text-emerald-400 font-bold text-sm">{impact.stat}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      emoji: "📱", step: "1", title: "Create Your Group",
      description: "Set up a DAO in under 2 minutes. Invite members by phone number — no crypto wallet needed to join."
    },
    {
      emoji: "💰", step: "2", title: "Pool Your Money",
      description: "Members contribute via M-Pesa or crypto. Every shilling lands in a smart contract, not someone's personal account."
    },
    {
      emoji: "🗳️", step: "3", title: "Vote on Decisions",
      description: "Need to spend or invest? Anyone can raise a proposal. Funds only move when the group votes yes."
    },
    {
      emoji: "📊", step: "4", title: "Track Everything Live",
      description: "Every transaction, every vote, every balance — visible to all members 24/7 on a live dashboard."
    }
  ];

  return (
    <section className="relative py-24 px-6 bg-gradient-to-b from-slate-950 to-slate-900" id="how-it-works">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full mb-4">
            <span className="text-sm font-bold text-purple-400">How It Works</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Up and running in <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">minutes</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">No bank account. No crypto experience. Just a phone number.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-purple-500/50 to-transparent z-10" aria-hidden="true" />
              )}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/30 transition-all h-full">
                <div className="text-4xl mb-3">{s.emoji}</div>
                <div className="text-xs font-bold text-purple-400 mb-1">STEP {s.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is my money safe?",
      a: "Yes. Group funds are held in audited smart contracts on the Celo blockchain — not in anyone's personal account. No single person can move money without a group vote passing. Code enforces the rules, not trust."
    },
    {
      q: "Do I need a bank account or crypto wallet?",
      a: "No. You can join and contribute using M-Pesa. We handle the blockchain layer for you. Recipients get a wallet created automatically when they receive their first payment."
    },
    {
      q: "What are the fees?",
      a: "Creating a group is free. Transactions cost roughly KES 0.13 (about $0.001) in network fees. Mtaa charges a 0.5% platform fee only on withdrawals. No hidden charges, no monthly subscription."
    },
    {
      q: "How do I withdraw my money?",
      a: "Raise a withdrawal proposal. Once the required number of members vote yes, funds are released instantly to your wallet or M-Pesa number. Most withdrawals complete in under 60 seconds."
    },
    {
      q: "Is this legal and regulated?",
      a: "Mtaa operates under Kenya's existing cooperative and digital asset frameworks. We are registered in Kenya and comply with CBK reporting guidelines. Your on-chain records are also your legal paper trail."
    }
  ];

  return (
    <section className="relative py-24 px-6 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full mb-4">
            <span className="text-sm font-bold text-blue-400">FAQ</span>
          </div>
          <h2 className="text-4xl font-black text-white mb-4">
            Questions Before You Start
          </h2>
          <p className="text-gray-400">Everything you need to know before trusting us with your group's money.</p>
        </div>

        <div className="space-y-3" role="list">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors"
              role="listitem"
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <span className="text-white font-semibold pr-4">{faq.q}</span>
                {openIndex === i
                  ? <ChevronUp className="w-5 h-5 text-purple-400 flex-shrink-0" aria-hidden="true" />
                  : <ChevronDown className="w-5 h-5 text-purple-400 flex-shrink-0" aria-hidden="true" />
                }
              </button>
              {openIndex === i && (
                <div className="px-6 pb-6 text-gray-300 text-sm leading-relaxed border-t border-white/10 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MtaaDAOLanding() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden relative flex flex-col">
      <AnimatedBackground scrollY={scrollY} />

      {/* ── Header ── */}
      <header className="w-full py-4 px-6 flex items-center justify-between bg-gradient-to-r from-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-white/10 z-40 sticky top-0">
        <div className="flex items-center space-x-3">
          <Logo variant="icon" size="sm" forceTheme="dark" />
          <span className="font-black text-xl text-white">Mtaa DAO</span>
        </div>
        <nav className="hidden md:flex space-x-6 text-sm" aria-label="Main navigation">
          <a href="#features" className="text-purple-200 hover:text-white transition">Features</a>
          <a href="#how-it-works" className="text-purple-200 hover:text-white transition">How It Works</a>
          <Link href="/blog" className="text-purple-200 hover:text-white transition">Blog</Link>
          <Link href="/success-stories" className="text-purple-200 hover:text-white transition">Success Stories</Link>
          <Link href="/pricing" className="text-purple-200 hover:text-white transition">Pricing</Link>
          <Link href="/maonovault" className="text-purple-200 hover:text-white transition">MaanoVault</Link>
          <a href="/whitepaper.html" target="_blank" rel="noopener noreferrer" className="text-purple-200 hover:text-white transition">Whitepaper</a>
        </nav>
        <Link href="/register">
          <Button variant="primary" className="px-6 py-2 rounded-xl font-bold shadow-lg">
            Get Started
          </Button>
        </Link>
      </header>

      {/* ── Hero ── */}
      <div className="relative flex-1" id="hero">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <DaoOfTheWeekBanner />

          <div className={`text-center transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} mt-8`}>
            {/* Trust Badge — money stat first, member count second */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-8">
              <CheckCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-emerald-400">
                KES 30M in group treasuries &bull; 2,000+ people saving transparently
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="block text-white">Your Chama,</span>
              <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                See Every Shilling, Every Second
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-purple-100 max-w-3xl mx-auto mb-10 leading-relaxed font-semibold">
              Money locked in smart contracts. Permanent blockchain records. Every decision put to a vote.
            </p>

            {/* Quick proof points */}
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-white text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" aria-hidden="true" />
                <span>Code-enforced rules — no treasurer can disappear with funds</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" aria-hidden="true" />
                <span>Immutable on-chain records — no deleted spreadsheets</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" aria-hidden="true" />
                <span>Democratic voting — no single point of failure</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/register" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white px-12 py-7 text-xl font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all min-h-[56px]"
                >
                  Start Your Chama Free
                  <ArrowRight className="ml-2 h-6 w-6" aria-hidden="true" />
                </Button>
              </Link>
              <a href="#how-it-works" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 px-12 py-7 text-xl font-bold rounded-2xl backdrop-blur-sm transition-all min-h-[56px]"
                >
                  See How It Works
                </Button>
              </a>
            </div>

            {/* Hero social proof — Dennis's story up front */}
            <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" aria-label="Dennis Mutua">
                  DM
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">Dennis Mutua</div>
                  <div className="text-purple-300 text-xs">Githurai</div>
                </div>
              </div>
              <p className="text-purple-100 text-sm italic">
                &ldquo;Our old treasurer disappeared with KES 120K. Switched to Mtaa — no one person can touch the funds without a vote.&rdquo;
              </p>
              <div className="text-green-400 text-xs font-bold mt-2">Group rebuilt in 3 months</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Impact Feed ── */}
      <section className="py-12 px-4" aria-label="Live platform activity">
        <div className="max-w-7xl mx-auto">
          <PublicImpactFeed />
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="relative py-24 px-6 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full mb-4">
              <span className="text-sm font-bold text-red-400">The Reality</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black">
              Why <span className="text-red-400">60% of Chamas</span> Collapse
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mt-4">
              Fraud, mismanagement, and lack of transparency destroy trust — and savings
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[
              { emoji: "❌", title: "Treasurer disappears with group money", sub: "No blockchain records. No accountability. Money gone." },
              { emoji: "📱", title: "Fake M-Pesa screenshots", sub: "Manual records altered. Impossible to verify truth." },
              { emoji: "📒", title: "Manual records get \"lost\"", sub: "Excel files deleted. Disputes with no evidence." },
              { emoji: "🤔", title: "No proof where money is", sub: "Trust breaks. Group collapses. Savings lost." }
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-500 opacity-10 group-hover:opacity-20 transition-opacity rounded-2xl blur-xl" aria-hidden="true" />
                <div className="relative bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/30 transition-all">
                  <div className="text-4xl mb-4">{item.emoji}</div>
                  <p className="text-white font-semibold text-lg leading-relaxed">{item.title}</p>
                  <p className="text-gray-400 text-sm mt-2">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-red-950/30 border-2 border-red-500/30 rounded-3xl p-8 text-center">
            <div className="text-5xl md:text-6xl font-black text-red-400 mb-2">KES 12 Billion</div>
            <p className="text-xl text-gray-300">Lost to chama fraud in Kenya last year alone</p>
          </div>
        </div>
      </section>

      {/* ── Solution Comparison ── */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-4">
              <span className="text-sm font-bold text-emerald-400">The Solution</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black">
              Make Theft <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Radically Harder</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-red-950/20 border border-red-500/30 rounded-3xl p-8">
              <div className="text-3xl mb-4" aria-hidden="true">❌</div>
              <h3 className="text-2xl font-bold mb-4 text-red-400">Traditional Chama</h3>
              <ul className="space-y-3 text-gray-300">
                {[
                  "Money in treasurer's M-Pesa (trust-based)",
                  "Manual Excel records (can be altered)",
                  "No real-time visibility into balances",
                  "One person controls everything"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-400 mt-1" aria-hidden="true">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-3xl p-8">
              <div className="text-3xl mb-4" aria-hidden="true">✅</div>
              <h3 className="text-2xl font-bold mb-4 text-emerald-400">Mtaa DAO Chama</h3>
              <ul className="space-y-3 text-gray-300">
                {[
                  "Money locked in smart contracts (code-enforced)",
                  "Blockchain records (permanent & immutable)",
                  "Live dashboard (see every transaction 24/7)",
                  "Democratic voting (no single point of failure)"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <HowItWorksSection />

      {/* ── Platform Capabilities ── */}
      <div className="py-16 relative" id="features">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Everything Your Group Needs</h2>
            <p className="text-xl text-purple-200">From daily transactions to earning 8–15% yields on transparent group savings</p>
          </div>
          <CoreFeaturesGrid />

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Your Complete Financial Journey</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { emoji: "💰", step: "1. Start", desc: "Get your wallet. Send/receive instantly." },
                { emoji: "📈", step: "2. Grow", desc: "Move savings to vaults. Earn 8–15% APY." },
                { emoji: "🤝", step: "3. Collaborate", desc: "Join or create a DAO. Pool resources." },
                { emoji: "🎯", step: "4. Achieve", desc: "Reach goals together. Build wealth." }
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl mb-2">{s.emoji}</div>
                  <div className="text-white font-bold mb-1">{s.step}</div>
                  <div className="text-purple-200 text-sm">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Wallet & Vault ── */}
      <div className="py-16 bg-gradient-to-r from-slate-900/50 to-blue-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Powerful Tools, Simple Experience</h2>
            <p className="text-xl text-purple-200">Professional-grade features that anyone can use</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Personal Wallet</h3>
                </div>
                <p className="text-purple-200 mb-4">Your daily financial hub</p>
                <ul className="space-y-2 text-white text-sm mb-6">
                  {[
                    "Send to phone numbers (no crypto knowledge needed)",
                    "Multiple currencies: CELO, cUSD, cEUR, cREAL",
                    "Instant transactions (~KES 0.13 fee)",
                    "Bill splitting & payment requests"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/wallet">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Open your wallet <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Smart Vaults</h3>
                </div>
                <p className="text-purple-200 mb-4">Professional yield management</p>
                <ul className="space-y-2 text-white text-sm mb-6">
                  {[
                    "Automated DeFi strategies (8–15% APY)",
                    "Goal-based savings accounts with time locks",
                    "Real-time performance tracking",
                    "Risk-adjusted strategies (conservative to aggressive)"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/vault">
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Start earning <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 mb-8">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-black text-white mb-2">Beyond Simple Transfers</h3>
              <p className="text-lg text-purple-200">Advanced wallet features for everyday needs</p>
            </div>
            <WalletFeaturesGrid />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mt-8">
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

      {/* ── Youth Impact ── */}
      <div className="py-16 bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-sm" id="youth-impact">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Built For Young People</h2>
            <p className="text-xl text-purple-200">No bank account? No problem. Start building your financial future today.</p>
          </div>
          <YouthImpactSection />

          <div className="mt-12 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Young People Making It Happen</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { emoji: "🎓", name: "Sarah, 22", story: "Saved KES 180K for university in 8 months with friends" },
                { emoji: "💼", name: "Kevin, 19", story: "Started phone repair business with group savings" },
                { emoji: "🏠", name: "Grace, 25", story: "Pooled rent deposit with 4 friends, moved to a better place" }
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl mb-2">{s.emoji}</div>
                  <div className="text-white font-bold mb-1">{s.name}</div>
                  <div className="text-purple-200 text-sm">{s.story}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Testimonials ── */}
      <div className="py-16 bg-gradient-to-r from-purple-900/50 to-blue-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-white mb-4">Real People, Real Impact</h2>
            <p className="text-xl text-purple-200">See how communities are transforming their futures</p>
          </div>
          <TestimonialsSection />
        </div>
      </div>

      {/* ── FAQ ── */}
      <FAQSection />

      {/* ── Final CTA ── */}
      <div className="py-24 bg-gradient-to-br from-orange-500 via-pink-600 to-purple-700 relative">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
            Ready to Start Saving Together?
          </h2>
          <p className="text-xl text-white/90 mb-4 leading-relaxed">Free to start. No hidden fees.</p>
          <p className="text-lg text-white/80 mb-10">Join 500+ groups already growing their money</p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 px-12 py-6 text-2xl font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all"
            >
              Create Your Group Now
              <ArrowRight className="ml-3 h-6 w-6" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="w-full py-8 px-6 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-t border-white/10 text-center text-purple-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Logo variant="icon" size="sm" forceTheme="dark" />
              <span className="font-bold">&copy; 2025 Mtaa DAO</span>
            </div>
            <nav className="flex flex-wrap gap-6 text-sm justify-center md:justify-end" aria-label="Footer navigation">
              <Link href="/success-stories" className="hover:text-white transition">Success Stories</Link>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <a href="/whitepaper.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Whitepaper</a>
              <Link href="/blog" className="hover:text-white transition">Blog</Link>
              <Link href="/maonovault" className="hover:text-white transition">MaanoVault</Link>
              <Link href="/support" className="hover:text-white transition">Support</Link>
              <Link href="/help" className="hover:text-white transition">Help</Link>
              <Link href="/careers" className="hover:text-white transition">Careers</Link>
              <a href="https://t.me/mtaadao" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Telegram</a>
              <a href="https://twitter.com/mtaadao" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Twitter</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}