
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Shield, AlertTriangle, Download, Eye, EyeOff, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { apiPost, apiGet } from '@/lib/api';

interface WalletBackupReminderProps {
  userId: string;
  walletAddress?: string;
}

export default function WalletBackupReminder({ userId, walletAddress }: WalletBackupReminderProps) {
  const [isBackedUp, setIsBackedUp] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkBackupStatus();
  }, [userId]);

  const checkBackupStatus = async () => {
    try {
      const response = await apiGet(`/api/wallet-setup/backup-status/${userId}`);
      setIsBackedUp(response.isBackedUp || false);
    } catch (error) {
      console.error('Failed to check backup status:', error);
    }
  };

  const retrieveBackupData = async () => {
    setLoading(true);
    try {
      const response = await apiPost('/api/wallet-setup/get-backup-data', { userId });
      setRecoveryPhrase(response.mnemonic || '');
      setPrivateKey(response.privateKey || '');
      setShowBackupDialog(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to retrieve backup data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmBackup = async () => {
    try {
      await apiPost('/api/wallet-setup/backup-confirmed', { userId });
      setIsBackedUp(true);
      setShowBackupDialog(false);
      toast({
        title: 'Success',
        description: 'Wallet backup confirmed!'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to confirm backup',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`
    });
  };

  const downloadBackup = () => {
    const content = `MtaaDAO Wallet Backup
========================================
⚠️ KEEP THIS SAFE AND NEVER SHARE!

Wallet Address:
${walletAddress}

Recovery Phrase:
${recoveryPhrase}

Private Key:
${privateKey}

Created: ${new Date().toISOString()}

WARNING: Anyone with this information can access your funds!
Store this in a secure location offline.
Never share it with anyone, including MtaaDAO support.
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtaadao-backup-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isBackedUp) {
    return null; // Don't show reminder if already backed up
  }

  return (
    <>
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950 mb-6">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-yellow-800 dark:text-yellow-200 font-medium">
            ⚠️ Important: Backup your wallet to prevent losing access to your funds
          </span>
          <Button
            onClick={retrieveBackupData}
            disabled={loading}
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <Shield className="h-4 w-4 mr-2" />
            {loading ? 'Loading...' : 'Backup Now'}
          </Button>
        </AlertDescription>
      </Alert>

      {showBackupDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <Shield className="h-6 w-6" />
                Backup Your Wallet
              </CardTitle>
              <CardDescription>
                Save your recovery phrase and private key in a secure location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recovery Phrase */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recovery Phrase (12 words)</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPhrase(!showPhrase)}
                  >
                    {showPhrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className={`grid grid-cols-3 gap-2 p-4 bg-gray-100 dark:bg-gray-800 rounded ${!showPhrase ? 'blur-sm' : ''}`}>
                  {recoveryPhrase.split(' ').map((word, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded">
                      <span className="text-xs text-gray-500">{i + 1}.</span>
                      <span className="font-mono font-semibold">{word}</span>
                    </div>
                  ))}
                </div>
                {showPhrase && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(recoveryPhrase, 'Recovery phrase')}
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Recovery Phrase
                  </Button>
                )}
              </div>

              {/* Private Key */}
              {privateKey && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Private Key (Advanced)</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className={`p-3 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs break-all ${!showKey ? 'blur-sm' : ''}`}>
                    {privateKey}
                  </div>
                  {showKey && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(privateKey, 'Private key')}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Private Key
                    </Button>
                  )}
                </div>
              )}

              {/* Security Warning */}
              <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 dark:text-red-200 text-sm">
                  <strong>Security Warning:</strong>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>Never share your recovery phrase or private key with anyone</li>
                    <li>MtaaDAO support will NEVER ask for this information</li>
                    <li>Anyone with access can steal all your funds</li>
                    <li>Store offline in multiple secure locations</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={downloadBackup}
                  className="flex-1"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Backup
                </Button>
                <Button
                  onClick={confirmBackup}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I've Backed Up
                </Button>
              </div>

              <Button
                onClick={() => setShowBackupDialog(false)}
                variant="ghost"
                className="w-full"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
