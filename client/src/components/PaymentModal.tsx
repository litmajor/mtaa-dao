import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Building, Zap, DollarSign, Lock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

// Estimate gas fee using backend API
const estimateGasFee = async (currency: string, amount: string) => {
  try {
    const res = await fetch(`/api/payments/estimate-gas?currency=${currency}&amount=${amount}`);
    const data = await res.json();
    return data.gasFee || '0';
  } catch {
    return '0';
  }
};

const PROVIDERS = [
  { key: 'mpesa', label: 'M-Pesa', icon: Smartphone, color: 'from-green-500 to-green-600', description: 'Mobile money transfer' },
  { key: 'crypto', label: 'Crypto', icon: Zap, color: 'from-purple-500 to-purple-600', description: 'Cryptocurrency payment' },
  { key: 'stripe', label: 'Stripe', icon: CreditCard, color: 'from-blue-500 to-blue-600', description: 'Credit & debit cards' },
  { key: 'paystack', label: 'Paystack', icon: CreditCard, color: 'from-teal-500 to-teal-600', description: 'African payment gateway' },
  { key: 'flutterwave', label: 'Flutterwave', icon: CreditCard, color: 'from-orange-500 to-orange-600', description: 'Global payment platform' },
  { key: 'coinbase', label: 'Coinbase Commerce', icon: DollarSign, color: 'from-blue-600 to-blue-700', description: 'Crypto commerce' },
  { key: 'transak', label: 'Transak', icon: Building, color: 'from-indigo-500 to-indigo-600', description: 'Fiat to crypto' },
  { key: 'ramp', label: 'Ramp', icon: Zap, color: 'from-cyan-500 to-cyan-600', description: 'Instant crypto purchase' },
  { key: 'kotanipay', label: 'Kotani Pay', icon: Smartphone, color: 'from-emerald-500 to-emerald-600', description: 'USSD to crypto' },
  { key: 'bank', label: 'Bank Transfer', icon: Building, color: 'from-gray-500 to-gray-600', description: 'Direct bank transfer' },
];

const CURRENCIES = [
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'cUSD', name: 'Celo Dollar', symbol: 'cUSD' },
  { code: 'USDC', name: 'USD Coin', symbol: 'USDC' },
  { code: 'ETH', name: 'Ethereum', symbol: 'ETH' },
  { code: 'CELO', name: 'Celo', symbol: 'CELO' },
];

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
}

function PaymentModal({ open, onClose }: PaymentModalProps) {
  const [provider, setProvider] = useState('mpesa');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('KES');
  const [description, setDescription] = useState('');
  const [gasFee, setGasFee] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const [step, setStep] = useState(1);

  const selectedProvider = PROVIDERS.find(p => p.key === provider);
  const selectedCurrency = CURRENCIES.find(c => c.code === currency);

  // Estimate gas fee for crypto payments
  useEffect(() => {
    const isCrypto = provider === 'crypto' || ['cUSD', 'USDC', 'ETH', 'CELO'].includes(currency);
    if (!isCrypto || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setGasFee(null);
      return;
    }
    let cancelled = false;
    async function estimate() {
      setEstimating(true);
      let fee = '0';
      try {
        fee = await estimateGasFee(currency, amount);
      } catch (e) {
        fee = '0';
      }
      if (!cancelled) setGasFee(fee);
      setEstimating(false);
    }
    estimate();
    return () => { cancelled = true; };
  }, [provider, currency, amount]);

  const handleSubmit = async () => {
    if (!amount || (provider === 'mpesa' && !phone) || (provider === 'kotanipay' && !phone)) return;
    setLoading(true);
    setStatus('');
    setStep(2);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          amount,
          currency,
          phone,
          description,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('Payment initiated successfully!');
        setStep(3);
      } else {
        setStatus(data.error || 'Payment failed. Please try again.');
        setStep(1);
      }
    } catch (err) {
      setStatus('Error: Network error occurred');
      setStep(1);
    }
    setLoading(false);
  };

  const formatAmount = (amt: string) => {
    if (!amt || isNaN(Number(amt))) return '';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amt));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 rounded-t-3xl p-8 text-white">
          <div className="absolute inset-0 bg-black bg-opacity-10 rounded-t-3xl"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">Secure Payment</h2>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors duration-200 flex items-center justify-center"
              >
                <span className="text-lg">×</span>
              </button>
            </div>
            <p className="text-white text-opacity-90 text-sm">Complete your transaction securely</p>
          </div>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Payment Method</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProviders(!showProviders)}
                    className="w-full bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-4 flex items-center justify-between hover:from-gray-100 hover:to-gray-200 transition-all duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${selectedProvider?.color} flex items-center justify-center`}>
                        {selectedProvider?.icon && React.createElement(selectedProvider.icon, { className: "w-5 h-5 text-white" })}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-gray-800">{selectedProvider?.label}</div>
                        <div className="text-sm text-gray-500">{selectedProvider?.description}</div>
                      </div>
                    </div>
                    <div className={`transform transition-transform duration-200 ${showProviders ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {showProviders && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-10 max-h-64 overflow-y-auto">
                      {PROVIDERS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            setProvider(p.key);
                            setShowProviders(false);
                          }}
                          className="w-full p-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl"
                        >
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${p.color} flex items-center justify-center flex-shrink-0`}>
                            {React.createElement(p.icon, { className: "w-5 h-5 text-white" })}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-800">{p.label}</div>
                            <div className="text-sm text-gray-500">{p.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="currency-select" className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
                  <select
                    id="currency-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.symbol}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount Display */}
              {amount && !isNaN(Number(amount)) && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border border-blue-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">
                      {selectedCurrency?.symbol} {formatAmount(amount)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{selectedCurrency?.name}</div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Payment purpose (optional)"
                />
              </div>

              {/* Phone Number */}
              {(provider === 'mpesa' || provider === 'kotanipay') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="+254 700 000 000"
                    required
                  />
                </div>
              )}

              {/* Gas Fee */}
              {((provider === 'crypto') || ['cUSD', 'USDC', 'ETH', 'CELO'].includes(currency)) && amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    <div className="text-sm font-medium text-amber-800">
                      {estimating ? (
                        <div className="flex items-center space-x-2">
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Estimating gas fee...</span>
                        </div>
                      ) : gasFee ? (
                        `Gas Fee: ${gasFee} ${currency === 'CELO' ? 'CELO' : currency}`
                      ) : (
                        'Unable to estimate gas fee'
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>Pay Securely</span>
                  </>
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader className="w-10 h-10 text-white animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Processing Payment</h3>
              <p className="text-gray-600">Please wait while we process your transaction...</p>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Payment Successful!</h3>
              <p className="text-gray-600 mb-6">Your transaction has been processed successfully.</p>
              <button
                onClick={onClose}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-8 rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
              >
                Continue
              </button>
            </div>
          )}

          {/* Status Messages */}
          {status && step === 1 && (
            <div className={`mt-6 p-4 rounded-2xl flex items-center space-x-2 ${
              status.includes('success') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {status.includes('success') ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                status.includes('success') ? 'text-green-800' : 'text-red-800'
              }`}>
                {status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Demo App Component
export default function App() {
  const [modalOpen, setModalOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-blue-50 to-purple-100 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Premium Payment Modal Demo</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-2xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
        >
          Open Payment Modal
        </button>
      </div>
      
      <PaymentModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}