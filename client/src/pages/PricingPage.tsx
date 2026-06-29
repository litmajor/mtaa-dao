import { Check, ArrowRight, Bot, Layers, Shield, Sparkles, Users, Vault, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { SUBSCRIPTION_TIER_CONFIG } from "@/config/daoTypes.config";

const tierIconMap = {
  free: <Users className="w-8 h-8 text-white" />,
  growth: <Bot className="w-8 h-8 text-white" />,
  professional: <Sparkles className="w-8 h-8 text-white" />,
};

const tierColorMap = {
  free: "from-slate-600 to-slate-800",
  growth: "from-orange-500 via-rose-500 to-indigo-600",
  professional: "from-emerald-600 to-cyan-700",
};

const EDUCATION_POINTS = [
  {
    title: "DAO Types are the chassis",
    description: "Choose the Group structure once when you spawn the DAO. This covers the governance setup, treasury model, and initial smart-contract configuration.",
    icon: <Layers className="w-6 h-6 text-orange-600" />
  },
  {
    title: "Tiers are the engine",
    description: "Pick a monthly subscription tier to unlock automation, AI, analytics, scaling limits, and support on top of that DAO structure.",
    icon: <Zap className="w-6 h-6 text-emerald-600" />
  },
  {
    title: "Spawn fee and subscription are separate",
    description: "The spawn fee is paid once for the DAO type. Subscription tiers are paid monthly for advanced operating capabilities.",
    icon: <Vault className="w-6 h-6 text-indigo-600" />
  }
];

export default function PricingPage() {
  const navigate = useNavigate();

  const handleSelectPlan = (tierName: string) => {
    if (tierName === "Free") {
      navigate("/create-dao");
      return;
    }

    navigate("/subscription");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-emerald-50 py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-orange-500 via-rose-500 to-emerald-600 bg-clip-text text-transparent">
              DAO Pricing That Matches How You Operate
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Pay once for the DAO structure, then choose the monthly tier that powers its automation, AI, and scale.
            </p>
          </motion.div>
        </div>

        <section className="grid md:grid-cols-3 gap-4">
          {EDUCATION_POINTS.map((point) => (
            <div key={point.title} className="bg-white/90 border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
                {point.icon}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{point.title}</h2>
              <p className="text-sm text-gray-600 leading-6">{point.description}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {SUBSCRIPTION_TIER_CONFIG.map((tier, index) => {
            const priceDisplay = tier.priceKES === 0 ? "KES 0" : `KES ${tier.priceKES.toLocaleString()}`;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="relative"
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg z-10">
                    Recommended
                  </div>
                )}

                <div className={`bg-white/95 rounded-2xl p-8 shadow-xl border-2 h-full flex flex-col ${
                  tier.popular ? "border-orange-300" : "border-gray-200"
                }`}>
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${tierColorMap[tier.key]} flex items-center justify-center shadow-lg`}>
                      {tierIconMap[tier.key]}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                    <div className="mt-4">
                      <span className="text-4xl font-black text-gray-900">{priceDisplay}</span>
                      <span className="text-gray-500 ml-1">/month</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 text-center leading-6 mb-6">{tier.description}</p>

                  <div className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSelectPlan(tier.name)}
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all ${
                      tier.popular
                        ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg hover:from-orange-600 hover:to-rose-600"
                        : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight className="w-5 h-5 inline ml-2" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </section>

        <section className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
          <div className="flex items-start gap-4">
            <Shield className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold mb-2">How upgrades work</h2>
              <p className="text-gray-600 leading-7">
                DAO admins upgrade from the subscription management screen. The wallet transaction calls the on-chain subscription manager first, then the app syncs the confirmed tier to the backend for immediate UI access.
              </p>
            </div>
          </div>
        </section>

        <div className="text-center">
          <p className="text-gray-600">
            Questions? Contact <a href="mailto:pricing@mtaadao.com" className="text-orange-600 font-semibold">pricing@mtaadao.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
