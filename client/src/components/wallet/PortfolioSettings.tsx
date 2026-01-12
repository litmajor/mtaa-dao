import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, DollarSign, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CurrencyPreference {
  primaryCurrency: string;
  secondaryCurrency: string;
}

interface PortfolioSettingsProps {
  onSettingsUpdate?: (preferences: CurrencyPreference) => void;
}

const SUPPORTED_CURRENCIES = [
  { code: 'CELO', name: 'Celo', type: 'Crypto' },
  { code: 'cUSD', name: 'Celo Dollar (cUSD)', type: 'Stablecoin' },
  { code: 'cEUR', name: 'Celo Euro (cEUR)', type: 'Stablecoin' },
  { code: 'cREAL', name: 'Celo Real (cREAL)', type: 'Stablecoin' },
  { code: 'USDC', name: 'USD Coin (USDC)', type: 'Stablecoin' },
  { code: 'USDT', name: 'Tether (USDT)', type: 'Stablecoin' },
  { code: 'USD', name: 'US Dollar (USD)', type: 'Fiat' },
  { code: 'EUR', name: 'Euro (EUR)', type: 'Fiat' },
  { code: 'KES', name: 'Kenyan Shilling (KES)', type: 'Fiat' },
  { code: 'GHS', name: 'Ghanaian Cedi (GHS)', type: 'Fiat' },
  { code: 'NGN', name: 'Nigerian Naira (NGN)', type: 'Fiat' }
];

export function PortfolioSettings({ onSettingsUpdate }: PortfolioSettingsProps) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery<CurrencyPreference>({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/user-preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      const data = await response.json();
      return {
        primaryCurrency: data.data.primaryCurrency || 'cUSD',
        secondaryCurrency: data.data.secondaryCurrency || 'KES'
      };
    },
    staleTime: Infinity
  });

  const [localPreferences, setLocalPreferences] = useState<CurrencyPreference>({
    primaryCurrency: 'cUSD',
    secondaryCurrency: 'KES'
  });

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (newPreferences: CurrencyPreference) => {
      const response = await fetch('/api/user-preferences/currency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryCurrency: newPreferences.primaryCurrency,
          secondaryCurrency: newPreferences.secondaryCurrency
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update preferences');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      setSuccessMessage('Currency preferences updated successfully!');
      setErrorMessage(null);
      
      if (onSettingsUpdate) {
        onSettingsUpdate(localPreferences);
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Failed to update preferences');
      setSuccessMessage(null);
    }
  });

  const handlePrimaryChange = (value: string) => {
    const newPreferences = {
      ...localPreferences,
      primaryCurrency: value
    };
    setLocalPreferences(newPreferences);
  };

  const handleSecondaryChange = (value: string) => {
    const newPreferences = {
      ...localPreferences,
      secondaryCurrency: value
    };
    setLocalPreferences(newPreferences);
  };

  const handleSave = () => {
    // Validation: don't allow same currency for both
    if (localPreferences.primaryCurrency === localPreferences.secondaryCurrency) {
      setErrorMessage('Primary and secondary currencies must be different');
      return;
    }

    updateMutation.mutate(localPreferences);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Portfolio Display Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            <span className="ml-2">Loading settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Portfolio Display Settings
        </CardTitle>
        <CardDescription>
          Select your preferred currencies for portfolio balance display. You'll see balances in two currencies side-by-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Alert */}
        {successMessage && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Primary Currency Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold">
            Primary Currency (Native Display)
          </label>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            This will be your main balance display currency
          </p>
          <Select value={localPreferences.primaryCurrency} onValueChange={handlePrimaryChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  <div className="flex items-center gap-2">
                    <span>{currency.name}</span>
                    <Badge variant="outline" className="text-xs">{currency.type}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Secondary Currency Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold">
            Secondary Currency (Conversion Display)
          </label>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Your balance will also be shown converted to this currency in real-time
          </p>
          <Select value={localPreferences.secondaryCurrency} onValueChange={handleSecondaryChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.filter(
                (currency) => currency.code !== localPreferences.primaryCurrency
              ).map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  <div className="flex items-center gap-2">
                    <span>{currency.name}</span>
                    <Badge variant="outline" className="text-xs">{currency.type}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Current Selection Summary */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-semibold mb-2">Your Portfolio Will Display:</p>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-blue-600">
              {localPreferences.primaryCurrency}
            </Badge>
            <span className="text-gray-600 dark:text-gray-400">and</span>
            <Badge variant="secondary">
              {localPreferences.secondaryCurrency}
            </Badge>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Real-time conversion rates update every 30 seconds
          </p>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={
            updateMutation.isPending ||
            (preferences?.primaryCurrency === localPreferences.primaryCurrency &&
              preferences?.secondaryCurrency === localPreferences.secondaryCurrency)
          }
          className="w-full"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Currency Preferences'
          )}
        </Button>

        {/* Info Section */}
        <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-900/20 rounded border border-gray-200 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            💡 How This Works:
          </p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Your primary currency shows your main balance display</li>
            <li>• Secondary currency shows real-time converted amount</li>
            <li>• Both are visible on portfolio cards and charts</li>
            <li>• Rates update automatically every 30 seconds</li>
            <li>• Works for all asset types (tokens, pools, vaults, staking)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default PortfolioSettings;
