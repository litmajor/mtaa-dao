
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Shield, CheckCircle, FileText, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { authClient } from '@/utils/authClient';
import { useToast } from '../ui/use-toast';

interface SecureWalletManagerProps {
  userId: string;
  onWalletCreated?: (data: any) => void;
}

type WalletSecurityState =
  | 'UNINITIALIZED'
  | 'GENERATING'
  | 'UNBACKED'
  | 'VIEWING_SECRET'
  | 'VERIFYING_BACKUP'
  | 'SECURE'
  | 'AT_RISK';

export default function SecureWalletManager({ userId, onWalletCreated }: SecureWalletManagerProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [encryptedKeystore, setEncryptedKeystore] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [activeTab, setActiveTab] = useState<'create' | 'recover' | 'import'>('create');
  const [walletAddress, setWalletAddress] = useState('');
  const [step, setStep] = useState<'create' | 'backup' | 'complete'>('create');
  const [walletSecurityState, setWalletSecurityState] = useState<WalletSecurityState>('UNINITIALIZED');
  const [useEncryption, setUseEncryption] = useState(true);
  const { toast } = useToast();
  // verification challenge inputs
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<Record<number, string>>({});

  const handleCreateWallet = async () => {
    // Validation
    if (useEncryption) {
      if (password !== confirmPassword) {
        toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
        return;
      }

      if (password.length < 8) {
        toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    setWalletSecurityState('GENERATING');
    try {
      // Generate entropy for requested mnemonic length using Web Crypto
      const entropyBytes = wordCount === 24 ? 32 : 16; // 256-bit for 24 words, 128-bit for 12 words
      const arr = new Uint8Array(entropyBytes);
      crypto.getRandomValues(arr);

      const { Wallet, utils } = await import('ethers');
      const entropyHex = '0x' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
      const mnem = utils.entropyToMnemonic ? utils.entropyToMnemonic(entropyHex) : Wallet.createRandom().mnemonic.phrase;
      const wallet = Wallet.fromMnemonic(mnem);

      setMnemonic(mnem);
      setWalletAddress(await wallet.getAddress());

      // Create encrypted keystore if password provided (recommended)
      if (useEncryption && password) {
        const keystore = await wallet.encrypt(password);
        setEncryptedKeystore(keystore);
        // send only address and keystore to server (server should never see raw mnemonic/privateKey)
        await fetch('/api/v1/wallets/setup/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authClient.getAuthHeaders()) },
          body: JSON.stringify({ address: await wallet.getAddress(), keystore })
        });
      } else {
        // Without encryption, still do not send raw private key. Send only address to the server.
        await fetch('/api/v1/wallets/setup/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authClient.getAuthHeaders()) },
          body: JSON.stringify({ address: await wallet.getAddress() })
        });
      }

      setStep('backup');
      setWalletSecurityState('UNBACKED');
      toast({ title: 'Wallet Created', description: 'Your wallet is ready. Please back up your recovery phrase.' });
      onWalletCreated?.({ address: await wallet.getAddress() });
    } catch (error) {
      console.error('Wallet creation error:', error);
      toast({
        title: 'Error Creating Wallet',
        description: error instanceof Error ? error.message : 'Failed to create wallet. Check console for details.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverWallet = async () => {
    if (!mnemonic.trim()) {
      toast({ title: 'Error', description: 'Recovery phrase is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { Wallet } = await import('ethers');
      // Recover wallet locally from mnemonic
      const wallet = Wallet.fromMnemonic(mnemonic.trim());
      const address = await wallet.getAddress();

      // Create signed challenge similar to import flow
      const ts = Date.now();
      const nonceArr = new Uint32Array(1);
      crypto.getRandomValues(nonceArr);
      const nonce = nonceArr[0];
      const message = `MtaaDAO wallet recover verification\naddress: ${address}\ntimestamp: ${ts}\nnonce: ${nonce}`;
      const signature = await wallet.signMessage(message);

      // Send only address, message, signature to server; never send mnemonic or private key
      const response = await fetch('/api/v1/wallets/setup/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authClient.getAuthHeaders()) },
        body: JSON.stringify({ userId, address, message, signature })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Success', description: 'Wallet recovered successfully' });
        setStep('complete');
        onWalletCreated?.(data);
      } else {
        throw new Error(data?.error || 'Failed to verify recovery with server');
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to recover wallet', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImportPrivateKey = async () => {
    if (!privateKey.trim() || !password) {
      toast({ title: 'Error', description: 'Private key and password are required', variant: 'destructive' });
      return;
    }
    // Instead of sending raw private keys to the server, sign a local challenge
    setLoading(true);
    try {
      // Normalize and validate private key locally
      const pk = privateKey.trim();
      const { Wallet } = await import('ethers');
      const wallet = new Wallet(pk);
      const address = await wallet.getAddress();

      // Create a signed challenge message with timestamp and nonce to prevent replay
      const ts = Date.now();
      const nonceArr = new Uint32Array(1);
      crypto.getRandomValues(nonceArr);
      const nonce = nonceArr[0];
      const message = `MtaaDAO wallet import verification\naddress: ${address}\ntimestamp: ${ts}\nnonce: ${nonce}`;

      const signature = await wallet.signMessage(message);

      const response = await fetch('/api/v1/wallets/setup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, address, message, signature })
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: 'Success', description: 'Wallet imported successfully' });
        onWalletCreated?.(data);
        setStep('complete');
        // Imported private-key-only wallets are AT_RISK (no recovery phrase)
        setWalletSecurityState('AT_RISK');
      } else {
        throw new Error(data.error || 'Import failed');
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

  // Begin backup verification by selecting three indices
  const startVerification = () => {
    const total = (mnemonic || '').split(' ').filter(Boolean).length || wordCount;
    // pick distinct indices (1-based) - prefer 3,8,11 if available
    const preferred = [3, 8, 11].filter((i) => i <= total);
    const indices: number[] = [];
    for (const p of preferred) {
      if (indices.length < 3) indices.push(p);
    }
    // fill with cryptographically secure random indices if needed
    while (indices.length < 3 && total > 0) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const n = (arr[0] % total) + 1;
      if (!indices.includes(n)) indices.push(n);
    }
    setVerifyIndices(indices);
    setVerifyInputs({});
    setWalletSecurityState('VERIFYING_BACKUP');
  };

  const submitVerification = async () => {
    const words = (mnemonic || '').split(' ');
    for (const idx of verifyIndices) {
      const expected = (words[idx - 1] || '').trim().toLowerCase();
      const given = (verifyInputs[idx] || '').trim().toLowerCase();
      if (expected !== given) {
        toast({ title: 'Verification Failed', description: 'One or more words are incorrect', variant: 'destructive' });
        return;
      }
    }
    // Mark backed up and secure
    setBackedUp(true);
    setWalletSecurityState('SECURE');
    // notify server of backup confirmation (authorized)
    try {
      await fetch('/api/v1/wallets/setup/backup-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authClient.getAuthHeaders()) },
        body: JSON.stringify({ userId, address: walletAddress })
      });
    } catch (e) {
      console.warn('Failed to notify server of backup confirmation', e);
    }
    toast({ title: 'Backup Verified', description: 'Your recovery phrase has been confirmed' });
    setStep('complete');
  };
 

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };
  const downloadEncryptedKeystore = async () => {
    try {
      // If we already have an encrypted keystore, download it
      if (encryptedKeystore) {
        const element = document.createElement('a');
        const file = new Blob([encryptedKeystore], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `mtaadao-keystore-${Date.now()}.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        toast({ title: 'Downloaded', description: 'Encrypted keystore downloaded' });
        return;
      }

      // Otherwise try to build a keystore from available secrets and provided password
      if (mnemonic && password) {
        const { Wallet } = await import('ethers');
        const wallet = Wallet.fromMnemonic(mnemonic.trim());
        const keystore = await wallet.encrypt(password);
        const element = document.createElement('a');
        const file = new Blob([keystore], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `mtaadao-keystore-${Date.now()}.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        toast({ title: 'Downloaded', description: 'Encrypted keystore downloaded' });
        return;
      }

      if (privateKey && password) {
        const { Wallet } = await import('ethers');
        const wallet = new Wallet(privateKey.trim());
        const keystore = await wallet.encrypt(password);
        const element = document.createElement('a');
        const file = new Blob([keystore], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = `mtaadao-keystore-${Date.now()}.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        toast({ title: 'Downloaded', description: 'Encrypted keystore downloaded' });
        return;
      }

      toast({ title: 'Cannot download', description: 'Provide a password and either generated mnemonic or private key to produce an encrypted keystore', variant: 'destructive' });
    } catch (e) {
      console.error('Keystore download error', e);
      toast({ title: 'Error', description: 'Failed to create/download keystore', variant: 'destructive' });
    }
  };
  // Secure download handler — do NOT export plaintext mnemonic to disk.
  // For security we provide an encrypted keystore export instead.
  const downloadMnemonic = async () => {
    try {
      toast({ title: 'Security Notice', description: 'Plaintext recovery phrase downloads are disabled for security. Exporting encrypted keystore instead.' });
      await downloadEncryptedKeystore();
    } catch (e) {
      console.error('Download fallback error', e);
      toast({ title: 'Error', description: 'Failed to export keystore', variant: 'destructive' });
    }
  };
  const securityPill = useMemo(() => {
    const map: Record<WalletSecurityState, { color: string; text: string }> = {
      UNINITIALIZED: { color: 'bg-gray-200 text-gray-700', text: 'UNINITIALIZED' },
      GENERATING: { color: 'bg-blue-100 text-blue-800', text: 'GENERATING' },
      UNBACKED: { color: 'bg-amber-100 text-amber-800', text: 'UNBACKED' },
      VIEWING_SECRET: { color: 'bg-amber-100 text-amber-800', text: 'VIEWING_SECRET' },
      VERIFYING_BACKUP: { color: 'bg-amber-200 text-amber-900', text: 'VERIFYING_BACKUP' },
      SECURE: { color: 'bg-green-100 text-green-800', text: 'SECURE' },
      AT_RISK: { color: 'bg-red-100 text-red-800', text: 'AT_RISK' }
    };
    return map[walletSecurityState];
  }, [walletSecurityState]);
  if (step === 'backup' && mnemonic) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Shield className="h-12 w-12 text-green-600" />
            <h1 className="text-3xl font-bold">{walletSecurityState === 'UNBACKED' ? 'YOUR WALLET IS READY' : 'Wallet Backup'}</h1>
            {walletSecurityState === 'UNBACKED' && (
              <p className="text-gray-600">This is a self-custody wallet. Only you control recovery access. MtaaDAO cannot recover lost wallets.</p>
            )}
          </div>
          <div className={`px-3 py-1 rounded-full ${securityPill.color} flex items-center gap-2`}>● <span className="text-xs font-semibold">{securityPill.text}</span></div>
        </div>

        {/* Permanent Non-Custodial Card */}
        <Card>
          <CardHeader>
            <CardTitle>Non-Custodial Security</CardTitle>
            <CardDescription>Important information about who can recover this wallet</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc ml-4 space-y-1">
              <li>You own your recovery phrase</li>
              <li>Your keys are never stored by MtaaDAO</li>
              <li>No password reset exists</li>
              <li>Losing your phrase means permanent loss of access</li>
            </ul>
          </CardContent>
        </Card>

        {/* Main content by security state */}
        {walletSecurityState === 'UNBACKED' && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Backup Required</CardTitle>
              <CardDescription>Your recovery phrase has not been backed up.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">If this device is lost, damaged, or reset, your funds cannot be recovered.</p>
              <div className="mb-4">
                <strong>Recovery Capability Matrix</strong>
                <table className="w-full text-sm mt-2">
                  <tbody>
                    <tr><td>You</td><td className="text-right">YES</td></tr>
                    <tr><td>MtaaDAO</td><td className="text-right">NO</td></tr>
                    <tr><td>Support Team</td><td className="text-right">NO</td></tr>
                    <tr><td>Blockchain</td><td className="text-right">NO</td></tr>
                  </tbody>
                </table>
              </div>
              <Button onClick={() => { setShowMnemonic(true); setWalletSecurityState('VIEWING_SECRET'); }} className="w-full" size="lg">
                Reveal Recovery Phrase
              </Button>
            </CardContent>
          </Card>
        )}

        {(walletSecurityState === 'VIEWING_SECRET' || showMnemonic) && (
          <div className="relative">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-10"></div>
            <Card className="relative z-20">
              <CardHeader>
                <CardTitle>Recovery Phrase ({wordCount} words)</CardTitle>
                <CardDescription>Reveal and securely record your recovery phrase. Avoid screenshots.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`grid ${wordCount === 12 ? 'grid-cols-3' : 'grid-cols-4'} gap-3 p-4 bg-white rounded-lg`}>
                  {mnemonic.split(' ').map((word, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                      <span className="text-xs text-gray-500 font-mono w-6">{i + 1}.</span>
                      <span className="font-mono font-semibold">{word}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => copyToClipboard(mnemonic, 'Recovery phrase')} variant="outline" className="flex-1">Copy</Button>
                  <Button onClick={downloadMnemonic} variant="outline" className="flex-1">Download</Button>
                  <Button onClick={() => { setShowMnemonic(false); setWalletSecurityState('UNBACKED'); }} variant="outline" className="flex-1">Hide</Button>
                </div>

                <div className="mt-6">
                  <Button onClick={startVerification} className="w-full" size="lg">Verify Backup</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {walletSecurityState === 'VERIFYING_BACKUP' && (
          <Card>
            <CardHeader>
              <CardTitle>Verify Your Backup</CardTitle>
              <CardDescription>Prove you recorded the recovery phrase by entering a few words.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {verifyIndices.map((idx) => (
                  <div key={idx}>
                    <Label>Word #{idx}</Label>
                    <Input value={verifyInputs[idx] || ''} onChange={(e) => setVerifyInputs({ ...verifyInputs, [idx]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button onClick={submitVerification} className="w-full">Confirm</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {walletSecurityState === 'AT_RISK' && (
          <Card className="border-red-300">
            <CardHeader>
              <CardTitle>Wallet At Risk</CardTitle>
              <CardDescription>This wallet has no recovery phrase recorded.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Imported private-key wallets do not include a recovery phrase. Create an encrypted backup to avoid permanent loss.</p>
              <Button onClick={downloadEncryptedKeystore} className="w-full">Download Encrypted Backup</Button>
            </CardContent>
          </Card>
        )}
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

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val as any); setPassword(''); setConfirmPassword(''); setPrivateKey(''); setEncryptedKeystore(null); }}>
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

              <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-base font-semibold mb-2 block">Encryption Password (Optional)</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Add extra security by encrypting your wallet with a password. You can skip this and only use your recovery phrase.
                    </p>
                  </div>
                  <div className="ml-4">
                    <Button
                      variant={useEncryption ? 'default' : 'outline'}
                      onClick={() => setUseEncryption(!useEncryption)}
                      className="whitespace-nowrap"
                    >
                      {useEncryption ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>
              </div>

              {useEncryption && (
                <>
                  <div>
                    <Label htmlFor="password">Encryption Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a strong password (min 8 characters)"
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
                </>
              )}

              {!useEncryption && (
                <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-300">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    Without encryption, your recovery phrase is your only security. Store it very carefully in a secure offline location.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleCreateWallet} 
                disabled={loading || (useEncryption && password.length < 8)} 
                className="w-full" 
                size="lg"
              >
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
