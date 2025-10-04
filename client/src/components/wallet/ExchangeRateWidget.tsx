import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { ArrowUpDown, TrendingUp, TrendingDown, RefreshCw, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Alert, AlertDescription } from '../ui/alert';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useBalance } from 'wagmi'; // For wallet integration

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
  { code: 'cREAL', name: 'Celo Real', symbol: 'cREAL' }, // 2025 addition
  { code: 'USDC', name: 'USD Coin (Native)', symbol: 'USDC' },
  { code: 'USDT', name: 'Tether (Native)', symbol: 'USDT' },
  { code: 'VEUR', name: 'VNX Euro', symbol: 'VEUR' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' }
];

export default function ExchangeRateWidget({ onConvert }: ExchangeRateWidgetProps) {
  const [fromAmount, setFromAmount] = useState('1');
  const [fromCurrency, setFromCurrency] = useState('CELO');
  const [toCurrency, setToCurrency] = useState('cUSD');
  const [toAmount, setToAmount] = useState('0');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { address } = useAccount();
  const { data: balance } = useBalance({ address, token: fromCurrency === 'CELO' ? undefined : '0x...' }); // Token address for non-CELO

  const { data: rates = {}, isLoading, error, refetch } = useQuery<Record<string, ExchangeRate>>({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      const response = await fetch('/api/wallet/exchange-rates');
      if (!response.ok) throw new Error('Failed to fetch rates');
      const data = await response.json();
      setLastRefresh(new Date());
      return data.rates || {};
    },
    staleTime: 30000, // 30s cache
    retry: 3,
  });

  useEffect(() => {
    calculateConversion();
  }, [fromAmount, fromCurrency, toCurrency, rates]);

  const calculateConversion = () => {
    const amount = parseFloat(fromAmount) || 0;
    if (amount === 0) {
      setToAmount('0');
      return;
    }

    let convertedAmount = amount;

    if (fromCurrency === toCurrency) {
      convertedAmount = amount;
    } else {
      const rateKey = `${fromCurrency}-${toCurrency}`;
      const reverseRateKey = `${toCurrency}-${fromCurrency}`;
      
      if (rates[rateKey]) {
        convertedAmount = amount * rates[rateKey].rate;
      } else if (rates[reverseRateKey]) {
        convertedAmount = amount / rates[reverseRateKey].rate;
      } else {
        const fromToUSD = rates[`${fromCurrency}-USD`]?.rate || 1;
        const usdToTarget = rates[`USD-${toCurrency}`]?.rate || 1;
        convertedAmount = amount * fromToUSD * usdToTarget;
      }
    }

    setToAmount(convertedAmount.toFixed(6).replace(/\.?0+$/, '')); // Trim trailing zeros
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

  const walletBalance = useMemo(() => balance?.formatted || 'N/A', [balance]);

  if (error) return (
    <Alert variant="destructive">
      <AlertDescription>Error: {(error as Error).message}. <Button variant="link" onClick={() => refetch()}>Retry</Button></AlertDescription>
    </Alert>
  );

  return (
    <div className="space-y-4">
      {/* Converter */}
      <Card className="dark:bg-gray-800">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Currency Converter
              </CardTitle>
              <CardDescription>
                Real-time rates (2025 Celo L2: ~$0.001/tx gas)
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  aria-label="Refresh rates"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">From <TooltipTrigger><Info className="h-3 w-3 text-gray-500" /></TooltipTrigger><TooltipContent>Wallet balance: {walletBalance} {fromCurrency}</TooltipContent></label>
              <div className="space-y-2">
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                />
                <Select value={fromCurrency} onValueChange={setFromCurrency}>
                  <SelectTrigger aria-label="Select from currency">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={swapCurrencies}
                    className="rounded-full h-10 w-10 p-0"
                    aria-label="Swap currencies"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Swap</TooltipContent>
              </Tooltip>
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
                  className="bg-gray-50 dark:bg-gray-700"
                />
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger aria-label="Select to currency">
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
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600" 
              onClick={handleConvert}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0 || isLoading}
            >
              Convert {formatCurrency(fromAmount, fromCurrency)} to {toCurrency}
            </Button>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-1">
            Rates last updated: {lastRefresh.toLocaleTimeString()} <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger><TooltipContent>Auto-refreshes every 30s</TooltipContent>
          </div>
        </CardContent>
      </Card>

      {/* Rates Grid */}
      <Card className="dark:bg-gray-800">
        <CardHeader>
          <CardTitle>Live Exchange Rates</CardTitle>
          <CardDescription>Market rates with 24h change (Celo L2 optimized)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded" />
              ))}
            </div>
          ) : Object.keys(rates).length === 0 ? (
            <Alert><AlertDescription>No rates available. Try refreshing.</AlertDescription></Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(rates).map(([pair, rate]) => (
                <div key={pair} className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:border-gray-700">
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