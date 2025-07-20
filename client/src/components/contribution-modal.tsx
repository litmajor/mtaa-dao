import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { DollarSign, Wallet, Shield, TrendingUp, Sparkles, Info } from "lucide-react";

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Currency = "cUSD" | "USDC" | "ETH";

export default function ContributionModal({ isOpen, onClose }: ContributionModalProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("cUSD");
  const [purpose, setPurpose] = useState("general");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState("");

  const exchangeRates: Record<Currency, number> = {
    cUSD: 130,
    USDC: 132,
    ETH: 450000
  };

  const purposeIcons = {
    general: "🌟",
    emergency: "🚨",
    education: "📚",
    infrastructure: "🏗️"
  };

  const purposeColors = {
    general: "from-emerald-500 to-teal-600",
    emergency: "from-red-500 to-orange-600",
    education: "from-blue-500 to-indigo-600",
    infrastructure: "from-purple-500 to-pink-600"
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }
    
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      onClose();
      setAmount("");
      setCurrency("cUSD");
      setPurpose("general");
      setIsAnonymous(false);
    }, 2000);
  };

  const kesAmount = amount ? (parseFloat(amount) * exchangeRates[currency]).toLocaleString() : "0";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 bg-transparent border-0 shadow-none">
        <div className="relative">
          {/* Animated background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 via-blue-500/20 to-purple-600/20 rounded-3xl blur-2xl animate-pulse"></div>
          
          {/* Main modal container */}
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-emerald-500/20 overflow-hidden">
            {/* Premium header with gradient */}
            <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-600 p-8 text-white">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 to-blue-600/30"></div>
              <div className="relative z-10">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Wallet className="w-6 h-6" />
                    </div>
                    Make a Contribution
                  </DialogTitle>
                  <p className="text-emerald-100 mt-2">Support your community with a secure contribution</p>
                </DialogHeader>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/20 rounded-full translate-y-12 -translate-x-12"></div>
            </div>

            {/* Form content */}
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Amount input with enhanced styling */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Contribution Amount
                  </Label>
                  <div className="relative group">
                    <div className={`absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-300 ${focusedField === 'amount' ? 'opacity-30' : ''}`}></div>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onFocus={() => setFocusedField('amount')}
                        onBlur={() => setFocusedField('')}
                        className="h-16 text-2xl font-bold pr-24 pl-6 border-2 border-gray-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-300"
                        step="0.01"
                        min="0"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                          <SelectTrigger className="w-20 h-8 border-none bg-gray-100 rounded-xl text-sm font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cUSD">cUSD</SelectItem>
                            <SelectItem value="USDC">USDC</SelectItem>
                            <SelectItem value="ETH">ETH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  {amount && (
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      ≈ KES {kesAmount}
                    </div>
                  )}
                </div>

                {/* Purpose selection with enhanced cards */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Contribution Purpose
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(purposeIcons).map(([key, icon]) => (
                      <div
                        key={key}
                        onClick={() => setPurpose(key)}
                        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                          purpose === key 
                            ? 'border-emerald-500 bg-emerald-50' 
                            : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-r ${purposeColors[key as keyof typeof purposeColors]} rounded-xl opacity-0 ${purpose === key ? 'opacity-10' : ''} transition-opacity duration-300`}></div>
                        <div className="relative flex items-center gap-3">
                          <span className="text-2xl">{icon}</span>
                          <div>
                            <p className="font-medium text-gray-900 capitalize">{key.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-500">
                              {key === 'general' && 'Community development'}
                              {key === 'emergency' && 'Crisis response'}
                              {key === 'education' && 'Learning initiatives'}
                              {key === 'infrastructure' && 'Community building'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anonymous contribution toggle */}
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                  <Checkbox
                    id="anonymous"
                    checked={isAnonymous}
                    onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="anonymous" className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Anonymous Contribution
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">Your identity will be kept private</p>
                  </div>
                </div>

                {/* Transaction details card */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Transaction Details</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Exchange Rate</span>
                      <span className="text-sm font-medium text-gray-900">1 {currency} = {exchangeRates[currency]} KES</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Network Fee</span>
                      <span className="text-sm font-medium text-gray-900">~$0.01</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-900">Total Amount</span>
                      <span className="text-sm font-bold text-emerald-600">{amount || '0'} {currency}</span>
                    </div>
                  </div>
                </div>

                {/* Enhanced submit button */}
                <Button
                  type="submit"
                  className="w-full h-14 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing Contribution...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5" />
                      <span>Contribute {amount || '0'} {currency}</span>
                    </div>
                  )}
                </Button>
              </form>

              {/* Trust indicators */}
              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Secure Transaction
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Blockchain Verified
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Instant Processing
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}