
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../ui/use-toast';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface PendingTransaction {
  id: string;
  proposedBy: string;
  amount: string;
  recipient: string;
  purpose: string;
  currentSignatures: number;
  requiredSignatures: number;
  signers: Array<{ userId: string; signedAt: string }>;
  status: 'pending' | 'approved' | 'expired';
  expiresAt: string;
}

export default function PendingTransactions({ daoId }: { daoId: string }) {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dao-treasury/${daoId}/multisig/pending`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const signTransaction = async (txId: string) => {
    try {
      const res = await fetch(`/api/dao-treasury/${daoId}/multisig/${txId}/sign`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: data.approved ? '✅ Approved!' : '✓ Signed',
          description: data.message
        });
        fetchTransactions();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (daoId) fetchTransactions();
  }, [daoId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Multi-Sig Approvals</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading...</div>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500">No pending transactions</p>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{tx.purpose}</h4>
                      <Badge variant={tx.status === 'pending' ? 'default' : 'secondary'}>
                        {tx.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Amount:</strong> ${tx.amount}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>To:</strong> {tx.recipient}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {tx.currentSignatures >= tx.requiredSignatures ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-orange-500" />
                      )}
                      <span className="text-sm">
                        {tx.currentSignatures}/{tx.requiredSignatures} signatures
                      </span>
                    </div>
                  </div>
                  <div>
                    {tx.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => signTransaction(tx.id)}
                        disabled={tx.signers.some(s => s.userId === 'current-user-id')}
                      >
                        Sign
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
