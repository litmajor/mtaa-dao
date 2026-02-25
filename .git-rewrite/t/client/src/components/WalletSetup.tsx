
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Wallet, Plus, Upload, Eye, EyeOff } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface WalletSetupProps {
  userId: string;
  onWalletCreated?: (walletData: any) => void;
}

interface Asset {
  currency: string;
  initialAmount: number;
  monthlyGoal: number;
}

export default function WalletSetup({ userId, onWalletCreated }: WalletSetupProps) {
  const [loading, setLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [assets, setAssets] = useState<Asset[]>([
    { currency: 'cUSD', initialAmount: 0, monthlyGoal: 100 }
  ]);
  const { toast } = useToast();

  const supportedCurrencies = [
    { code: 'cUSD', name: 'Celo Dollar', symbol: '$' },
    { code: 'CELO', name: 'Celo', symbol: 'CELO' },
    { code: 'cEUR', name: 'Celo Euro', symbol: '€' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' }
  ];

  const createNewWallet = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/wallet-setup/create-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          currency: assets[0]?.currency || 'cUSD',
          initialGoal: assets[0]?.monthlyGoal || 0
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Wallet Created Successfully",
          description: `Your new wallet address: ${data.wallet.address.slice(0, 8)}...`
        });
        
        // Initialize additional assets if any
        if (assets.length > 1) {
          await initializeAssets(data.wallet.address);
        }
        
        onWalletCreated?.(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create wallet',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const importWallet = async () => {
    if (!privateKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a private key",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/wallet-setup/import-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          privateKey: privateKey.trim(),
          currency: assets[0]?.currency || 'cUSD'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Wallet Imported Successfully",
          description: `Wallet address: ${data.wallet.address.slice(0, 8)}...`
        });
        
        // Initialize additional assets if any
        if (assets.length > 1) {
          await initializeAssets(data.wallet.address);
        }
        
        onWalletCreated?.(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to import wallet',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeAssets = async (walletAddress?: string) => {
    try {
      const response = await fetch('/api/wallet-setup/initialize-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          assets: assets.slice(1) // Skip first asset as it's already created
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Assets Initialized",
          description: `${data.summary.newVaults} new vaults created`
        });
      }
    } catch (error) {
      console.error('Failed to initialize additional assets:', error);
    }
  };

  const addAsset = () => {
    setAssets([...assets, { currency: 'cUSD', initialAmount: 0, monthlyGoal: 0 }]);
  };

  const removeAsset = (index: number) => {
    if (assets.length > 1) {
      setAssets(assets.filter((_, i) => i !== index));
    }
  };

  const updateAsset = (index: number, field: keyof Asset, value: string | number) => {
    const updated = [...assets];
    updated[index] = { ...updated[index], [field]: value };
    setAssets(updated);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <Wallet className="mx-auto h-12 w-12 text-blue-600" />
        <h1 className="text-3xl font-bold">Setup Your Mtaa Wallet</h1>
        <p className="text-gray-600">Create a new wallet or import an existing one to get started</p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create New Wallet</TabsTrigger>
          <TabsTrigger value="import">Import Existing Wallet</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Wallet</CardTitle>
              <CardDescription>
                Generate a new wallet with multiple currency vaults
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Asset Vaults</h3>
                  <Button onClick={addAsset} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Asset
                  </Button>
                </div>
                
                {assets.map((asset, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div>
                        <Label htmlFor={`currency-${index}`}>Currency</Label>
                        <select
                          id={`currency-${index}`}
                          className="w-full mt-1 p-2 border rounded-md"
                          value={asset.currency}
                          onChange={(e) => updateAsset(index, 'currency', e.target.value)}
                          aria-label="Select currency"
                        >
                          {supportedCurrencies.map(curr => (
                            <option key={curr.code} value={curr.code}>
                              {curr.name} ({curr.code})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <Label htmlFor={`initial-${index}`}>Initial Amount</Label>
                        <Input
                          id={`initial-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={asset.initialAmount}
                          onChange={(e) => updateAsset(index, 'initialAmount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`goal-${index}`}>Monthly Goal</Label>
                        <Input
                          id={`goal-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={asset.monthlyGoal}
                          onChange={(e) => updateAsset(index, 'monthlyGoal', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div className="flex justify-end">
                        {assets.length > 1 && (
                          <Button
                            onClick={() => removeAsset(index)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        )}
                        {index === 0 && (
                          <Badge variant="secondary">Primary</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              <Alert>
                <AlertDescription>
                  Your private key will be generated securely. Make sure to back it up safely as it cannot be recovered if lost.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={createNewWallet} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? 'Creating Wallet...' : 'Create Wallet & Initialize Vaults'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Existing Wallet</CardTitle>
              <CardDescription>
                Import your wallet using your private key
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="private-key">Private Key</Label>
                <div className="relative">
                  <Input
                    id="private-key"
                    type={showPrivateKey ? "text" : "password"}
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="Enter your private key (0x...)"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Alert>
                <AlertDescription>
                  Your private key is encrypted and stored securely. Never share your private key with anyone.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={importWallet} 
                disabled={loading || !privateKey.trim()}
                className="w-full"
                size="lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'Importing Wallet...' : 'Import Wallet'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
