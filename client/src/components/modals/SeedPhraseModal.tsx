import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Copy, Download, Eye, EyeOff, CheckCircle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../ui/use-toast';

interface SeedPhraseModalProps {
  isOpen: boolean;
  seedPhrase: string;
  walletAddress?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SeedPhraseModal({ isOpen, seedPhrase, walletAddress, onConfirm, onCancel }: SeedPhraseModalProps) {
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    } catch (e) {
      toast({ title: 'Error', description: 'Unable to copy to clipboard', variant: 'destructive' });
    }
  };

  const downloadBackup = () => {
    const backup = {
      address: walletAddress || 'unknown',
      mnemonic: seedPhrase,
      timestamp: new Date().toISOString(),
      warning: '⚠️ KEEP THIS SAFE! Anyone with this file can access your funds!'
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtaadao-wallet-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Backup Downloaded', description: 'Store this file securely offline' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-yellow-600" />
            Backup Recovery Phrase
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Your recovery phrase gives full access to this wallet. Keep it offline and never share it.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recovery Phrase</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowMnemonic(!showMnemonic)}>
                {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            <div className={`grid ${seedPhrase.split(' ').length <= 12 ? 'grid-cols-3' : 'grid-cols-4'} gap-2 p-4 bg-gray-100 rounded ${!showMnemonic ? 'blur-sm' : ''}`}>
              {seedPhrase.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-white rounded">
                  <span className="text-xs text-gray-500">{i + 1}.</span>
                  <span className="font-mono font-semibold">{word}</span>
                </div>
              ))}
            </div>

            {showMnemonic && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button onClick={() => copyToClipboard(seedPhrase, 'Recovery phrase')} variant="outline">
                    <Copy className="h-4 w-4 mr-2" /> Copy Recovery Phrase
                  </Button>
                  <Button onClick={downloadBackup} variant="outline">
                    <Download className="h-4 w-4 mr-2" /> Download Backup
                  </Button>
                </div>

                <div className="flex items-start gap-2">
                  <input 
                    type="checkbox" 
                    id="mnemonic-stored"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="mnemonic-stored" className="text-sm">
                    I have written down my recovery phrase and stored it securely
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => { onConfirm(); }} disabled={!confirmed} className="flex-1 bg-green-600 hover:bg-green-700">
              Confirm & Continue
            </Button>
            <Button onClick={onCancel} variant="outline">Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
