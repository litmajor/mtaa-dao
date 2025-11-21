import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Shield, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";

const plans = [
  {
    name: "Free",
    description: "Perfect for getting started",
    priceKES: "0",
    priceUSD: "0",
    priceEUR: "0",
    features: [
      "Up to 20 members",
      "Basic treasury management",
      "Up to 5 proposals/month",
      "Community chat",
      "Basic analytics",
      "Email support"
    ],
    limitations: [
      "Limited to 1 DAO",
      "Basic AI insights",
      "Standard security features"
    ],
    recommended: false
  },
  {
    name: "Premium",
    description: "For growing communities",
    priceKES: "1,500",
    priceUSD: "9.99",
    priceEUR: "8.99",
    features: [
      "Unlimited members",
      "Advanced treasury management",
      "Unlimited proposals",
      "Priority chat support",
      "Advanced analytics & insights",
      "Multi-chain support",
      "Morio AI-powered assistance",
      "Custom branding",
      "Investment pools access",
      "NFT marketplace access",
      "Advanced security features",
      "24/7 priority support",
      "API access"
    ],
    limitations: [],
    recommended: true
  }
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleSelectPlan = (planName: string) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (planName === "Premium") {
      navigate("/subscription");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4" data-testid="pricing-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent" data-testid="heading-pricing">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Empower your community with transparent governance and AI-powered tools.
            Start free or unlock premium features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.recommended
                  ? "border-2 border-purple-500 shadow-xl"
                  : "border-gray-200 dark:border-gray-700"
              }`}
              data-testid={`plan-${plan.name.toLowerCase()}`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-1">
                    <Sparkles className="w-3 h-3 mr-1 inline" />
                    Recommended
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-2xl flex items-center gap-2">
                  {plan.name === "Premium" ? (
                    <Zap className="w-6 h-6 text-purple-600" />
                  ) : (
                    <Shield className="w-6 h-6 text-gray-600" />
                  )}
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                <div className="border-b pb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold">KES {plan.priceKES}</span>
                    {plan.name === "Premium" && (
                      <span className="text-gray-500">/month</span>
                    )}
                  </div>
                  {plan.name === "Premium" && (
                    <div className="text-sm text-gray-500 space-y-1">
                      <div>USD ${plan.priceUSD}/month</div>
                      <div>EUR €{plan.priceEUR}/month</div>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                    What's included:
                  </h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={`w-full ${
                    plan.recommended
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                  data-testid={`button-select-${plan.name.toLowerCase()}`}
                >
                  {plan.name === "Free" ? "Get Started Free" : "Upgrade to Premium"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Transaction Limits Info */}
        <div className="mt-16 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Transaction Limits & Features
              </CardTitle>
              <CardDescription>
                Understand the limits and features for each plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Free Plan Limits</h4>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li>• 1 DAO maximum</li>
                    <li>• 20 members per DAO</li>
                    <li>• 5 proposals per month</li>
                    <li>• Basic AI insights (10 queries/month)</li>
                    <li>• Single-chain support (Ethereum)</li>
                    <li>• Standard transaction speed</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Premium Plan Features</h4>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li>• Unlimited DAOs</li>
                    <li>• Unlimited members</li>
                    <li>• Unlimited proposals</li>
                    <li>• Advanced AI insights (unlimited)</li>
                    <li>• Multi-chain support (ETH, BSC, Polygon, etc.)</li>
                    <li>• Priority transaction processing</li>
                    <li>• Investment pools & vaults</li>
                    <li>• NFT marketplace access</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Have questions?{" "}
            <button
              onClick={() => navigate("/support")}
              className="text-purple-600 hover:text-purple-700 font-medium"
              data-testid="button-contact-support"
            >
              Contact our support team
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
