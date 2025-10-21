
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Shield, Copy, Download, Eye, EyeOff, CheckCircle } from 'lucide-react';
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
      toast({ title: 'Success', description: 'Backup confirmed' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to confirm backup', variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  const downloadMnemonic = () => {
    const element = document.createElement('a');
    const file = new Blob([mnemonic], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `mtaadao-recovery-phrase-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <Shield className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="text-3xl font-bold">Secure Wallet Setup</h1>
        <p className="text-gray-600">Create or recover your MtaaDAO wallet with advanced security</p>
      </div>

      {mnemonic && !backedUp ? (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Backup Your Recovery Phrase
            </CardTitle>
            <CardDescription>
              Write down these {wordCount} words in order and store them safely. You'll need them to recover your wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div className={`grid grid-cols-${wordCount === 12 ? '3' : '4'} gap-2 p-4 bg-gray-50 rounded-lg ${!showMnemonic ? 'blur-sm' : ''}`}>
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{i + 1}.</span>
                    <span className="font-mono">{word}</span>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setShowMnemonic(!showMnemonic)}
              >
                {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => copyToClipboard(mnemonic, 'Recovery phrase')} variant="outline" className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button onClick={downloadMnemonic} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Warning:</strong> Never share your recovery phrase. Anyone with these words can access your funds.
              </AlertDescription>
            </Alert>

            <Button onClick={confirmBackup} className="w-full" size="lg">
              <CheckCircle className="h-4 w-4 mr-2" />
              I've Backed Up My Recovery Phrase
            </Button>
          </CardContent>
        </Card>
      ) : (
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
                      12 Words
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

                <Button onClick={handleCreateWallet} disabled={loading} className="w-full" size="lg">
                  {loading ? 'Creating...' : 'Create Secure Wallet'}
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
      )}
    </div>
  );
}
