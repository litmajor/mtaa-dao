import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, Trash2, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../ui/use-toast';

interface CreateMultisigModalProps {
  isOpen: boolean;
  daoId?: string;
  initialSigners?: string[];
  onClose: () => void;
  onCreated?: (multisig: any) => void;
}

const isAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr) || /^[a-f0-9-]{36}$/.test(addr);

export default function CreateMultisigModal({ isOpen, daoId, initialSigners = [], onClose, onCreated }: CreateMultisigModalProps) {
  const [signers, setSigners] = useState<string[]>(initialSigners);
  const [newSigner, setNewSigner] = useState('');
  const [required, setRequired] = useState<number>(Math.max(2, initialSigners.length || 2));
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSigners(initialSigners);
    setRequired(Math.max(2, initialSigners.length || 2));
  }, [initialSigners]);

  if (!isOpen) return null;

  const addSigner = () => {
    const trimmed = newSigner.trim();
    if (!trimmed) return toast({ title: 'Empty', description: 'Enter a signer address or user id', variant: 'destructive' });
    if (!isAddress(trimmed)) return toast({ title: 'Invalid', description: 'Signer must be a valid wallet address or user id', variant: 'destructive' });
    if (signers.includes(trimmed)) return toast({ title: 'Duplicate', description: 'Signer already added', variant: 'destructive' });
    setSigners([...signers, trimmed]);
    setNewSigner('');
    setRequired(Math.min(signers.length + 1, 5));
  };

  const removeSigner = (idx: number) => {
    const s = [...signers];
    s.splice(idx, 1);
    setSigners(s);
    setRequired(Math.min(required, Math.max(2, s.length)));
  };

  const createMultisig = async () => {
    if (!daoId) return toast({ title: 'Missing DAO', description: 'DAO id required to create multisig', variant: 'destructive' });
    if (signers.length < 2) return toast({ title: 'Not enough signers', description: 'Add at least 2 signers', variant: 'destructive' });
    if (required < 2 || required > signers.length) return toast({ title: 'Invalid required signatures', description: 'Required signatures must be between 2 and the number of signers', variant: 'destructive' });

    setLoading(true);
    try {
      const resp = await fetch(`/api/dao/${daoId}/multisig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredSignatures: required, signers }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || 'Failed to create multisig');
      toast({ title: 'Multisig Created', description: 'Multisig wallet recorded for this DAO' });
      onCreated?.(data);
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to create multisig', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Create Multisig Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              A multisig wallet protects the DAO treasury by requiring multiple elders to sign withdrawals.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Signers</label>
            <div className="space-y-2">
              {signers.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{i + 1}.</span>
                    <span className="font-mono break-all">{s}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeSigner(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 border rounded"
                  placeholder="0x... or user-id"
                  value={newSigner}
                  onChange={(e) => setNewSigner(e.target.value)}
                />
                <Button onClick={addSigner}>
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Required Signatures</label>
              <input
                type="number"
                min={2}
                max={Math.max(2, signers.length)}
                value={required}
                onChange={(e) => setRequired(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">Must be between 2 and the total number of signers.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={createMultisig} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Create Multisig
            </Button>
            <Button onClick={onClose} variant="outline">Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
