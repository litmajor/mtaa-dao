
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Download, Upload, Shield, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/use-toast';

export default function WalletBackupManager({ userId }: { userId: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

  const handleExportBackup = async () => {
    if (password.length < 8) {
      toast({
        title: 'Weak Password',
        description: 'Password must be at least 8 characters',
        variant: 'destructive'
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch('/api/wallet-setup/export-encrypted-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success) {
        // Download backup file
        const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({
          title: 'Backup Created',
          description: 'Your encrypted wallet backup has been downloaded. Store it safely!'
        });

        setPassword('');
      } else {
        throw new Error(data.error || 'Backup failed');
      }
    } catch (error: any) {
      toast({
        title: 'Backup Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupFile || !password) {
      toast({
        title: 'Missing Information',
        description: 'Please select a backup file and enter password',
        variant: 'destructive'
      });
      return;
    }

    setIsRestoring(true);
    try {
      const fileContent = await backupFile.text();
      const backupData = JSON.parse(fileContent);

      const response = await fetch('/api/wallet-setup/restore-from-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ backupData, password })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Wallet Restored',
          description: `Wallet ${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)} restored successfully`
        });

        setPassword('');
        setBackupFile(null);

        // Reload page to refresh wallet state
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(data.error || 'Restore failed');
      }
    } catch (error: any) {
      toast({
        title: 'Restore Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Encrypted Backup
          </CardTitle>
          <CardDescription>
            Create an encrypted backup file of your wallet. You'll need a password to restore it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your backup will be encrypted with your password. Store both the file and password securely.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="export-password">Backup Password</Label>
            <div className="relative">
              <Input
                id="export-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button 
            onClick={handleExportBackup} 
            disabled={isExporting || password.length < 8}
            className="w-full"
          >
            {isExporting ? 'Creating Backup...' : 'Download Encrypted Backup'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Restore from Backup
          </CardTitle>
          <CardDescription>
            Upload your encrypted backup file to restore your wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Restoring will replace your current wallet. Make sure you have the correct backup file.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="backup-file">Backup File</Label>
            <Input
              id="backup-file"
              type="file"
              accept=".json"
              onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="restore-password">Backup Password</Label>
            <Input
              id="restore-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter backup password"
            />
          </div>

          <Button 
            onClick={handleRestoreBackup} 
            disabled={isRestoring || !backupFile || !password}
            className="w-full"
            variant="destructive"
          >
            {isRestoring ? 'Restoring...' : 'Restore Wallet from Backup'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
