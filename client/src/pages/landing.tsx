import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Wallet, Vote, TrendingUp, ShieldCheck, Smartphone, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/ui/logo";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import DaoOfTheWeekBanner from "@/components/DaoOfTheWeekBanner";

function AnimatedBackground({ scrollY }: { scrollY: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        style={{ transform: `translateY(${(scrollY || 0) * 0.02}px)` }}
        className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
      />
      <div
        style={{ transform: `translateY(${(scrollY || 0) * -0.015}px)` }}
        className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl"
      />
    </div>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center mb-12">
      {eyebrow && (
        <div className="text-xs uppercase tracking-widest text-purple-300 font-semibold mb-3">{eyebrow}</div>
      )}
      <h2 className="text-3xl md:text-4xl font-black text-white mb-3">{title}</h2>
      {sub && <p className="text-gray-300 text-lg">{sub}</p>}
    </div>
  );
}

function WhyWeExistSection() {
  return (
    <section className="py-20 px-6 border-t border-white/10">
      <div className="max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-widest text-purple-300 font-semibold mb-3 text-center">
          Why MtaaDAO
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white mb-6 text-center">
          Chamas run on trust. We think trust should be verifiable, not assumed.
        </h2>
        <div className="text-gray-300 text-lg leading-relaxed space-y-4">
          <p>
            Millions of people across East Africa pool money through chamas — informal savings
            and investment groups built on relationships. That model works because people show
            up for each other. It also has a single point of failure: whoever holds the money.
          </p>
          <p>
            MtaaDAO moves the "holding" part onto a shared treasury that your group controls
            together. Contributions go in through M-Pesa. Withdrawals go out only after your
            group proposes and approves them. Nobody — including us — can move funds by
            themselves once a group's rules are set.
          </p>
          <p>
            We built this because the informal economy that runs on chamas deserves
            infrastructure as serious as the money moving through it, without asking people to
            give up the group-based way they already save and invest.
          </p>
        </div>
      </div>
    </section>
  );
}

function WhatYouGetSection() {
  const items = [
    {
      icon: Users,
      title: "Group treasury",
      body: "Create a chama, invite members, and hold contributions in one shared vault instead of one person's account.",
    },
    {
      icon: Vote,
      title: "Proposals and votes",
      body: "Payouts, expenses, and investments go through a proposal your group votes on before anything moves.",
    },
    {
      icon: Smartphone,
      title: "M-Pesa in, stablecoin treasury",
      body: "Contribute the way you already do. Funds are held on-chain so every member can see the balance and history.",
    },
    {
      icon: TrendingUp,
      title: "A path into DeFi and trading",
      body: "Groups and individuals who want to go further can put treasury funds to work through on-chain markets, at whatever pace your group decides.",
      alt: "Trending growth icon",
    },
    {
      icon: Smartphone,
      title: "WhatsApp & SMS notifications",
      body: "Get secure OTP verification tokens and critical group notifications delivered straight to WhatsApp or SMS, built for volatile mobile networks.",
      alt: "Smartphone notifications icon",
    },
    {
      icon: ShieldCheck,
      title: "VASP-compliant infrastructure",
      body: "True non-custodial ownership that satisfies strict virtual asset regulations. Your secret keys stay encrypted client-side via your master passphrase.",
      alt: "Security shield icon",
    },
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-slate-900 to-slate-950">
      <SectionHeading
        eyebrow="What's inside"
        title="One platform for how your group actually saves and grows money"
      />
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(({ icon: Icon, title, body, alt }) => (
          <Card key={title} className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              <Icon className="w-8 h-8 text-purple-300 mb-4" aria-label={alt || title} role="img" />
              <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    { label: "Create a group", detail: "Set your rules: who's in, how often you contribute, how votes are decided." },
    { label: "Contribute", detail: "Members pay in through M-Pesa. Funds land in the group's on-chain treasury." },
    { label: "Propose", detail: "Anyone in the group can propose a payout, expense, or change to the rules." },
    { label: "Vote", detail: "The group votes according to the rules it set. No single approver." },
    { label: "Funds move", detail: "Only once a proposal passes does money leave the treasury — and it's logged." },
  ];

  return (
    <section className="py-20 px-6">
      <SectionHeading eyebrow="How it works" title="Five steps, no exceptions" />
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {steps.map((step, i) => (
            <div key={step.label} className="text-center">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-200 font-bold">
                {i + 1}
              </div>
              <div className="text-white font-semibold mb-2">{step.label}</div>
              <div className="text-gray-400 text-sm leading-relaxed">{step.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    {
      q: "Does anyone — including MtaaDAO — control our group's money?",
      a: "No. Your keys are generated entirely inside your browser and encrypted with a master passphrase known only to your members. We back up a blind, encrypted copy of this keystore so your group can never be locked out by device updates, but because our servers do not have your passphrase, we physically cannot access or move your funds.",
    },
    {
      q: "What happens if my phone clears its cache or I lose my device?",
      a: "Mobile operating systems frequently clean browser environments to preserve memory. If your local storage gets wiped out, you don't lose access. When you log back in and enter your master passphrase, your browser automatically pulls and decrypts your secure vault copy from our storage.",
    },
    {
      q: "What happens if someone posts a fake payment screenshot?",
      a: "Contributions are recorded on-chain when they clear through the API, not from a screenshot a member shares. The group's balance reflects what's actually in the treasury.",
    },
    {
      q: "Do I need to understand crypto or blockchain to use this?",
      a: "No. You contribute and receive payouts through familiar rails like M-Pesa. The on-chain treasury runs transparently underneath that experience.",
    },
    {
      q: "What is the MTAA token for?",
      a: "It's used for governance and for unlocking platform features as your group or account grows. You don't need it to start a basic chama.",
    },
    {
      q: "Is MtaaDAO regulated or insured?",
      a: "MtaaDAO is a non-custodial software platform for group treasury management and on-chain finance. It is not a bank, and funds are not insured the way a bank deposit would be. Read this carefully before treating it as a substitute for regulated financial services.",
    },
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-slate-950 to-slate-900">
      <SectionHeading eyebrow="Before you ask" title="Frequently asked questions" />
      <div className="max-w-3xl mx-auto space-y-6">
        {faqs.map((item) => (
          <div key={item.q} className="border-b border-white/10 pb-6">
            <div className="text-white font-semibold text-lg mb-2">{item.q}</div>
            <div className="text-gray-300 leading-relaxed">{item.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MtaaDAOLanding() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY || 0);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <Helmet>
        <title>MtaaDAO - Chama Treasury Management Made Simple | From Mtaa, For Mtaa</title>
        <meta name="description" content="MtaaDAO brings chama groups onto blockchain. Contribute via M-Pesa, vote on spending, track finances transparently. Non-custodial treasury for East African communities." />
        <meta property="og:title" content="MtaaDAO - Secure Chama Treasury Management" />
        <meta property="og:description" content="Contribute via M-Pesa. Vote on spending. Track every shilling on-chain. No single person controls your group's money." />
        <meta property="og:image" content="/mtaa_dao_logos/full_logo_light_banner.png" />
        <meta property="og:url" content="https://mtaadao.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MtaaDAO - Chama Treasury Management" />
        <meta name="twitter:description" content="Secure, transparent, group-controlled treasury. From Mtaa, For Mtaa." />
        <meta name="twitter:image" content="/mtaa_dao_logos/full_logo_light_banner.png" />
        <meta name="keywords" content="chama, DAO, treasury management, M-Pesa, blockchain, East Africa, Kenya, group savings" />
        <link rel="canonical" href="https://mtaadao.com" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden relative flex flex-col">
      <AnimatedBackground scrollY={scrollY} />

      <header className="w-full py-4 px-6 flex items-center justify-between bg-gradient-to-r from-purple-900/80 to-slate-900/80 backdrop-blur-md border-b border-white/10 z-40 sticky top-0">
        <div className="flex items-center space-x-3">
          <Logo variant="icon" size="sm" forceTheme="dark" />
          <span className="font-black text-xl text-white">Mtaa DAO</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/register">
            <Button variant="primary">Start free</Button>
          </Link>
          <Link to="/demo">
            <Button variant="ghost">Watch the demo</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative py-28 px-6">
          <div className="max-w-6xl mx-auto text-center">
            <DaoOfTheWeekBanner />
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
              Chama money shouldn't depend on one person's honesty.
            </h1>
            <p className="text-xl text-purple-200 max-w-2xl mx-auto mb-10">
              MtaaDAO holds your group's contributions in a shared treasury that only moves
              when your group votes. Contribute with M-Pesa. Track every shilling on-chain.
              Grow into DeFi when you're ready.
            </p>
            <div className="flex justify-center gap-4 mb-4">
              <Link to="/register">
                <Button size="lg" className="px-10">
                  Create your group
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/demo">
                <Button size="lg" variant="outline">
                  Watch the demo
                </Button>
              </Link>
            </div>
            <p className="text-sm text-gray-400">No crypto experience needed to get started.</p>
          </div>
        </section>

        <WhyWeExistSection />
        <WhatYouGetSection />
        <HowItWorksSection />
        <FAQSection />

        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-black text-white mb-4">
              Your group's money, your group's rules.
            </h2>
            <p className="text-purple-200 mb-8 text-lg">
              Set up a treasury your members can see and vote on — today.
            </p>
            <Link to="/register">
              <Button size="lg" className="px-10">
                Create your group
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="w-full py-8 px-6 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-t border-white/10 text-purple-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Logo variant="icon" size="sm" forceTheme="dark" />
              <span className="font-bold">© 2026 Mtaa DAO</span>
            </div>
            <nav className="flex flex-wrap gap-6 text-sm justify-center md:justify-end" aria-label="Footer navigation">
              <Link to="/success-stories" className="hover:text-white transition">Success Stories</Link>
              <Link to="/pricing" className="hover:text-white transition">Pricing</Link>
              <a href="/whitepaper.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                Whitepaper
              </a>
              <Link to="/blog" className="hover:text-white transition">Blog</Link>
              <Link to="/terms" className="hover:text-white transition">Terms</Link>
              <Link to="/privacy" className="hover:text-white transition">Privacy</Link>
            </nav>
          </div>
          <p className="text-xs text-purple-300/70 text-center md:text-left">
            MtaaDAO is a non-custodial technology platform for group treasury management and on-chain finance.
            It is not a bank and is not FDIC-insured or equivalent. Please review the whitepaper
            and terms before contributing funds.
          </p>
        </div>
      </footer>
      </div>
    </>
  );
}