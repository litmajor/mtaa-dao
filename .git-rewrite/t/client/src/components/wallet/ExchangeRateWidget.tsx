
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { ArrowUpDown, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ExchangeRate {
  pair: string;
  rate: number;
  change24h: number;
  lastUpdated: string;
}

interface ExchangeRateWidgetProps {
  onConvert?: (fromAmount: number, fromCurrency: string, toCurrency: string, toAmount: number) => void;
}

const SUPPORTED_CURRENCIES = [
  { code: 'CELO', name: 'Celo', symbol: 'CELO' },
  { code: 'cUSD', name: 'Celo Dollar', symbol: 'cUSD' },
  { code: 'cEUR', name: 'Celo Euro', symbol: 'cEUR' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' }
];

export default function ExchangeRateWidget({ onConvert }: ExchangeRateWidgetProps) {
  const [rates, setRates] = useState<Record<string, ExchangeRate>>({});
  const [loading, setLoading] = useState(true);
  const [fromAmount, setFromAmount] = useState('1');
  const [fromCurrency, setFromCurrency] = useState('CELO');
  const [toCurrency, setToCurrency] = useState('cUSD');
  const [toAmount, setToAmount] = useState('0');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchExchangeRates();
    const interval = setInterval(fetchExchangeRates, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    calculateConversion();
  }, [fromAmount, fromCurrency, toCurrency, rates]);

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/wallet/exchange-rates');
      const data = await response.json();
      setRates(data.rates || {});
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    }
    setLoading(false);
  };

  const calculateConversion = () => {
    const amount = parseFloat(fromAmount) || 0;
    if (amount === 0) {
      setToAmount('0');
      return;
    }

    let convertedAmount = amount;

    // Handle direct conversions
    if (fromCurrency === toCurrency) {
      convertedAmount = amount;
    } else {
      // Get exchange rate
      const rateKey = `${fromCurrency}-${toCurrency}`;
      const reverseRateKey = `${toCurrency}-${fromCurrency}`;
      
      if (rates[rateKey]) {
        convertedAmount = amount * rates[rateKey].rate;
      } else if (rates[reverseRateKey]) {
        convertedAmount = amount / rates[reverseRateKey].rate;
      } else {
        // Use USD as intermediate currency
        const fromToUSD = rates[`${fromCurrency}-USD`]?.rate || 1;
        const usdToTarget = rates[`USD-${toCurrency}`]?.rate || 1;
        convertedAmount = amount * fromToUSD * usdToTarget;
      }
    }

    setToAmount(convertedAmount.toFixed(6));
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromAmount(toAmount);
  };

  const handleConvert = () => {
    if (onConvert) {
      onConvert(
        parseFloat(fromAmount),
        fromCurrency,
        toCurrency,
        parseFloat(toAmount)
      );
    }
  };

  const getRateChange = (pair: string) => {
    const rate = rates[pair];
    if (!rate) return null;
    
    const isPositive = rate.change24h >= 0;
    return (
      <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span className="text-xs">{Math.abs(rate.change24h).toFixed(2)}%</span>
      </div>
    );
  };

  const formatCurrency = (amount: string, currency: string) => {
    const currencyData = SUPPORTED_CURRENCIES.find(c => c.code === currency);
    const symbol = currencyData?.symbol || currency;
    return `${symbol} ${amount}`;
  };

  return (
    <div className="space-y-4">
      {/* Exchange Rate Converter */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Currency Converter
              </CardTitle>
              <CardDescription>
                Real-time exchange rates updated every 30 seconds
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchExchangeRates}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <div className="space-y-2">
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                />
                <Select value={fromCurrency} onValueChange={setFromCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={swapCurrencies}
                className="rounded-full h-10 w-10 p-0"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <div className="space-y-2">
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="0.00"
                  value={toAmount}
                  readOnly
                  className="bg-gray-50"
                />
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {onConvert && (
            <Button 
              className="w-full" 
              onClick={handleConvert}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0}
            >
              Convert {formatCurrency(fromAmount, fromCurrency)} to {toCurrency}
            </Button>
          )}

          <div className="text-xs text-gray-500 text-center">
            Rates last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>

      {/* Live Rates Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Live Exchange Rates</CardTitle>
          <CardDescription>Current market rates with 24h change</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(rates).map(([pair, rate]) => (
                <div key={pair} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">{pair}</div>
                      <div className="text-lg font-bold">{rate.rate.toFixed(6)}</div>
                    </div>
                    {getRateChange(pair)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
