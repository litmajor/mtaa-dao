
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Download, Copy, Eye, EyeOff, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface BackupWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
}

export default function BackupWalletModal({ isOpen, onClose, userAddress }: BackupWalletModalProps) {
  const [step, setStep] = useState<'warning' | 'mnemonic' | 'privatekey' | 'confirm'>('warning');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [confirmed, setConfirmed] = useState({ mnemonic: false, privateKey: false, stored: false });
  const { toast } = useToast();

  // In production, fetch from backend API
  const mockMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const mockPrivateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  const downloadBackup = () => {
    const backup = {
      address: userAddress,
      mnemonic: mockMnemonic,
      privateKey: mockPrivateKey,
      timestamp: new Date().toISOString(),
      warning: "⚠️ KEEP THIS SAFE! Anyone with this file can access your funds!"
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
            Backup Your Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'warning' && (
            <>
              <Alert className="border-red-500 bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Critical Security Warning</strong>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>Your recovery phrase and private key give FULL ACCESS to your funds</li>
                    <li>Never share them with anyone - not even MtaaDAO support</li>
                    <li>Store them offline in multiple secure locations</li>
                    <li>Anyone with access can steal all your money</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <h3 className="font-semibold">What you'll receive:</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Recovery Phrase (12 words)</p>
                      <p className="text-sm text-gray-600">Use this to restore your wallet on any device</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-purple-50 rounded">
                    <CheckCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Private Key</p>
                      <p className="text-sm text-gray-600">Advanced users can import this directly</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep('mnemonic')} className="flex-1">
                  I Understand, Continue
                </Button>
                <Button onClick={onClose} variant="outline">Cancel</Button>
              </div>
            </>
          )}

          {step === 'mnemonic' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recovery Phrase (12 words)</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowMnemonic(!showMnemonic)}>
                    {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                
                <div className={`grid grid-cols-3 gap-2 p-4 bg-gray-100 rounded ${!showMnemonic ? 'blur-sm' : ''}`}>
                  {mockMnemonic.split(' ').map((word, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-white rounded">
                      <span className="text-xs text-gray-500">{i + 1}.</span>
                      <span className="font-mono font-semibold">{word}</span>
                    </div>
                  ))}
                </div>

                {showMnemonic && (
                  <div className="space-y-2">
                    <Button onClick={() => copyToClipboard(mockMnemonic, 'Recovery phrase')} className="w-full" variant="outline">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Recovery Phrase
                    </Button>
                    <div className="flex items-start gap-2">
                      <input 
                        type="checkbox" 
                        id="mnemonic-confirm"
                        checked={confirmed.mnemonic}
                        onChange={(e) => setConfirmed({...confirmed, mnemonic: e.target.checked})}
                        className="mt-1"
                      />
                      <label htmlFor="mnemonic-confirm" className="text-sm">
                        I have written down my recovery phrase in a safe place
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep('privatekey')} disabled={!confirmed.mnemonic} className="flex-1">
                  Next: Private Key
                </Button>
                <Button onClick={() => setStep('warning')} variant="outline">Back</Button>
              </div>
            </>
          )}

          {step === 'privatekey' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Private Key (Advanced)</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowPrivateKey(!showPrivateKey)}>
                    {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                
                <div className={`p-3 bg-gray-100 rounded font-mono text-xs break-all ${!showPrivateKey ? 'blur-sm' : ''}`}>
                  {mockPrivateKey}
                </div>

                {showPrivateKey && (
                  <div className="space-y-2">
                    <Button onClick={() => copyToClipboard(mockPrivateKey, 'Private key')} className="w-full" variant="outline">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Private Key
                    </Button>
                    <div className="flex items-start gap-2">
                      <input 
                        type="checkbox" 
                        id="privatekey-confirm"
                        checked={confirmed.privateKey}
                        onChange={(e) => setConfirmed({...confirmed, privateKey: e.target.checked})}
                        className="mt-1"
                      />
                      <label htmlFor="privatekey-confirm" className="text-sm">
                        I have securely stored my private key
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Tip:</strong> Use the download button to save an encrypted backup file you can store on a USB drive.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={() => setStep('confirm')} disabled={!confirmed.privateKey} className="flex-1">
                  Next: Confirm
                </Button>
                <Button onClick={() => setStep('mnemonic')} variant="outline">Back</Button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-800">
                  Almost done! Confirm that you've backed up your wallet.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <input 
                    type="checkbox" 
                    id="stored-confirm"
                    checked={confirmed.stored}
                    onChange={(e) => setConfirmed({...confirmed, stored: e.target.checked})}
                    className="mt-1"
                  />
                  <label htmlFor="stored-confirm" className="text-sm">
                    I confirm that I have securely stored my recovery phrase and private key in multiple safe locations. I understand that losing them means losing access to my funds forever.
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={downloadBackup} className="flex-1" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Backup File
                </Button>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    toast({ title: 'Backup Confirmed', description: 'Your wallet is now secured!' });
                    onClose();
                  }} 
                  disabled={!confirmed.stored} 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Confirm & Close
                </Button>
                <Button onClick={() => setStep('privatekey')} variant="outline">Back</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
