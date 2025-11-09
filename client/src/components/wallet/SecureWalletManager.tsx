
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Shield, Copy, Download, Eye, EyeOff, CheckCircle, AlertTriangle, Key, FileText } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface SecureWalletManagerProps {
  userId: string;
  onWalletCreated?: (data: any) => void;
}

export default function SecureWalletManager({ userId, onWalletCreated }: SecureWalletManagerProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [walletAddress, setWalletAddress] = useState('');
  const [step, setStep] = useState<'create' | 'backup' | 'complete'>('create');
  const { toast } = useToast();

  const handleCreateWallet = async () => {
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    if (password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/wallet-setup/create-wallet-mnemonic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password, wordCount })
      });

      const data = await response.json();
      
      if (data.success) {
        setMnemonic(data.wallet.mnemonic);
        setWalletAddress(data.wallet.address);
        setPrivateKey(data.wallet.privateKey || '');
        setStep('backup');
        toast({
          title: 'Wallet Created',
          description: 'Please backup your recovery phrase now!'
        });
        onWalletCreated?.(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create wallet',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverWallet = async () => {
    if (!mnemonic.trim() || !password) {
      toast({ title: 'Error', description: 'Recovery phrase and password are required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/wallet-setup/recover-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mnemonic: mnemonic.trim(), password })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({ title: 'Success', description: 'Wallet recovered successfully' });
        onWalletCreated?.(data);
        setStep('complete');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to recover wallet',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportPrivateKey = async () => {
    if (!privateKey.trim() || !password) {
      toast({ title: 'Error', description: 'Private key and password are required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/wallet-setup/import-private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, privateKey: privateKey.trim(), password })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({ title: 'Success', description: 'Wallet imported successfully' });
        onWalletCreated?.(data);
        setStep('complete');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import wallet',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmBackup = async () => {
    try {
      await fetch('/api/wallet-setup/backup-confirmed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      setBackedUp(true);
      setStep('complete');
      toast({ title: 'Success', description: 'Backup confirmed! Your wallet is ready.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to confirm backup', variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  const downloadMnemonic = () => {
    const content = `MtaaDAO Wallet Recovery Phrase
========================================
KEEP THIS SAFE AND NEVER SHARE WITH ANYONE!

Recovery Phrase (${wordCount} words):
${mnemonic}

Wallet Address:
${walletAddress}

Created: ${new Date().toISOString()}

⚠️ WARNING: Anyone with this recovery phrase can access your funds!
⚠️ Store this in a secure location offline.
⚠️ Never share it with anyone, including MtaaDAO support.
`;

    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `mtaadao-recovery-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPrivateKey = () => {
    const content = `MtaaDAO Wallet Private Key
========================================
KEEP THIS SAFE AND NEVER SHARE WITH ANYONE!

Private Key:
${privateKey}

Wallet Address:
${walletAddress}

Created: ${new Date().toISOString()}

⚠️ WARNING: Anyone with this private key can access your funds!
⚠️ Store this in a secure location offline.
⚠️ Never share it with anyone, including MtaaDAO support.
`;

    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `mtaadao-privatekey-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (step === 'backup' && mnemonic) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <Shield className="mx-auto h-12 w-12 text-yellow-600" />
          <h1 className="text-3xl font-bold">⚠️ Backup Your Wallet</h1>
          <p className="text-gray-600">This is the ONLY way to recover your wallet if you lose access</p>
        </div>

        <Card className="border-yellow-500 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recovery Phrase ({wordCount} words)
            </CardTitle>
            <CardDescription>
              Write down these words in order and store them safely offline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div className={`grid ${wordCount === 12 ? 'grid-cols-3' : 'grid-cols-4'} gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg ${!showMnemonic ? 'blur-sm' : ''}`}>
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border">
                    <span className="text-xs text-gray-500 font-mono w-6">{i + 1}.</span>
                    <span className="font-mono font-semibold">{word}</span>
                  </div>
                ))}
              </div>
              {!showMnemonic && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button onClick={() => setShowMnemonic(true)} variant="default" size="lg">
                    <Eye className="h-4 w-4 mr-2" />
                    Reveal Recovery Phrase
                  </Button>
                </div>
              )}
            </div>

            {showMnemonic && (
              <>
                <div className="flex gap-2">
                  <Button onClick={() => copyToClipboard(mnemonic, 'Recovery phrase')} variant="outline" className="flex-1">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button onClick={downloadMnemonic} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button onClick={() => setShowMnemonic(false)} variant="outline" className="flex-1">
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide
                  </Button>
                </div>

                {privateKey && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Private Key (Advanced)
                    </h3>
                    <div className="relative">
                      <Input
                        type={showPrivateKey ? 'text' : 'password'}
                        value={privateKey}
                        readOnly
                        className="font-mono text-xs pr-20"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                        >
                          {showPrivateKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(privateKey, 'Private key')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Button onClick={downloadPrivateKey} variant="outline" size="sm" className="mt-2 w-full">
                      <Download className="h-3 w-3 mr-2" />
                      Download Private Key
                    </Button>
                  </div>
                )}
              </>
            )}

            <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <strong>Critical Security Warning:</strong>
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  <li>Never share your recovery phrase or private key with anyone</li>
                  <li>MtaaDAO support will NEVER ask for your recovery phrase</li>
                  <li>Anyone with this information can steal all your funds</li>
                  <li>Store it offline in a secure location</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Your Wallet Address:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-gray-900 px-3 py-2 rounded text-xs font-mono break-all">
                  {walletAddress}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(walletAddress, 'Wallet address')}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <Button onClick={confirmBackup} className="w-full" size="lg" disabled={!showMnemonic}>
              <CheckCircle className="h-4 w-4 mr-2" />
              I've Backed Up My Recovery Phrase
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-green-500 border-2">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
            <h2 className="text-2xl font-bold">Wallet Setup Complete!</h2>
            <p className="text-gray-600">Your wallet is ready to use</p>
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Your Wallet Address:</p>
              <code className="bg-white dark:bg-gray-900 px-3 py-2 rounded text-xs font-mono break-all block">
                {walletAddress}
              </code>
            </div>
            <Button onClick={() => window.location.href = '/wallet'} className="w-full" size="lg">
              Go to Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <Shield className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="text-3xl font-bold">Secure Wallet Setup</h1>
        <p className="text-gray-600">Create or recover your MtaaDAO wallet with advanced security</p>
      </div>

      <Tabs defaultValue="create">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create">Create New</TabsTrigger>
          <TabsTrigger value="recover">Recover</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Wallet</CardTitle>
              <CardDescription>Generate a new wallet with a recovery phrase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Recovery Phrase Length</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={wordCount === 12 ? 'default' : 'outline'}
                    onClick={() => setWordCount(12)}
                    className="flex-1"
                  >
                    12 Words (Standard)
                  </Button>
                  <Button
                    variant={wordCount === 24 ? 'default' : 'outline'}
                    onClick={() => setWordCount(24)}
                    className="flex-1"
                  >
                    24 Words (More Secure)
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="password">Encryption Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a strong password"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                />
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Your wallet will be encrypted with this password. Choose a strong password you won't forget.
                </AlertDescription>
              </Alert>

              <Button onClick={handleCreateWallet} disabled={loading} className="w-full" size="lg">
                {loading ? 'Creating Wallet...' : 'Create Secure Wallet'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recover" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recover Wallet</CardTitle>
              <CardDescription>Enter your 12 or 24-word recovery phrase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="mnemonic-recover">Recovery Phrase</Label>
                <textarea
                  id="mnemonic-recover"
                  className="w-full min-h-[120px] p-3 border rounded-md"
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  placeholder="Enter your recovery phrase (12 or 24 words separated by spaces)"
                />
              </div>

              <div>
                <Label htmlFor="password-recover">New Encryption Password</Label>
                <Input
                  id="password-recover"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter encryption password"
                />
              </div>

              <Button onClick={handleRecoverWallet} disabled={loading} className="w-full" size="lg">
                {loading ? 'Recovering...' : 'Recover Wallet'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Private Key</CardTitle>
              <CardDescription>Import an existing wallet using a private key</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Note: Imported wallets don't have a recovery phrase. Keep your private key safe.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="private-key">Private Key</Label>
                <div className="relative">
                  <Input
                    id="private-key"
                    type={showPrivateKey ? 'text' : 'password'}
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="0x..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                  >
                    {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="password-import">Encryption Password</Label>
                <Input
                  id="password-import"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter encryption password"
                />
              </div>

              <Button onClick={handleImportPrivateKey} disabled={loading} className="w-full" size="lg">
                {loading ? 'Importing...' : 'Import Wallet'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
