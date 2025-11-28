
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Download, Copy, Shield, CheckCircle } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface BackupWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
}

export default function BackupWalletModal({ isOpen, onClose, userAddress }: BackupWalletModalProps) {
  const [step, setStep] = useState<'warning' | 'export' | 'done'>('warning');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportPayload, setExportPayload] = useState<any | null>(null);
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    } catch (e) {
      toast({ title: 'Error', description: 'Unable to copy to clipboard', variant: 'destructive' });
    }
  };

  const requestBackupExport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const resp = await fetch('/api/wallet-setup/export-encrypted-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ password })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Export failed');

      setExportPayload({ backup: data.backup, filename: data.filename });
      setStep('done');
      toast({ title: 'Backup Ready', description: 'You can download your encrypted backup file now' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to export backup', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadExportFile = () => {
    if (!exportPayload) return;
    const content = JSON.stringify(exportPayload.backup, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportPayload.filename || `mtaadao-wallet-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-yellow-600" />
            Export Encrypted Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'warning' && (
            <>
              <Alert className="border-red-500 bg-red-50">
                <div className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Security Notice</strong>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>This export creates an encrypted backup file of your wallet stored client-side.</li>
                    <li>Anyone with this file and the password can restore your wallet.</li>
                    <li>Store the file offline and never share it.</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <p className="text-sm">To generate an encrypted backup file, enter your wallet password. The server will double-encrypt the stored wallet and return a downloadable package.</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep('export')} className="flex-1">Proceed</Button>
                <Button onClick={onClose} variant="outline">Cancel</Button>
              </div>
            </>
          )}

          {step === 'export' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Enter Wallet Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Your wallet password"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={requestBackupExport} disabled={loading || !password} className="flex-1">{loading ? 'Exporting...' : 'Export Encrypted Backup'}</Button>
                <Button onClick={() => setStep('warning')} variant="outline">Back</Button>
              </div>
            </>
          )}

          {step === 'done' && exportPayload && (
            <>
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-800">Encrypted backup created. Download and store it securely offline.</AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm">Wallet Address:</p>
                <code className="block bg-white p-2 rounded font-mono break-all">{userAddress}</code>
              </div>

              <div className="flex gap-2 mt-2">
                <Button onClick={downloadExportFile} className="flex-1" variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Download Backup File
                </Button>
                <Button onClick={() => copyToClipboard(JSON.stringify(exportPayload.backup), 'Backup JSON')} variant="outline">Copy JSON</Button>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={() => { toast({ title: 'Done', description: 'Backup exported.' }); onClose(); }} className="flex-1 bg-green-600 hover:bg-green-700">Close</Button>
                <Button onClick={() => setStep('export')} variant="outline">Back</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
