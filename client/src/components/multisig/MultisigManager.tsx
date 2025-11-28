import React, { useEffect, useState } from 'react';
import CreateMultisigModal from '../modals/CreateMultisigModal';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useToast } from '../ui/use-toast';

interface MultisigManagerProps {
  daoId: string;
  elders?: string[];
}

export default function MultisigManager({ daoId, elders = [] }: MultisigManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [multisigs, setMultisigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchMultisigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dao/${daoId}/multisig`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load multisigs');
      setMultisigs(data.multisigs || data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Unable to load multisigs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (daoId) fetchMultisigs();
  }, [daoId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Treasury Multisig</h3>
        <Button onClick={() => setModalOpen(true)}>Create Multisig</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Multisigs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : multisigs.length ? (
            <ul className="space-y-2">
              {multisigs.map((m) => (
                <li key={m.id} className="p-2 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{m.contractAddress || m.address || m.id}</div>
                      <div className="text-xs text-gray-500">Signers: {m.totalSigners || (m.signers || []).length} • Required: {m.requiredSignatures}</div>
                    </div>
                    <div>
                      <Button size="sm" variant="ghost">View</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">No multisig wallets registered for this DAO.</div>
          )}
        </CardContent>
      </Card>

      <CreateMultisigModal
        isOpen={modalOpen}
        daoId={daoId}
        initialSigners={elders}
        onClose={() => setModalOpen(false)}
        onCreated={(m) => {
          toast({ title: 'Created', description: 'Multisig created' });
          setModalOpen(false);
          fetchMultisigs();
        }}
      />
    </div>
  );
}
